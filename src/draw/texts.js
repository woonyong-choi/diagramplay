// 카드 안 글(measure/texts.js의 text)과 글 뒤 바탕 면(drawTextBack)을 그린다. 머리, 열, 제약, 클래스 멤버, 격자 칸, 내용 줄(태그, 본문, 표시, 값), 메모와 구획 제목, 차트 제목이 모두 이 함수 하나다.
// 글꼴과 색은 text의 역할(class)이 정하고, 글이 놓인 기준 점(anchor)은 text가 정한다. 그래서 같은 역할의 글은 어느 종류의 카드에서도 같은 모양이다.
// 글을 읽는 방식은 text의 글꼴(style.face)이 정한다: 고정폭이거나 값 글꼴이면 백틱도 글자이고, 그 밖에는 백틱 구간이 코드다(format/text.js codeParts). 재기와 같은 규칙이다.
import { KEY_GAP } from '../measure/texts.js';
import { centerBaseline, escapeXml, renderRich, roundCoord as r } from '../format/text.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';

const SPACE = values.spacing;
/**
 * 글 바탕 면의 여백 [좌우, 위아래]. line은 한 줄 글(값 글자, 시간 보기 구간 이름)로 좌우가 격자와 기준선이 글자 끝에 붙어 보이지 않을 만큼 넓고,
 * tight는 여러 줄 이름 상자(산점도 점 이름, 끝 이름)로 상자 둘레가 고르다. none은 부르는 쪽이 여백을 넣은 상자다(타이밍 화살표 글, 폭포 좁은 배치의 줄 가림).
 */
export const TEXT_BACK_PAD = Object.freeze({ line: [SPACE['1'], SPACE['0-25']], tight: [SPACE['0-25'], SPACE['0-25']], none: [0, 0] });

// cost: time O(t·n), heap O(out), stack O(1)
// vars: t = text 수, n = 글자 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * @param texts measure/texts.js의 text 목록
 * @param origin 도형 왼쪽 위 { x, y }. text 좌표는 이 점이 원점이다
 * @param glyphs 쓴 글자를 모으는 그릇
 */
export function drawTexts(texts, origin, glyphs) {
  return texts.map((t) => drawText(t, origin, glyphs)).join('');
}

/**
 * text 하나의 `<text>`. 쓴 글자를 그릇에 모은다.
 * @param extra { attrs?, inner? }. attrs는 여는 태그에 덧붙일 속성(값 글자의 data-v 등), inner는 글 뒤에 넣을 요소(움직임)다
 */
export function drawText(t, origin, glyphs, extra) {
  glyphs.add(t.text, t.style.face);
  if (t.key) glyphs.add(t.key.text, t.key.style.face);
  return textMarkup(t, origin, extra);
}

// cost: time O(n), heap O(out), stack O(1)
// vars: n = 글자 수, out = 만든 SVG 글자 수
// basis: estimate
/** 글자를 모으지 않고 `<text>`만 만든다. 차트처럼 글꼴 조각을 따로 모으는 그림이 쓴다. */
export function textMarkup({ role, text, style, x, center, anchor, underline, key, mutedFrom, lines }, origin, { attrs = '', inner = '' } = {}) {
  const left = r(origin.x + x);
  const tail = `${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}${underline ? ' text-decoration="underline"' : ''}${attrs}`;
  const mark = key ? `<tspan class="key" dx="${KEY_GAP}">${escapeXml(key.text)}</tspan>` : '';
  const body = lines ? lines.map((line, k) => `<tspan x="${left}" dy="${k === 0 ? 0 : style.line}">${renderRich(line, { face: style.face })}</tspan>`).join('') : renderRich(text, { face: style.face, mutedFrom });
  return `<text x="${left}" y="${r(centerBaseline(origin.y + center, style.size))}" class="${role}"${tail}>${body}${mark}${inner}</text>`;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 글 뒤 바탕 면. 차트가 놓인 면의 색(`chart-text-bg`, chart.css의 currentColor)이라 격자와 선이 글자를 지나지 않는다. 차트 값 글자, 이름, 시간·타이밍 보기의 글이 모두 이 부품을 쓴다.
 * @param box 글 상자 { x, y, w, h }
 * @param options { pad, rx, late, attrs }. pad는 TEXT_BACK_PAD의 값, rx는 모서리, late는 차트가 자란 뒤 나타나는 글(`late`), attrs는 덧붙일 속성(프레임 표식)이다
 */
export function drawTextBack({ x, y, w, h }, { pad = TEXT_BACK_PAD.none, rx, late = false, attrs = '' } = {}) {
  const [px, py] = pad;
  return `<rect x="${r(x - px)}" y="${r(y - py)}" width="${r(w + px * 2)}" height="${r(h + py * 2)}"${rx === undefined ? '' : ` rx="${rx}"`} class="chart-text-bg${late ? ' late' : ''}"${attrs}/>`;
}
