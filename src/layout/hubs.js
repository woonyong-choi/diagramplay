// cost: time O(n² + e), heap O(n + e), stack O(1)
// vars: n = 테이블 수, e = 관계 수
// basis: estimate
export function orientRelationHubs(model) {
  const neighbors = new Map([...model.nodes.keys()].map(id => [id, new Set()]));
  for (const edge of model.edges) {
    if (edge.from === edge.to) continue;
    neighbors.get(edge.from).add(edge.to);
    neighbors.get(edge.to).add(edge.from);
  }
  const ranks = hubRanks(neighbors);
  for (const edge of model.edges) {
    if (edge.from === edge.to) continue;
    const from = ranks.get(edge.from), to = ranks.get(edge.to);
    const isReversed = from > to || (from === to && neighbors.get(edge.from).size < neighbors.get(edge.to).size);
    for (const piece of model.pieces.get(edge.index)) piece.layoutReversed = isReversed;
    for (const [id, way] of [[edge.from, 'out'], [edge.to, 'in']]) {
      const node = model.nodes.get(id);
      const port = node.ports.find(port => port.id === `${id}::${way}::${edge.index}`);
      if (!port?.position) continue;
      const isEast = (way === 'out') !== isReversed;
      port.side = isEast ? 'EAST' : 'WEST';
      port.position = { ...port.position, x: isEast ? node.size.w : 0 };
    }
  }
}

function hubRanks(neighbors) {
  const remaining = new Set(neighbors.keys());
  const ranks = new Map();
  let depth = 0;
  while (remaining.size) {
    const root = [...remaining].reduce((best, id) => neighbors.get(id).size > neighbors.get(best).size ? id : best);
    let layer = [root];
    remaining.delete(root);
    while (layer.length) {
      const next = [];
      for (const id of layer) {
        ranks.set(id, depth);
        for (const neighbor of neighbors.get(id)) if (remaining.delete(neighbor)) next.push(neighbor);
      }
      depth++;
      layer = next;
    }
  }
  return ranks;
}
