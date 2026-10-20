// 그룹 안 자식을 흐름 순서로 놓는다. 순환이 있을 때 어느 선이 되돌아가는 선이 될지를 선언 순서로 정하기 위해서다(docs/design/layout.md 되돌아가는 선).

// #390: 추가 ELK 후보는 최대 4개, 탐색 중 보존하는 부분 순서는 8개다. 작은 비순환 잎 그룹만 비교한다.
const ORDER_CANDIDATES = 4;
const BEAM_WIDTH = 8;
const GROUP_LIMIT = 16;
const NODE_LIMIT = 64;
const EDGE_LIMIT = 128;

// cost: time O(g·b·n³·(n + e)), heap O(b·n² + e), stack O(1)
// vars: g = 그룹 수, b = 고정 beam 폭, n = 그룹 자식 수(최대 16), e = 선 수
// basis: estimate
// 후보 모형의 자식 배열만 바꾼다. 원본 선언, 선 번호, 갈래 번호와 순환의 순서는 그대로다.
export function orderCompactGroups(model, variant) {
  if (model.nodes.size > NODE_LIMIT || model.edges.length > EDGE_LIMIT) return false;
  let changed = false;
  for (const c of model.containers.values()) {
    if (c.direction !== 'down' || c.hasBack || c.children.length > GROUP_LIMIT || c.children.some(id => !model.nodes.has(id))) continue;
    const children = new Set(c.children);
    const links = [...model.pieces.values()].flat().filter(p => p.container === c.id).map(p => [ownerOf(p.from), ownerOf(p.to)]).filter(([a, b]) => a !== b && children.has(a) && children.has(b));
    // 사슬과 연결 없는 카드는 기존 순서를 쓴다. 갈림과 합류가 함께 있을 때만 비교한다.
    if (!c.children.some(id => links.filter(([a]) => a === id).length > 1) || !c.children.some(id => links.filter(([, b]) => b === id).length > 1)) continue;
    const order = compactOrders(c.children, links)[variant];
    if (!order || order.every((id, i) => id === c.children[i])) continue;
    c.children = order;
    changed = true;
  }
  return changed;
}

export function compactOrderVariants() {
  return Array.from({ length: ORDER_CANDIDATES }, (_, i) => i);
}

function compactOrders(children, links) {
  let beam = [{ order: [], rank: [0, 0] }];
  for (let depth = 0; depth < children.length; depth++) {
    const next = [];
    for (const { order } of beam) {
      for (const id of children) {
        if (order.includes(id) || links.some(([a, b]) => b === id && !order.includes(a))) continue;
        const placed = [...order, id];
        // 미배치 목적지는 다음 층으로 보아 거리 하한을 잰다. 긴 공유 경로를 막도록 최장 거리를 먼저 비교한다.
        const spans = links.map(([a, b]) => placed.includes(a) ? (placed.includes(b) ? placed.indexOf(b) : placed.length) - placed.indexOf(a) : 0);
        next.push({ order: placed, rank: [Math.max(0, ...spans), spans.reduce((sum, span) => sum + span, 0)] });
      }
    }
    next.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1]);
    beam = next.slice(0, BEAM_WIDTH);
  }
  return beam.filter(({ order }) => order.some((id, i) => id !== children[i])).slice(0, ORDER_CANDIDATES).map(({ order }) => order);
}

// cost: time O(c² + a), heap O(c + a), stack O(c)
// vars: c = 그룹 하나의 자식 수, a = 그 그룹 안 선 조각 수
// basis: estimate
/**
 * 모든 그룹의 자식 순서를 정하고, 순환이 있는 그룹에 `hasBack`을 적는다. 선언 순서를 지키되 순환을 끊는 선(되돌아가는 선)만 거스르는 순서다.
 * elkjs의 `cycleBreaking.strategy: MODEL_ORDER`는 모델 순서를 거스르는 선만 뒤집으므로, 이 순서와 함께 쓰면 되돌아가는 선만 뒤집힌다.
 */
export function orderByFlow(model) {
  const arcs = new Map([...model.containers.keys()].map((k) => [k, []]));
  for (const list of model.pieces.values()) for (const p of list) arcs.get(p.container).push([ownerOf(p.from), ownerOf(p.to)]);
  // 그룹을 도형보다 앞에 모아 두었으므로 먼저 원본 줄 순서로 되돌린다. 줄이 없는 처음 점은 맨 앞, 끝 겹원은 맨 뒤다.
  const lineOf = (id) => {
    const node = model.nodes.get(id);
    if (node?.shape === 'start') return -1;
    if (node?.shape === 'final') return Number.MAX_SAFE_INTEGER;
    return node?.line ?? model.containers.get(id).line;
  };
  for (const c of model.containers.values()) {
    const { order, hasBack } = flowOrder([...c.children].sort((a, b) => lineOf(a) - lineOf(b)), arcs.get(c.id));
    c.children = order;
    c.hasBack = hasBack;
  }
}

// 연결점 아이디(`도형::way::선 번호`)는 그 연결점이 달린 도형이나 그룹으로 본다.
function ownerOf(id) {
  return id.split('::')[0];
}

// cost: time O(c² + a), heap O(c + a), stack O(c)
// vars: c = 자식 수, a = 선 조각 수
// basis: estimate
function flowOrder(children, links) {
  const known = new Set(children);
  const out = new Map(children.map((id) => [id, []]));
  for (const [from, to] of links) if (from !== to && known.has(from) && known.has(to)) out.get(from).push(to);
  const back = backArcs(children, out);
  const waiting = new Map(children.map((id) => [id, 0]));
  for (const [from, targets] of out) for (const to of targets) if (!back.has(`${from}>${to}`)) waiting.set(to, waiting.get(to) + 1);
  const order = [];
  const left = [...children];
  while (left.length) {
    const next = left.findIndex((id) => waiting.get(id) === 0);
    const [id] = left.splice(next, 1);
    order.push(id);
    for (const to of out.get(id)) if (!back.has(`${id}>${to}`)) waiting.set(to, waiting.get(to) - 1);
  }
  return { order, hasBack: back.size > 0 };
}

// cost: time O(c + a), heap O(c + a), stack O(c)
// vars: c = 자식 수, a = 선 조각 수
// basis: estimate
// 선언 순서대로 깊이 우선으로 따라가다 지금 따라가는 길 위의 도형으로 되돌아오는 선. 순환을 끊는 선이다.
function backArcs(children, out) {
  const back = new Set();
  const state = new Map();
  // cost: time O(c + a), heap O(c), stack O(c)
  // vars: c = 자식 수, a = 선 조각 수
  // basis: estimate
  const visit = (id) => {
    state.set(id, 'open');
    for (const to of out.get(id)) {
      if (state.get(to) === 'open') back.add(`${id}>${to}`);
      else if (!state.has(to)) visit(to);
    }
    state.set(id, 'done');
  };
  for (const id of children) if (!state.has(id)) visit(id);
  return back;
}
