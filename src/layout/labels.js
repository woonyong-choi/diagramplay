// 선 라벨 자리 고르기. elkjs가 선 꼬리 옆에 잡은 자리가 다른 라벨, 도형, 다른 선과 겹치거나 그룹 테두리에 걸치거나 자기 선 곁에 없으면 자기 선의 중앙에서 가장 가까운 빈 자리로 옮긴다(docs/design/layout.md 선 라벨).
// 경로 점은 건드리지 않고 라벨 가운데 자리만 정한다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { isOnLinePill, sizePill } from '../measure/pills.js';
import { headBox } from './titles.js';
import { SAME_POINT } from './model.js';

/** 선분 위에 글이나 알약을 놓아 볼 자리(선분 길이의 비율). 가운데부터 양쪽으로 옮긴다. 선 번호와 관계 설명이 같은 순서다. */
export const ALONG_SPOTS = Object.freeze([0.5, 0.35, 0.65, 0.2, 0.8]);

// 라벨과 자기 선 사이 간격. elkjs 라벨 간격(`elk.spacing.edgeLabel`)과 같다.
const GAP = values.spacing["1"];
// 다른 요소와 이보다 가까우면 붙어 보인다.
const CLEAR = values.spacing["0-5"];
// 자기 선을 따라 자리를 찾는 걸음
const STEP = values.spacing["1-5"];
const CORNER_CLEAR = values.radius.route;

// cost: time O(l·c·(s + l + e·p)), heap O(l), stack O(1)
// vars: l = 라벨 수, c = 후보 자리 수(선 길이 / STEP), s = 도형 수, e = 선 수, p = 경로 점 수
// basis: estimate
/**
 * 라벨 자리를 선언 순서대로 정한다. 자기 선의 중앙에 가장 가까운 빈 자리를 쓰고, 재생 글의 통로를 확보한 경우 유효한 기존 자리를 보존한다.
 * 빈 자리가 없으면 elkjs 자리를 그대로 두어 그림 검사 2번이 알린다.
 * @param edges 경로 점(points)과 elkjs 라벨 자리(labelAt)를 가진 선. labelAt을 바꾼다
 * @param items 도형 사각형
 * @param bounds 그림 크기 { width, height }
 * @param groups 그룹 사각형. 라벨은 그룹 안에 들거나 밖에 있어야 하고 테두리에 걸치면 안 된다
 */
export function settleLabels(edges, items, bounds, groups = []) {
  const solids = items.map((it) => inflate({ x: it.x - (it.marginSide ?? 0), y: it.y - (it.marginTop ?? 0), w: it.w + (it.marginSide ?? 0) * 2, h: it.h + (it.marginTop ?? 0) + (it.marginBottom ?? 0) }, CLEAR));
  const runs = edges.flatMap((e) => e.points.slice(1).map((q, k) => ({ p: e.points[k], q, edge: e.index })));
  const ends = edges.flatMap(edge => (edge.endpointLabels ?? []).map(label => boxAt(label, label)));
  const headers = groups.filter(group => group.label).map(group => headBox(group, group.iconData?.library === 'nhn-cloud' ? 0 : values.spacing["4-5"]));
  const placed = [];
  for (const e of edges) {
    if (!e.labelAt) continue;
    const size = sizePill(e.label, e.no);
    const onLine = isOnLinePill(e);
    const isFree = (at) => {
      const box = boxAt(at, size);
      if (box.x < 0 || box.y < 0 || box.x + box.w > bounds.width || box.y + box.h > bounds.height) return false;
      const around = inflate(box, CLEAR);
      return !solids.some((s) => meets(around, s)) && !placed.some((o) => meets(around, o)) && !ends.some(end => meets(around, end)) && !headers.some(header => meets(around, header)) && !runs.some((run) => (!onLine || run.edge !== e.index) && crosses(run, box)) && !groups.some((g) => straddles(around, g));
    };
    // 접은 배치(줄 바꿈)에서 elkjs는 되돌아오는 선의 라벨을 자기 선과 떨어진 모서리에 둔다. 자기 선 곁이 아닌 자리도 빈 자리로 보지 않는다.
    const own = e.points.slice(1).map((q, k) => ({ p: e.points[k], q, edge: e.index }));
    const isBeside = (at) => own.some((run) => crosses(run, inflate(boxAt(at, size), GAP + CLEAR)));
    // 재생 글과 충돌해 확보한 통로가 있으면 유효한 기존 자리를 보존한다.
    const keepLaneClear = (bounds.preserveLabelPlacement || bounds.sweep?.has(e.index)) && isFree(e.labelAt) && isBeside(e.labelAt);
    if (!keepLaneClear) e.labelAt = spotsAlong(e.points, size, bounds.preserveLabelPlacement, onLine).find(isFree) ?? e.labelAt;
    placed.push(boxAt(e.labelAt, size));
  }
}

