// 그림 원본을 배치 모형으로 바꾼다. 그룹 나무, 도형, 선 조각을 만든다. 선 하나는 넘는 경계마다 조각 하나가 더해진다(docs/design/layout.md).
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { walkUp } from '../source/ancestry.js';
import { orderByFlow } from './order.js';
import { orientRelationHubs } from './hubs.js';
import { addPort, endpoint, fanColumnPorts, orientFlowPorts } from './ports.js';
/** 가장 바깥 그룹의 내부 이름. 원본 이름은 소문자, 숫자, `-`뿐이라 `_`가 든 이 이름과 부딪히지 않는다. */
export const ROOT = '__root';
/** 두 좌표가 같다고 보는 거리. 배치 읽기와 그림 검사가 같은 값을 쓴다. */
export const SAME_POINT = 0.5;
/** 같은 면의 선 끝이 이보다 가까워지면 붙어 보인다(그림 검사 5번). 배치도 이 값으로 선 끝을 비킨다. */
export const CROWD = values.spacing["1-25"];

// cost: time O(s + e·d), heap O(s + e·d), stack O(1)
// vars: s = 도형 수, e = 선 수, d = 그룹 깊이
// basis: estimate
/** 그룹 나무와 선 조각을 만든다. @returns { containers, nodes, edges, pieces } */
export function buildModel(figure, sizes) {
  const containers = buildContainers(figure);
  const nodes = new Map();
  for (const n of figure.nodes) {
    const parent = n.parent ?? ROOT;
    nodes.set(n.id, { ...n, size: sizes.get(n.id), ports: [], parent, direction: containers.get(parent).direction, isBracket: figure.isBracket === true });
    containers.get(parent).children.push(n.id);
  }
  const edges = figure.edges.map((edge, index) => ({ ...edge, index }));
  numberBranches(edges, nodes);
  const pieces = new Map();
  for (const edge of edges) pieces.set(edge.index, splitEdge(edge, nodes, containers));
  // sweep은 박자 이동 글 상자가 선 옆을 쓸고 지나는 폭 Map<선 번호, { x, y }>이다(chip/room.js). 배치 뒤 선 옆에 놓는 그룹 제목과 끝 라벨이 비킨다.
  const model = { containers, nodes, edges, pieces, status: figure.steps?.flatMap(step => step.status ?? []) ?? [], isSafe: figure.safeLayout === true, sweep: figure.chipSweep ?? new Map(), preserveLabelPlacement: figure.preserveLabelPlacement === true };
  orderByFlow(model);
  orientFlowPorts(model);
  if (figure.relationHubs) orientRelationHubs(model);
  fanColumnPorts(nodes);
  return model;
}

// cost: time O(e), heap O(e), stack O(1)
// vars: e = 선 수
// basis: estimate
// 갈림길에서 나가는 선마다 갈래 번호(선언 순서, 0부터)를 붙인다. 갈래 번호가 마름모의 어느 꼭짓점에서 나갈지를 정한다(ports.js).
function numberBranches(edges, nodes) {
  const counts = new Map();
  for (const edge of edges) {
    const node = nodes.get(edge.from);
    if (node?.shape !== 'decision') continue;
    const k = counts.get(node.id) ?? 0;
    counts.set(node.id, k + 1);
    edge.branch = k;
  }
}

// cost: time O(g·d), heap O(g), stack O(d)
// vars: g = 그룹 수, d = 그룹 깊이
// basis: estimate
function buildContainers(figure) {
  const containers = new Map([[ROOT, { id: ROOT, direction: figure.direction, parent: undefined, children: [], edges: [], ports: [] }]]);
  for (const g of figure.groups) containers.set(g.id, { ...decorOf(g), id: g.id, label: g.label, line: g.line, direction: undefined, own: g.direction, parent: g.parent ?? ROOT, children: [], edges: [], ports: [] });
  for (const g of figure.groups) containers.get(g.parent ?? ROOT).children.push(g.id);
  for (const c of containers.values()) c.direction = c.own ?? directionOf(c.parent, containers, figure);
  for (const c of containers.values()) c.parentDirection = c.parent ? containers.get(c.parent).direction : undefined;
  return containers;
}

// 그룹의 테두리 모양, 배지, 아이콘, 면과 테두리 색 선택 사항. 배치와 그리기가 그룹 이름으로 찾는 값이다.
export function decorOf({ dashed, badge, icon, iconData, tone, appearance }) {
  return { dashed, badge, icon, iconData, tone, appearance };
}

// cost: time O(d), heap O(d), stack O(1)
// vars: d = 그룹 깊이
// basis: estimate
function directionOf(parent, containers, figure) {
  const chain = walkUp(parent, (id) => containers.get(id).parent, containers.size);
  const owner = chain.find((id) => containers.get(id).own);
  return owner ? containers.get(owner).own : figure.direction;
}

// cost: time O(d), heap O(d), stack O(1)
// vars: d = 그룹 깊이
// basis: estimate
// 선을 두 끝의 가장 가까운 공통 그룹 안 조각과, 경계마다 연결점을 잇는 조각으로 나눈다.
function splitEdge(edge, nodes, containers) {
  const up = chain(edge.from, nodes, containers);
  const down = chain(edge.to, nodes, containers);
  const common = up.find((c) => down.includes(c)) ?? ROOT;
  const pieces = [];
  const flowOf = (id) => ({ direction: containers.get(common).direction, isCrossing: nodes.get(id)?.parent !== common });
  let from = endpoint(edge.from, { way: 'out', edge, flow: flowOf(edge.from) }, nodes);
  for (const g of up.slice(0, up.indexOf(common))) {
    const port = addPort(containers.get(g), 'out', edge);
    pieces.push({ container: g, from, to: port });
    from = port;
  }
  const inner = [];
  let to = endpoint(edge.to, { way: 'in', edge, flow: flowOf(edge.to) }, nodes);
  for (const g of down.slice(0, down.indexOf(common))) {
    const port = addPort(containers.get(g), 'in', edge);
    inner.unshift({ container: g, from: port, to });
    to = port;
  }
  pieces.push({ container: common, from, to, hasLabel: true });
  return [...pieces, ...inner];
}

// cost: time O(d), heap O(d), stack O(1)
// vars: d = 그룹 깊이
// basis: estimate
// 도형이나 그룹의 바깥 그룹 목록. 가장 안쪽부터다.
function chain(id, nodes, containers) {
  const list = [];
  const first = nodes.get(id)?.parent ?? containers.get(id)?.parent;
  for (let p = first; p; p = containers.get(p)?.parent) list.push(p);
  return list;
}
