import { values } from '@woonyong-choi/design-tokens/tokens.js';

const GAP = values.spacing['2'];

// cost: time O(n log n), heap O(n), stack O(1)
// vars: n = 메시지가 지나는 생명선 수
// basis: estimate
// 중앙에 가장 가까운 생명선 사이의 빈 구간을 고른다. 자기 호출은 별도 U턴 규칙을 쓴다.
export function sequenceLabelX(from, to, lifelines, width) {
  const [left, right] = [Math.min(from, to), Math.max(from, to)];
  const middle = (left + right) / 2;
  const cuts = [left, ...lifelines.filter(x => x > left && x < right), right].sort((a, b) => a - b);
  const candidates = cuts.slice(1).flatMap((end, index) => {
    const min = cuts[index] + GAP + width / 2;
    const max = end - GAP - width / 2;
    return min <= max ? [Math.max(min, Math.min(max, middle))] : [];
  });
  return candidates.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0] ?? from + Math.sign(to - from) * (GAP + width / 2);
}