// cost: time O(p·L/STEP), heap O(p·L/STEP), stack O(1)
// vars: p = 경로 구간 수, L = 구간 길이
// basis: estimate
// 경로 중앙에서 가까운 순서의 라벨 후보 자리. 세로 구간은 선 오른쪽과 왼쪽, 가로 구간은 선 위와 아래다. 라벨 앞 끝이 구간 위의 걸음 자리에 온다.
function spotsAlong(points, { w, h }, fromStart = false, onLine = false) {
  const spots = [];
  const total = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  let offset = 0;
  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1], points[k]];
    const isVertical = Math.abs(a.x - b.x) < SAME_POINT;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const sign = isVertical ? Math.sign(b.y - a.y) : Math.sign(b.x - a.x);
    const along = isVertical ? h : w;
    const first = (k > 1 ? Math.max(GAP, CORNER_CLEAR) : GAP) + along / 2;
    const last = length - (k < points.length - 1 ? Math.max(GAP, CORNER_CLEAR) : GAP) - along / 2;
    const leads = first <= last ? [Math.max(first, Math.min(last, total / 2 - offset))] : [];
    for (let lead = first; lead <= last; lead += STEP) leads.push(lead);
    for (const lead of leads) {
      const distance = Math.abs(offset + lead - (fromStart ? 0 : total / 2));
      if (onLine) spots.push({ x: isVertical ? a.x : a.x + sign * lead, y: isVertical ? a.y + sign * lead : a.y, distance });
      else if (isVertical) for (const side of [1, -1]) spots.push({ x: a.x + side * (GAP + w / 2), y: a.y + sign * lead, distance });
      else for (const side of [-1, 1]) spots.push({ x: a.x + sign * lead, y: a.y + side * (GAP + h / 2), distance });
    }
    offset += length;
  }
  return spots.sort((a, b) => a.distance - b.distance).map(({ x, y }) => ({ x, y }));
}

const boxAt = (at, { w, h }) => ({ x: at.x - w / 2, y: at.y - h / 2, w, h });
const inflate = (r, d) => ({ x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 });
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const holds = (outer, inner) => outer.x <= inner.x && outer.y <= inner.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
// 사각형이 그룹 테두리에 걸치는가: 그룹과 겹치지만 그룹 안에 다 들지 않는다.
const straddles = (box, group) => meets(box, group) && !holds(group, box);

// 선 구간 하나가 사각형 안쪽을 지나는가. 가로·세로 선은 폭이 0이라 범위 비교에 작은 여유를 더한다.
const CROSS_SLACK = 0.01;
function crosses({ p, q }, r) {
  const [x1, x2] = [Math.min(p.x, q.x), Math.max(p.x, q.x)];
  const [y1, y2] = [Math.min(p.y, q.y), Math.max(p.y, q.y)];
  return x1 < r.x + r.w && r.x < x2 + CROSS_SLACK && y1 < r.y + r.h && r.y < y2 + CROSS_SLACK;
}
