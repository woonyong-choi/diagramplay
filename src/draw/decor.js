// 도형 윗줄과 그룹 제목 줄의 장식(아이콘, 글자 배지, 복제 개수 알약)과 단계별 상태 알약의 몸통(기호와 글자)을 그린다. 크기와 자리는 measure/decor.js가 정한 그대로다.
import { ratio } from '../format.js';
import { BADGE_STYLE, STATUS_GAPS, STATUS_ICON, STATUS_KINDS } from '../measure/pills.js';
import { markIcon } from '../icons/index.js';
import { centerBaseline, escapeXml, roundCoord as r } from '../text.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { iconBody } from '@woonyong-choi/design-tokens/ui/svg.mjs';
import { pillFace } from './pill.js';

const ICON_GRID = values.icon['size-small'];

// cost: time O(k), heap O(out), stack O(1)
// vars: k = 장식 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 장식 한 줄을 그린다.
 * @param decor measure/decor.js의 layoutDecor 결과
 * @param place { x, y, iconData, prefix }. x, y는 줄 왼쪽 위이고 prefix는 그린 아이콘의 문서 내 식별자다
 * @param glyphs 쓴 글자를 모으는 그릇
 */
export function drawDecor(decor, place, glyphs) {
  return decor.items
    .filter((item) => item.kind !== 'title')
    .map((item) => (item.kind === 'icon' ? drawIcon(item, place) : drawBadge(item, place, glyphs)))
    .join('');
}

// 아이콘. 24 격자 아이콘을 정사각 칸에 맞춰 넣는다. 내장 아이콘은 공통 도형과 색을 유지하며 사용자 SVG는 currentColor를 쓴다.
function drawIcon(item, { x, y, iconData, prefix }) {
  return drawSymbol(iconData, { x: x + item.x, y: y + item.y, size: item.w, prefix });
}

// 의미 아이콘(등록부 도형)은 자신의 실루엣에 면과 윤곽을 갖는다. 브랜드와 사용자 SVG에는 임의 배경을 붙이지 않는다. 두 가지 모두 같은 틀 맞춤(iconAt)을 쓴다.
function drawSymbol(iconData, { x, y, size, prefix }) {
  return `<g class="fl-symbol fl-symbol-${iconData.role}">${iconAt(iconData, { x, y, size, prefix })}</g>`;
}

// 내장 SVG의 격자 맞춤과 mask ID 분리는 공통 렌더러가 맡고, 사용자 SVG는 검증할 때 맞춘 격자를 쓴다.
function iconAt(iconData, { x, y, size, prefix }) {
  const body = iconData.svg ? iconBody(iconData.svg, { size: ICON_GRID, prefix }) : iconData.body;
  return `<g class="fl-icon" transform="translate(${r(x)} ${r(y)}) scale(${ratio(size / ICON_GRID)})">${body}</g>`;
}

// 글자 배지. 배지와 복제 개수가 같은 모양이고 면은 알약 부품(draw/pill.js)의 badge 변형이다.
function drawBadge(item, { x, y }, glyphs) {
  glyphs.add(item.text, BADGE_STYLE.face);
  const [left, top] = [x + item.x, y + item.y];
  return `<g class="fl-badge">${pillFace({ x: left, y: top, w: item.w, h: item.h }, 'badge')}<text x="${r(left + item.w / 2)}" y="${r(centerBaseline(top + item.h / 2, BADGE_STYLE.size))}" class="badge">${escapeXml(item.text)}</text></g>`;
}

// cost: time O(n), heap O(out), stack O(1)
// vars: n = 기호 SVG 글자 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 등록부(icons/index.js markIcon)의 흑백 표시 기호를 정사각 칸에 그린다. 색은 감싼 요소의 글자색이다. 상태 알약이 쓴다.
 * @param place { x, y, size, prefix, cls }. x, y는 칸 왼쪽 위, prefix는 기호 SVG 안 id 앞 글, cls는 묶음 class다
 */
function drawMonoIcon(name, { x, y, size, prefix, cls }) {
  return `<g class="${cls}" transform="translate(${r(x)} ${r(y)})">${iconBody(markIcon(name).svg, { size, monochrome: true, prefix })}</g>`;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 상태 알약 하나(면, 기호, 글자). 색은 감싼 묶음의 `fl-status-종류`가 정한다. 도형 모서리 알약과 타이밍 보기의 카드 줄 알약이 같은 몸통을 쓴다.
 * @param box 알약 사각형 { x, y, w, h }(measure/pills.js sizeStatus의 크기)
 * @param options { glyphs, prefix }. prefix는 기호 SVG 안 id 앞 글이다
 */
export function drawStatusPill({ x, y, w, h }, kind, { glyphs, prefix }) {
  const { icon, text } = STATUS_KINDS[kind];
  glyphs.add(text, BADGE_STYLE.face);
  const iconX = x + STATUS_GAPS.pad;
  const textX = iconX + STATUS_ICON + STATUS_GAPS.icon;
  return (
    pillFace({ x, y, w, h }, 'status') +
    drawMonoIcon(icon, { x: iconX, y: y + (h - STATUS_ICON) / 2, size: STATUS_ICON, prefix, cls: 'status-icon' }) +
    `<text x="${r(textX)}" y="${r(centerBaseline(y + h / 2, BADGE_STYLE.size))}" class="status-text">${text}</text>`
  );
}
