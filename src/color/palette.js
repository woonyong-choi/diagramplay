// 범주 색 도우미. 색 이름(color/tone.js)과 이름 없는 점·태그의 색 순서가 함께 쓴다. 값은 모두 토큰에서 오고, 계열 수는 토큰에 기록된 1판의 계열 수다.
// 계열 목록은 토큰에서 뒤에만 늘어난다. 늘어나면 `index % n`의 n이 바뀌어 기존 순서의 색이 달라지므로 1판의 앞쪽 개수만 쓴다.
import { tokens, values } from '@woonyong-choi/design-tokens/tokens.js';

/** 쓰는 판. 최신 판이 아니라 1판이다. */
const BASE_REVISION = 1;

// cost: time O(n log n), heap O(n), stack O(1)
// vars: n = 판이 쓰는 계열 수
// basis: estimate
/** 1판이 쓰는 앞쪽 계열 목록(토큰의 번호 순서). 칸은 `{ family, fill, border, on }`이고 색은 `var(--…)` 참조다. 1판 기록이 없거나 개수가 목록을 넘으면 던진다. */
function readPalette({ ref = tokens.color.data, raw = values.color.data } = {}) {
  const keys = Object.keys(raw['category-family']).sort((a, b) => a - b);
  const count = raw['category-revision']?.[BASE_REVISION]?.family;
  if (!Number.isInteger(count) || count < 1 || count > keys.length) throw new RangeError(`category-revision ${BASE_REVISION}: family must be a whole number from 1 to ${keys.length}`);
  return keys.slice(0, count).map((key) => Object.freeze({ family: raw['category-family'][key], fill: ref.category[key], border: ref['category-outline'][key], on: ref['category-on'][key] }));
}

/** 1판의 계열 목록. 기본 칠이다. */
export const PALETTE = Object.freeze(readPalette());
