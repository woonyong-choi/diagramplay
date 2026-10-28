// 알약 부품. 선 라벨 알약, 선 번호 원, 장식 배지와 개수, 단계별 상태 알약이 같은 둥근 면 하나를 변형으로 그린다.
// 크기는 measure/pills.js가 정하고 색과 굵기는 변형 class를 공통 CSS(figure.css, status.css)가 정한다. 알약 안 글과 기호는 부르는 쪽(draw/connector.js, draw/decor.js)이 놓는다.
import { roundCoord as r } from '../format/text.js';

/** 변형마다 면의 class. 선 라벨(edge)은 움직이는 SVG가 박자 class를 덧붙인다. */
const VARIANTS = Object.freeze({ edge: 'pill', number: 'number-pill', badge: 'badge-pill', status: 'status-pill' });

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 알약 면 하나. 왼쪽 위 { x, y }와 크기 { w, h }이고 양 끝은 높이의 절반으로 둥글다.
 * @param variant VARIANTS의 이름
 * @param extra class 뒤에 덧붙일 글(박자 class, 켜짐 class)
 */
export function pillFace({ x, y, w, h }, variant, extra = '') {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(h / 2)}" class="${VARIANTS[variant]}${extra}"/>`;
}
