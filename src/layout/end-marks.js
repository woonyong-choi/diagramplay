// 다중성은 관계 양 끝에 둔다. 관계 설명과 삭제 정책은 중앙 라벨 배치가 맡는다.
import { STYLE, textBlock } from '../measure/texts.js';

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 표시 글자 수
// basis: estimate
/**
 * 선 끝 end('from' | 'to')의 표시 목록. { id, end, text, isPill, w, h }이고 id는 elkjs 라벨 id다.
 */
export function endMarks(edge, end) {
  const marks = [];
  const multiplicity = edge[`${end}Multiplicity`];
  if (multiplicity !== undefined) {
    const { w, h } = textBlock(multiplicity, { textW: Infinity, pad: 0, style: STYLE.meta });
    marks.push({ id: `end::${edge.index}::${end}`, end, text: multiplicity, isPill: false, w, h });
  }
  return marks;
}
