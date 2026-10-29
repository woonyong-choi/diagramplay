// 차트 그리기가 함께 쓰는 크기 상수와 색. 값은 모두 토큰에서 온다.
import { FIGURE_PAD } from '../measure/canvas.js';
import { SNAPSHOTS, categoryPaint } from '../color/palette.js';
import { tokens, values } from '@woonyong-choi/design-tokens/tokens.js';

export const SPACE = values.spacing;
export const SIZE = values.spacing.figure;
// 차트 글자 크기. 축, 눈금, 범례, 값, 이름이 모두 본문의 설명 단계(text.caption 13) 하나이고, 카드 안 글(measure/texts.js STYLE)과 chart.css가 같은 토큰을 읽는다.
export const TEXT = values.text.caption;
export const WIDTH = SIZE.chart.width;
export const BAR = SIZE.chart.bar;
export const ROW = SIZE.chart.row;
export const DOT = SIZE.chart.dot;
export const PAD = FIGURE_PAD;
export const CAP = SIZE.chart.cap;
// 내용이 닿는 오른쪽 끝. 왼쪽 여백(PAD)과 같은 여백을 오른쪽에도 둔다.
export const RIGHT = WIDTH - PAD;

// 산점도 점 가운데에서 이름 글자까지 거리
export const NAME_OFFSET = DOT + SPACE["1-5"];

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 계열 i의 범주 번호. main 계열이 0번이고 나머지는 계열 순서를 따라 1번부터다(main이 없으면 계열 번호 그대로).
 * 역할은 색을 정하지 않는다. 계열이 하나뿐인 차트(산점도 점)는 0번이다. 계열 수에 상한이 없다.
 */
function categoryIndex(chart, i) {
  const main = chart.series.findIndex((s) => s.role === 'main');
  if (chart.series.length <= 1 || main < 0) return Math.max(0, i);
  if (i === main) return 0;
  return i < main ? i + 1 : i;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 계열 번호 i의 범주 색과 구분 방법. 색 수를 넘으면 층이 오르고 무늬와 모양이 달라진다(color/palette.js). 판은 기본 1판이다. */
export function seriesPaint(chart, i) {
  const paint = categoryPaint(categoryIndex(chart, i));
  return isReference(chart, i) ? { ...paint, fill: tokens.color.data.reference, border: tokens.color.data.reference, ink: tokens.color['ui-muted'] } : paint;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 계획, 목표처럼 x마다 기대값을 갖는 계열인가. 공통 중립색과 점선으로 실제값과 구분한다. */
export const isReference = (chart, i) => chart.series[i]?.role === 'reference';

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 선과 범례 선분의 선 모양 class. 기대값 계열과 선 모양이 점선인 계열(3번 진한 회색)은 `chart-dashed`, 점점선인 계열(4번 연한 회색)은 `chart-dotted`, 실선은 빈 글이다.
 * 회색 둘은 색만으로 구분하지 않도록 선 모양과 직접 라벨을 함께 쓴다(토큰 `color.data.category-dash`).
 */
export function seriesDashClass(chart, i) {
  if (isReference(chart, i)) return 'chart-dashed';
  const { dash } = seriesPaint(chart, i);
  return { dashed: 'chart-dashed', dotted: 'chart-dotted' }[dash] ?? '';
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 밝은 면 색(노랑)은 바탕과 대비가 3에 못 미쳐 점이 같은 색 계열의 경계를 가진다. 층이 올라도 색 계열은 같으므로 판의 계열 목록에서 읽는다.
function isLightFamily(paint) {
  const { palette } = SNAPSHOTS[paint.revision];
  return palette[paint.index % palette.length].needsLabel;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 점과 범례 칸이 같은 계열의 경계를 가져야 하는 계열인가: 밝은 계열이고 실제값이다. 선과 범위선에는 쓰지 않는다(굵기가 계열마다 같다). */
function hasBoundary(chart, i) {
  return isLightFamily(seriesPaint(chart, i)) && !isReference(chart, i);
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 선, 계단, 범위선, 오차 막대의 획 색. 모든 계열이 같은 계열의 테두리 값이다. 굵기는 계열마다 같고 받침 선이 없다. */
export function seriesStroke(chart, i) {
  return seriesPaint(chart, i).border;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 점, 띠, 범례 점의 면 색. 밝은 계열은 밝은 원색 면이고 경계가 있으며, 나머지는 대비를 맞춘 같은 계열의 테두리 색이다. 기대값 계열은 테두리 색이다. */
export function seriesColor(chart, i) {
  const paint = seriesPaint(chart, i);
  return hasBoundary(chart, i) ? categoryPaint(categoryIndex(chart, i)).fill : paint.border;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 넓은 막대와 면은 원색의 밝기·색상각을 보존한 데이터 면 역할이다. */
export function seriesFill(chart, i) {
  return seriesPaint(chart, i).fill;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 경계는 색을 바꾸지 않고 같은 계열의 테두리 값이다. 밝은 노랑도 노란 계열을 지킨다. */
export function seriesOutline(chart, i) {
  return seriesPaint(chart, i).border;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 밝은 계열의 점은 밝은 바탕에서도 읽히도록 같은 계열의 경계를 가진다. */
export function seriesBoundary(chart, i) {
  return hasBoundary(chart, i) ? ` stroke="${seriesOutline(chart, i)}" stroke-width="${values["border-width"].tag}" style="--chart-boundary: ${seriesOutline(chart, i)}"` : '';
}
