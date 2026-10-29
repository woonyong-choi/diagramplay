// 이름 있는 색(`tone=`, `fill=`, `stroke=`). 이름은 범주 색 도우미(color/palette.js)의 구분색 넷(orange, blue, gray, silver)뿐이다. 순서는 토큰이 정한다(주황이 메인 색과 같은 첫 계열).
// 이름 없는 흐름 점은 메인 주황, 이름 없는 태그는 무채색(NEUTRAL)이다. 상태(성공, 경고, 실패)는 색 이름이 아니라 상태 아이콘이 알린다.
import { PALETTE } from './palette.js';

/** 표현(appearance)만 고르고 색을 고르지 않은 요소의 색. 구조를 뜻하는 진한 회색 계열이다. */
export const NEUTRAL = 'gray';
/** 색 이름 전부: 범주 계열(도우미의 1판 순서) */
export const TONES = Object.freeze(PALETTE.map(({ family }) => family));
if (!TONES.includes(NEUTRAL)) throw new RangeError(`the palette must include the ${NEUTRAL} family`);


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
