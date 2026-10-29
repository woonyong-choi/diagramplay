// 화살촉 부품. 모양은 `arrowMarker` 하나이고, 색은 마커 정의를 품은 요소(소유자)의 `color`를 상속한다. 마커는 자기를 쓰는 선이 아니라 정의된 자리에서 색을 받는다(context-stroke에 기대지 않는다).
// 소유자는 연결선 묶음 자신이라 묶음 안에 정의를 둔다(`edgeMarker`, 상태색이 묶음의 color를 따른다). 마커 크기는 `markerUnits=strokeWidth`라 몸통 굵기에 비례해 커진다. 그러면 마커 안 선도 같은 비율로 굵어져 이중으로 굵어지므로, 마커 안 선 굵기를 `VIEW / size`로 정규화해 어떤 몸통 굵기에서도 실제 굵기가 몸통과 같게 한다.
import { tokens, values } from '@woonyong-choi/design-tokens/tokens.js';
import { ARM_HALF, ARM_X, TIP_X, VIEW, markStroke } from '../measure/arrow.js';


// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 채운 삼각형 화살촉 마커 정의.
 * @param id 마커 id
 * @param size 마커 한 변이 몸통 굵기의 몇 배인지(토큰 `size.arrow.head`)
 */
function arrowMarker(id, size = values.spacing.figure.arrow.head) {
  const c = VIEW / 2;
  const d = `M ${ARM_X} ${c - ARM_HALF} L ${TIP_X} ${c} L ${ARM_X} ${c + ARM_HALF} Z`;
  return `<marker id="${id}" viewBox="0 0 ${VIEW} ${VIEW}" refX="${TIP_X}" refY="${c}" markerWidth="${size}" markerHeight="${size}" orient="auto-start-reverse" overflow="visible"><path class="fl-arrowhead" d="${d}" stroke-width="${markStroke(size)}"/></marker>`;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 관계선 묶음 안의 화살촉. 각 선의 색을 상속하므로 context-stroke 지원 여부에 의존하지 않는다. */
export function edgeMarker(edge, index) {
  if (edge.head === 'none' && !edge.relation) return { defs: '', attributes: '' };
  const relation = edge.relation;
  const shape = relation === 'inheritance' || relation === 'realization' ? 'triangle' : relation === 'aggregation' ? 'diamond-open' : relation === 'composition' ? 'diamond-filled' : 'arrow';
  if (relation === 'association') return { defs: '', attributes: '' };
  const id = `fl-${shape}-${index}`;
  const defs = shape === 'arrow' ? arrowMarker(id) : relationMarker(id, shape);
  const start = shape.startsWith('diamond') || edge.head === 'both';
  const end = !shape.startsWith('diamond') && edge.head !== 'none';
  return { defs: `<defs>${defs}</defs>`, attributes: `${start ? ` marker-start="url(#${id})"` : ''}${end ? ` marker-end="url(#${id})"` : ''}` };
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 클래스 관계 기호. 빈 삼각형과 빈 마름모는 바탕색을 유지하고 테두리만 선의 색을 따른다.
function relationMarker(id, shape) {
  const size = values.spacing.figure.arrow.head;
  const c = VIEW / 2;
  const triangle = `M ${TIP_X} ${c} L ${ARM_X} ${c - ARM_HALF} L ${ARM_X} ${c + ARM_HALF} Z`;
  const diamond = `M ${TIP_X} ${c} L ${VIEW / 2} ${c - ARM_HALF} L 0 ${c} L ${VIEW / 2} ${c + ARM_HALF} Z`;
  const fill = shape === 'diamond-filled' ? 'currentColor' : tokens.color.figure.canvas;
  return `<marker id="${id}" viewBox="0 0 ${VIEW} ${VIEW}" refX="${TIP_X}" refY="${c}" markerWidth="${size}" markerHeight="${size}" orient="auto-start-reverse" overflow="visible"><path d="${shape === 'triangle' ? triangle : diamond}" fill="${fill}" stroke="currentColor" stroke-width="${markStroke(size)}" stroke-linejoin="round"/></marker>`;
}
