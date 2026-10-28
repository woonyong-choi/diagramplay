// 이름 없는 흐름 점과 태그의 색 순서. 공통 토큰에 고정한 첫 판을 읽는다.
import { tokens, values } from '@woonyong-choi/design-tokens/tokens.js';
const ref = tokens.color.data;
const raw = values.color.data;
const count = raw['category-revision'][1].family;
export const PALETTE = Object.freeze(Object.keys(raw['category-family']).sort((a, b) => a - b).slice(0, count).map(key => Object.freeze({
 family: raw['category-family'][key], fill: ref.category[key], border: ref['category-outline'][key], on: ref['category-on'][key],
})));
