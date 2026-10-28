// 실제로 그리는 둥근 경로의 교차를 같은 규칙으로 끊는다. 더 세로에 가까운 경로가 아래로 지나간다.
// 경로 점은 그대로이고, 세로 구간을 가진 선의 path에 구멍 난 clipPath를 걸 뿐이다. 그룹과 판은 면이 없어(draw/figure.js drawGroup) 구멍으로 바탕이 그대로 보인다.
// 장면 메시지와 quiet처럼 조건부로 나타나는 선은 끊지 않는다. 그 선이 숨었을 때 항상 보이는 관계선에 빈 구멍이 남지 않게 한다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { roundCoord as r } from '../format/text.js';
import { flattenRoute } from '../math/route.js';

const EDGE = values['border-width'].edge;
const GAP_HALF = EDGE / 2 + values.spacing['1'];
const END_REACH = 1;

// cost: time O(e²·p²), heap O(e·p), stack O(1)
// vars: e = 선 수, p = 둥근 경로를 편 점 수
// basis: estimate
// 실제로 그리는 둥근 경로끼리 교차하는 자리. 더 세로에 가까운 선을 끊고 같은 기울기는 선언 순서로 결정한다. 연결점 근처의 합류는 끊지 않는다.
export function crossingCuts(edges) {
  const routes = edges.map((edge, j) => ({ j, points: edge.points, segments: edge.si === undefined && !edge.isMark && !edge.quiet ? runs(flattenRoute(edge.points)) : [] }));
  const cuts = new Map();
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const first = routes[i], second = routes[j];
    for (const a of first.segments) for (const b of second.segments) {
      const point = intersection(a, b);
      if (!point || nearEnd(first.points, point) || nearEnd(second.points, point)) continue;
      const verticality = run => Math.abs(run.b.y - run.a.y) / Math.hypot(run.b.x - run.a.x, run.b.y - run.a.y);
      const below = verticality(a) > verticality(b) ? first.j : second.j;
      mergeCut(cuts, below, { x: point.x - GAP_HALF, y: point.y - GAP_HALF, w: GAP_HALF * 2, h: GAP_HALF * 2 });
    }
  }
  return cuts;
}

function runs(points) {
  return points.slice(1).map((b, i) => ({ a: points[i], b })).filter(({ a, b }) => Math.hypot(b.x - a.x, b.y - a.y) > END_REACH / 100);
}

function nearEnd(points, p) {
  return [points[0], points.at(-1)].some(end => Math.hypot(end.x - p.x, end.y - p.y) < GAP_HALF);
}

function intersection(a, b) {
  const dx = a.b.x - a.a.x, dy = a.b.y - a.a.y;
  const ex = b.b.x - b.a.x, ey = b.b.y - b.a.y;
  const divisor = dx * ey - dy * ex;
  if (Math.abs(divisor) < 1e-6) return;
  const x = b.a.x - a.a.x, y = b.a.y - a.a.y;
  const t = (x * ey - y * ex) / divisor, u = (x * dy - y * dx) / divisor;
  if (t < 0 || t > 1 || u < 0 || u > 1) return;
  return { x: a.a.x + t * dx, y: a.a.y + t * dy };
}

// 겹친 구멍은 합쳐 evenodd 마스크에서 서로 지워지지 않게 한다.
function mergeCut(cuts, id, cut) {
  const list = cuts.get(id) ?? [];
  for (let i = 0; i < list.length;) {
    const other = list[i];
    if (cut.x <= other.x + other.w && cut.x + cut.w >= other.x && cut.y <= other.y + other.h && cut.y + cut.h >= other.y) {
      const right = Math.max(cut.x + cut.w, other.x + other.w), bottom = Math.max(cut.y + cut.h, other.y + other.h);
      cut.x = Math.min(cut.x, other.x); cut.y = Math.min(cut.y, other.y);
      cut.w = right - cut.x; cut.h = bottom - cut.y;
      list.splice(i, 1); i = 0;
    } else i++;
  }
  list.push(cut);
  cuts.set(id, list);
}

// cost: time O(p + c), heap O(out), stack O(1)
// vars: p = 경로 점 수, c = 끊을 자리 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 선 하나의 clipPath 정의와 path에 붙일 속성. 바깥 사각형은 선 전체(화살촉 포함)를 넉넉히 덮고, 끊을 자리마다 구멍을 낸다.
 * @param id clipPath id
 */
export function cutClip(id, points, cuts) {
  if (!cuts?.length) return { defs: '', attribute: '' };
  const pad = values.spacing['4'];
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  const rect = ({ x, y, w, h }) => `M ${r(x)} ${r(y)} h ${r(w)} v ${r(h)} h ${r(-w)} Z`;
  return { defs: `<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${[box, ...cuts].map(rect).join(' ')}" clip-rule="evenodd"/></clipPath>`, attribute: ` clip-path="url(#${id})"` };
}
