// 그림 폭 규칙. viewBox는 내용 폭이고 SVG와 HTML은 자연 크기(viewBox 한 단위가 1px)보다 커지지 않는다. 캔버스는 배치 후보를 고르는 표시 상한이자 HTML 틀의 최대 폭이다. 배치는 본문 단 폭에 맞춘다(docs/design/layout.md 그림 비율).
import { values } from '@woonyong-choi/design-tokens/tokens.js';

/** 구조, 순서, 상태, 데이터 그림의 표시 상한. 배치 후보를 고를 때와 그림 검사 9·10번이 이 폭으로 잰다. */
export const CANVAS = values.spacing.figure["figure-canvas"];
/** 그림 머리 `width wide`를 쓴 그림의 표시 폭 상한이자 배치 목표 폭 */
const CANVAS_WIDE = values.spacing.figure["figure-canvas-wide"];
/**
 * 본문 단 폭. 기술 블로그 본문 단 폭을 토큰 `spacing.figure.chart.width`에서 읽는다(디자인 토큰의 이름이다).
 * 구조 그림의 배치는 이 폭 안에 들도록 방향을 돌리거나 접는다. 그 안에 든 그림은 본문 단에서 줄지 않아 가장 작은 글 토큰이 그대로 보인다.
 */
const COLUMN = values.spacing.figure.chart.width;
/** 그림 둘레 안쪽 여백. 배치가 내용 둘레에 같은 값을 둔다. 그림 폭이 내용 폭이라 이 여백이 캔버스의 빈 테두리 전부다. */
export const FIGURE_PAD = values.spacing["4"];
/**
 * 좁은 화면(`size.figure-compact-width`)에서 그림 컨테이너가 가지는 폭. 컨테이너는 화면 폭에서 좌우 바깥 여백(`spacing.6`)을 뺀 값이고 그림 안쪽에는 여백이 없다.
 * 좁은 배치의 그래프가 목표로 삼는 폭이다. 그래프가 이 폭을 넘으면 HTML은 틀 폭에 맞춰 줄여 보인다.
 */
export const COMPACT_WIDTH = values.spacing.figure["figure-compact-width"] - values.spacing["6"] * 2;
/** 보이는 가로세로 비율의 한도. 비율이 이 값이나 그 역수를 넘으면 그림이 읽히지 않는다. */
export const ASPECT_MAX = values.scale['aspect-max'];

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 본문에 삽입된 재생기(iframe)가 보는 틈 없는 보기 영역. 그림 둘레 안쪽 여백(FIGURE_PAD)을 작은 여백(`space.2`)만 남기고 걷어, 도형이 본문 글과 가까이 놓이고 같은 폭에서 글자가 덜 줄어든다.
 * @returns { x, y, w, h } viewBox 값
 */
export function tightView(width, height) {
  const inset = FIGURE_PAD - values.spacing["1"];
  return { x: inset, y: inset, w: width - inset * 2, h: height - inset * 2 };
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 그림의 캔버스 폭. `width wide`면 넓은 폭, 그 밖에는 그림 종류와 관계없이 표준 폭이다. 판은 자연 크기보다 커지지 않으므로 좁은 그림도 같은 틀 가운데에 제 크기로 놓인다. */
export const canvasOf = (figure) => (figure?.width === 'wide' ? CANVAS_WIDE : CANVAS);

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 구조 그림 배치가 들어갈 목표 폭. `width wide`면 넓은 폭(넓어도 된다는 뜻)이고 생략하면 본문 단 폭이다. */
export const layoutWidthOf = (figure) => (figure?.width === 'wide' ? CANVAS_WIDE : COLUMN);

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 그림이 본문에서 차지하는 가로세로 비율. 그림은 내용 폭으로 그려지지만 본문 단(column)보다 좁은 그림도 단 폭의 자리를 차지하므로 폭은 내용 폭과 단 폭 중 큰 쪽이다.
 * 좁고 긴 그림(451x986)은 내용 비율이 0.46이지만 680 단에서 차지하는 자리는 680x986이라 비율은 0.69다.
 */
export function displayRatio(width, height, column = COLUMN) {
  return Math.max(width, column) / height;
}
