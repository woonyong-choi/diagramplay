// 차트의 제목, 범례, 행 이름, 값 글자를 그린다. 종류마다 같은 글자 규칙을 한 곳에 둔다. 자리와 칸 폭은 chart/label-layout.js가 잰다.
import { TEXT_BACK_PAD, drawTextBack, textMarkup } from '../draw/texts.js';
import { measure } from '../measure/fonts.js';
import { centerBaseline, escapeXml, plainText, renderRich, roundCoord as r } from '../format/text.js';
import { hasEndLabels } from './end-labels.js';
import { headerLayout } from './label-layout.js';
import { drawLegend } from './legend.js';
import { markAttrs } from './marks.js';
import { PAD, SPACE, TEXT } from './metrics.js';

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 글자 수
// basis: estimate
/** 행 이름 글자. 세로 가운데 cy에 맞추고, right가 있으면 그 x에 오른쪽을 맞춰 값 축 바로 앞에 두며 없으면 왼쪽 여백에서 시작한다. */
export function labelText(label, cy, className, right) {
  const x = right === undefined ? `x="${PAD}"` : `x="${r(right)}" text-anchor="end"`;
  return `<text ${x} y="${r(centerBaseline(cy, TEXT['13']))}" class="${className}">${renderRich(label)}</text>`;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 행 k의 글자 묶음. 밝히지 않은 행에서 글자는 면(막대, 점)보다 덜 흐려야 읽히므로 `ink` class를 달아 따로 흐린다.
 * 계열 i를 주면 그 계열 묶음(`cs-i`) 안에 둬 계열을 드러낼 때 함께 나타난다.
 */
export function inkGroup(k, inner, i) {
  const body = i === undefined ? inner : `<g class="cs-${i}">${inner}</g>`;
  return `<g class="cr-${k} ink">${body}</g>`;
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 값 글자 수
// basis: estimate
/**
 * 값 글자. at.x에서 시작하거나 className의 `end`로 at.x가 오른쪽 끝이고, 세로 가운데 at.cy에 맞춘다.
 * mark가 있으면({ chart, id, raw, paint }) 글과 바탕 면에 프레임 표식 이름이 붙는다. 바탕 면은 `.b`, 글은 `.t`가 id 뒤에 붙는다.
 * 값이 바뀐 효과는 글자 뒤 바탕 면이 받는다: 원자료와 계열 칠(paint)은 바탕 면에만 붙고, 글자는 바뀐 값을 그대로 보인다.
 */
export function valueText({ x, cy }, text, className, mark) {
  const size = TEXT['11'];
  const width = measure(plainText(text), size, /ours|second/.test(className) ? 'numSemibold' : 'num');
  // 바탕 면은 한 줄 글 여백(TEXT_BACK_PAD.line)이다. 값 글자는 표식에서 spacing.1-5 떨어져 놓이므로 바탕 면이 표식을 덮지 않는다.
  const left = x - (className.includes('end') ? width : 0);
  const attrs = (suffix, isText) => (mark ? markAttrs(mark.chart, `${mark.id}${suffix}`, isText ? { isText } : { raw: mark.raw, paint: mark.paint }) : '');
  const back = drawTextBack({ x: left, y: cy - size / 2, w: width, h: size }, { pad: TEXT_BACK_PAD.line, late: className.includes('late'), attrs: attrs('.b', false) });
  return back + `<text x="${r(x)}" y="${r(centerBaseline(cy, size))}" class="${className}"${attrs('.t', true)}>${escapeXml(text)}</text>`;
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 글자 수
// basis: estimate
/**
 * 면 안에 적는 값 글자. 가운데 (x, cy)에 두고 면 위 글자색(paint.on)으로 읽힌다. fits가 거짓이면 자리는 두고 숨긴다(프레임 구조가 같다).
 * 누적 막대 조각이 쓴다.
 */
export function insideText(chart, { text, x, cy, paint, fits, id }) {
  return `<text x="${r(x)}" y="${r(centerBaseline(cy, TEXT['11']))}" text-anchor="middle" fill="${paint.on}" class="chart-seg-key late"${fits ? '' : ' visibility="hidden"'}${markAttrs(chart, id, { isText: true })}>${escapeXml(text)}</text>`;
}

// cost: time O(s·n), heap O(out), stack O(1)
// vars: s = 계열 수, n = 계열 이름 글자 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 제목, 부제, 계열 범례. bottom은 그림 영역이 시작하는 y다.
 * 글 자리는 chart/label-layout.js의 headerLayout이 정하고 이 함수는 그 글과 범례를 그린다.
 */
export function drawHeader(figure) {
  const { texts, bottom } = headerLayout(figure);
  const parts = texts.map((t) => textMarkup(t, { x: 0, y: 0 }));
  let y = bottom;
  // 끝 이름이 계열마다 이름을 직접 다는 차트(선, 계단, 면적의 둘 이상 계열)는 범례를 두지 않는다. 같은 이름을 두 번 적지 않고 그림 영역이 위로 넓어진다(Vega-Lite 끝 이름 예제와 같은 읽기).
  if (figure.chart.series.length && !hasEndLabels(figure)) {
    const legend = drawLegend(figure, y);
    parts.push(...legend.svg);
    y = legend.bottom;
  }
  return { svg: parts.join('\n'), bottom: y + SPACE["3"] };
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 이름 글자 수
// basis: estimate
/** 넓은 배치는 행 옆, 좁은 배치는 행 위에 이름을 둔다. */
export function rowName(label, { layout, k, top, cy, className = 'chart-label' }) {
  return layout.lines ? layout.lines[k].map((line, i) => labelText(line, top + TEXT['13'] / 2 + i * layout.lineHeight, className)).join('') : labelText(label, cy, className, layout.right);
}
