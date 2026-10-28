// 배치 좌표와 연결점은 그대로 두고 장애물을 비킬 필요가 없는 우회만 없앤다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { headBox, placeTitles } from './titles.js';
import { settleLabels } from './labels.js';
import { CROWD, SAME_POINT } from './model.js';

// cost: time O(e·p²·(s + g + e·p) + e·check), heap O(s + g + e·p), stack O(1)
// vars: e = 선 수, p = 경로 점 수, s = 도형 수, g = 그룹 수, check = 기하 검사 시간
// basis: estimate
// 짧아진 경로마다 공통 검사를 다시 받아 라벨·그룹 제목·다른 선과의 간격이 유효한 변경만 채택한다.
export function shortcutScene(scene, model, isSound, figure) {
  let best = scene;
  for (let index = 0; index < best.edges.length; index++) {
    const edge = best.edges[index];
    if (edge.from === edge.to || edge.endpointLabels?.length || edge.fromCell || edge.toCell || edge.fromColumns || edge.toColumns || edge.points.length < 4) continue;
    const allowed = new Set();
    for (const end of [edge.from, edge.to]) {
      let parent = model.nodes.get(end)?.parent;
      while (parent) { allowed.add(parent); parent = model.containers.get(parent)?.parent; }
    }
    const boxes = [
      ...best.items.map(it => ({ x: it.x - (it.marginSide ?? 0), y: it.y - (it.marginTop ?? 0), w: it.w + (it.marginSide ?? 0) * 2, h: it.h + (it.marginTop ?? 0) + (it.marginBottom ?? 0) })),
      ...best.groups.filter(group => !allowed.has(group.id)),
      ...best.groups.filter(group => group.label).map(group => headBox(group, group.titleDx)),
    ];
    // 같은 출발·도착 도형의 끝 구간은 공통 검사에서 합류로 판정한다. 여기서 먼저 막으면 불필요한 U자 우회가 남는다.
    const others = best.edges.filter(other => other !== edge && other.from !== edge.from && other.to !== edge.to).flatMap(other => runs(other.points));
    const alternatives = [shorten(edge.points, boxes, others), ...nearRoutes(edge, best.items)].filter(points => cost(points) < cost(edge.points)).sort((a, b) => cost(a) - cost(b));
    for (const points of alternatives) {
      if (points.some(p => p.x < 0 || p.y < 0 || p.x > best.width || p.y > best.height) || runs(points).some(run => boxes.some(box => hits(run, box)) || others.some(other => crowds(run, other)))) continue;
      const candidate = { ...best, groups: best.groups.map(group => ({ ...group })), edges: best.edges.map((other, i) => ({ ...other, points: i === index ? points : other.points, labelAt: other.labelAt && { ...other.labelAt } })) };
      settleLabels(candidate.edges, candidate.items, candidate, candidate.groups);
      placeTitles(candidate.groups, candidate.edges, { sweep: model.sweep });
      if (isSound(figure, candidate, best)) { best = candidate; break; }
    }
  }
  return best;
}

// 그룹 경계의 우회를 거치지 않고 카드 바깥쪽에서 같은 연결점으로 드나드는 후보.
function nearRoutes(edge, items) {
  const start = edge.points[0], end = edge.points.at(-1);
  const normal = (p, id) => {
    const it = items.find(item => item.id === id);
    if (!it) return;
    return [{ x: -1, y: 0, d: Math.abs(p.x - it.x) }, { x: 1, y: 0, d: Math.abs(p.x - it.x - it.w) }, { x: 0, y: -1, d: Math.abs(p.y - it.y + (it.marginTop ?? 0)) }, { x: 0, y: 1, d: Math.abs(p.y - it.y - it.h - (it.marginBottom ?? 0)) }].sort((a, b) => a.d - b.d)[0];
  };
  const from = normal(start, edge.from), to = normal(end, edge.to);
  if (!from || !to) return [];
  const gaps = ['2', '4', '6', '8'].map(key => values.spacing[key]);
  return gaps.flatMap(aGap => gaps.flatMap(bGap => {
    const a = { x: start.x + from.x * aGap, y: start.y + from.y * aGap };
    const b = { x: end.x + to.x * bGap, y: end.y + to.y * bGap };
    return [compact([start, a, { x: a.x, y: b.y }, b, end]), compact([start, a, { x: b.x, y: a.y }, b, end])].filter(points => {
      const first = points[1], last = points.at(-2);
      return (first.x - start.x) * from.x + (first.y - start.y) * from.y > 0 && (last.x - end.x) * to.x + (last.y - end.y) * to.y > 0;
    });
  }));
}

function shorten(original, boxes, others) {
  let points = original;
  for (let i = 0; i < points.length - 2; i++) for (let j = points.length - 1; j > i + 1; j--) {
    const a = points[i], b = points[j];
    const alternatives = [[a, { x: a.x, y: b.y }, b], [a, { x: b.x, y: a.y }, b]];
    for (const route of alternatives) {
      const bridge = compact(route);
      if (runs(bridge).some(run => boxes.some(box => hits(run, box)) || others.some(other => crowds(run, other)))) continue;
      const candidate = compact([...points.slice(0, i), ...bridge, ...points.slice(j + 1)]);
      if (cost(candidate) < cost(points) && sameHeading(candidate, original)) { points = candidate; j = points.length; }
    }
  }
  return points;
}

function compact(points) {
  const out = [];
  for (const p of points) {
    if (out.length && p.x === out.at(-1).x && p.y === out.at(-1).y) continue;
    while (out.length > 1 && ((out.at(-2).x === out.at(-1).x && p.x === out.at(-1).x) || (out.at(-2).y === out.at(-1).y && p.y === out.at(-1).y))) out.pop();
    out.push(p);
  }
  return out;
}

function runs(points) { return points.slice(1).map((b, i) => ({ a: points[i], b })); }
function sameHeading(points, original) {
  const direction = (a, b) => `${Math.sign(b.x - a.x)},${Math.sign(b.y - a.y)}`;
  return direction(points[0], points[1]) === direction(original[0], original[1]) && direction(points.at(-2), points.at(-1)) === direction(original.at(-2), original.at(-1));
}
function cost(points) { return runs(points).reduce((sum, { a, b }) => sum + Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 0) + Math.max(0, points.length - 2) * values.spacing['4']; }
function hits({ a, b }, box) {
  // ELK 연결점의 반올림 여유는 연결점 검사와 같다. 경계 안쪽 0.5px까지 허용된 끝을 도형 침범으로 다시 거절하지 않는다.
  return Math.min(a.x, b.x) < box.x + box.w - SAME_POINT && box.x + SAME_POINT < Math.max(a.x, b.x) && Math.min(a.y, b.y) < box.y + box.h - SAME_POINT && box.y + SAME_POINT < Math.max(a.y, b.y);
}
function crowds(a, b) {
  if (a.a.x === a.b.x && b.a.x === b.b.x) return Math.abs(a.a.x - b.a.x) < CROWD && Math.max(Math.min(a.a.y, a.b.y), Math.min(b.a.y, b.b.y)) < Math.min(Math.max(a.a.y, a.b.y), Math.max(b.a.y, b.b.y));
  if (a.a.y === a.b.y && b.a.y === b.b.y) return Math.abs(a.a.y - b.a.y) < CROWD && Math.max(Math.min(a.a.x, a.b.x), Math.min(b.a.x, b.b.x)) < Math.min(Math.max(a.a.x, a.b.x), Math.max(b.a.x, b.b.x));
  return false;
}
