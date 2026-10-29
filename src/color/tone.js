// 이름 있는 색(`tone=`, `fill=`, `stroke=`)과 이름 없는 점과 태그가 받는 색의 순서. 이름은 범주 색 도우미(color/palette.js)의 구분색 넷(orange, blue, gray, silver)뿐이다. 순서는 토큰이 정한다(주황이 메인 색과 같은 첫 계열).
// 이름 없는 색의 순서도 같은 도우미(categoryPaint)가 정한다. 상태(성공, 경고, 실패)는 색 이름이 아니라 상태 아이콘이 알린다.
import { PALETTE, categoryPaint } from './palette.js';

/** 표현(appearance)만 고르고 색을 고르지 않은 요소의 색. 구조를 뜻하는 진한 회색 계열이다. */
export const NEUTRAL = 'gray';
/** 색 이름 전부: 범주 계열(도우미의 1판 순서) */
export const TONES = Object.freeze(PALETTE.map(({ family }) => family));
if (!TONES.includes(NEUTRAL)) throw new RangeError(`the palette must include the ${NEUTRAL} family`);

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 이름 없이 n번째(0부터)로 받는 색 이름. 범주 번호와 같은 순서이고, 계열 수를 넘으면 계열이 한 바퀴 돈다(점과 태그에는 무늬가 없고 글이나 이름이 구분을 맡는다). */
export const autoTone = (n) => categoryPaint(n).family;

// cost: time O(f), heap O(1), stack O(1)
// vars: f = 계열 수
// basis: estimate
/** 색 이름의 { fill, ink, outline } 토큰 참조. 흐름 점과 태그의 면(fill), 그 위 글자(ink), 글 상자 윤곽(outline). */
export function toneColors(name) {
  const entry = PALETTE.find(({ family }) => family === name);
  if (entry) return { fill: entry.fill, ink: entry.on, outline: entry.border };
  throw new RangeError(`unknown tone: ${name}`);
}

const colorsOf = (pick) => Object.freeze(Object.fromEntries(TONES.flatMap((name) => (pick(toneColors(name)) === undefined ? [] : [[name, pick(toneColors(name))]]))));

/** 재생기가 쓰는 색 이름별 표: 점 면, 점 위 글자, 글 상자 윤곽 */
export const TONE_FILLS = colorsOf(({ fill }) => fill);
export const TONE_INKS = colorsOf(({ ink }) => ink);
export const TONE_OUTLINES = colorsOf(({ outline }) => outline);
