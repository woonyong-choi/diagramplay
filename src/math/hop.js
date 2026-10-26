// 빌드(시간표와 움직이는 SVG)와 단일 HTML 재생기가 공유하는 이동 구간 수학. 함수 원문을 HTML에 넣으므로 바깥 모듈 값을 참조하지 않는다(motion-math.js와 같은 방식).
// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * @param timeAt motion-math.js의 timeAt(곡선, 길이 비율, pace) => 시간 비율. 빌드와 재생기가 같은 함수 원문을 넘긴다
 * @returns { hopLegs, fadeAt }
 */
export function hopMath(timeAt) {
  // cost: time O(l), heap O(l), stack O(1)
  // vars: l = 이동이 지나는 선 수
  // basis: estimate
  /**
   * 이동 하나가 각 선에 올라 있는 이동 시작 뒤 구간 { edge, from, to }(ms). 박자의 이동(hop.edge)은 선 하나에 이동 내내 있고,
   * 흐름의 점(hop.track)은 길 계획(legEdges)대로 구간마다 그 선에 있는 동안이며 도형 안을 지나는 이음(gaps)은 어느 선에도 속하지 않는다. 사라지는 점(cut)은 거기까지다.
   * 정본이 아닌 이동(선 번호나 이음이 없거나 어긋남)은 근사하지 않고 오류다.
   * @param move 이동 곡선 [x1, y1, x2, y2](토큰 `easing.move`)
   */
  function hopLegs(hop, move) {
    const end = hop.cut ?? hop.ms;
    const isTrack = hop.track !== undefined;
    const edges = isTrack ? hop.legEdges : [hop.edge];
    const gaps = hop.gaps ?? [];
    const isGap = (gap) => Array.isArray(gap) && gap.length === 2 && gap.every(Number.isFinite);
    if (!(hop.ms > 0 && Number.isFinite(hop.ms)) || !Array.isArray(edges) || !edges.length || !edges.every(Number.isInteger) || (isTrack && (gaps.length !== edges.length - 1 || !gaps.every(isGap)))) {
      throw new Error(`hop is not canonical: ${isTrack ? `track ${hop.track}` : `edge ${hop.edge}`}, ms ${hop.ms}, legEdges ${JSON.stringify(hop.legEdges)}, gaps ${JSON.stringify(hop.gaps)}`);
    }
    const spanOf = (k) => (isTrack ? [k === 0 ? 0 : gaps[k - 1][1], k === edges.length - 1 ? 1 : gaps[k][0]] : [0, 1]);
    const timeOf = (f) => (f <= 0 ? 0 : f >= 1 ? hop.ms : hop.ms * timeAt(move, f, hop.pace));
    return edges.flatMap((edge, k) => {
      const [from, to] = spanOf(k).map(timeOf);
      return from < end && from < to ? [{ edge, from, to: Math.min(to, end) }] : [];
    });
  }

  // cost: time O(k), heap O(1), stack O(1)
  // vars: k = 키 수
  // basis: estimate
  /** 이동 시작 뒤 t(ms)의 글 상자 숨김 불투명도. keys는 [시각, 값] 목록(시각 오름차순, 첫 키는 0)이고 키 사이는 시간에 선형이다. 키가 없으면 1이다. */
  function fadeAt(keys, t) {
    if (!keys?.length) return 1;
    const k = keys.findLastIndex(([at]) => at <= t);
    if (k < 0) return keys[0][1];
    if (k === keys.length - 1) return keys[k][1];
    const [[a, va], [b, vb]] = [keys[k], keys[k + 1]];
    return va + ((vb - va) * (t - a)) / (b - a);
  }

  return { hopLegs, fadeAt };
}
