// 카드 안에 보이는 내용(`show`와 값 줄)을 그린다. 내용마다 층을 하나씩 두고 박자가 보일 층을 고른다. 크기와 글 자리는 measure/content.js가 정한 그대로고, 글은 카드 머리와 같은 drawTexts가 그린다.
// 카드 면과 머리는 draw/card.js가 그리고, 이 파일은 그 면 안쪽에 놓이는 내용 면 하나와 그 위의 줄(태그 알약, 관계 그래프의 선과 알약)만 맡는다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { autoTone, toneColors } from '../color/tone.js';
import { roundCoord as r } from '../format/text.js';
import { faceOf, lookClass } from './look.js';
import { CORNER, rectOpen } from './surface.js';
import { drawTexts } from './texts.js';
import { hiddenAttr } from './visible.js';

const RADIUS = values.radius;
const contentLook = (layout) => layout.rows.map(({ row }) => faceOf(row)).find(({ tone }) => tone !== undefined) ?? faceOf({});

// cost: time O(t), heap O(t), stack O(1)
// vars: t = 태그 종류 수
// basis: estimate
/**
 * 그림 하나에서 태그 색을 고정하는 그릇. tone 없는 태그는 원본에 처음 나온 순서대로 범주 색 순서(color/tone.js autoTone)로 색을 받는다.
 * @param tagOrder 원본 시간 흐름에 처음 나온 순서의 tone 없는 태그 목록
 */
export function createTones(tagOrder = []) {
  const tones = new Map();
  const next = (tag) => tones.has(tag) || tones.set(tag, autoTone(tones.size));
  for (const tag of tagOrder) next(tag);
  return (row) => {
    if (row.tone) return toneColors(row.tone).fill;
    next(row.tag);
    return toneColors(tones.get(row.tag)).fill;
  };
}

// cost: time O(k·r·n), heap O(out), stack O(1)
// vars: k = 내용 수, r = 줄 수, n = 줄 글자 수, out = 만든 SVG 글자 수
// basis: estimate
/**
 * 내용 면과 내용 층을 그린다. 면은 내용이 들어온 박자에만 보이고, 내용이 없는 카드는 아무것도 그리지 않는다.
 * @param place { box, i, shown? }. box는 { x, y, w, h } 내용 면 자리, i는 도형 번호, shown은 처음부터 보이는 내용 번호다(재생기가 그리지 않는 장면 없는 문서, html/content.js)
 * @param paint { toneOf, decorate, glyphs, flashes }. decorate는 움직이는 SVG가 박자별 class를 넣는 함수
 */
export function drawContent(content, { box, i, shown }, { toneOf, decorate, glyphs, flashes }) {
  const layers = content.layouts
    .map((layout, k) => `<g id="n-${i}-c${k}" opacity="${k === shown ? 1 : 0}"${hiddenAttr(k === shown)} class="fl-layer${lookClass(contentLook(layout))} ${decorate('layer', i, k)}">${drawFace(layout, box)}${flashes?.card.get(`${i}:${k}`) ?? ''}${drawRows(layout, box, { toneOf, glyphs })}</g>`)
    .join('');
  return (
    `${rectOpen(box, CORNER.inner)} opacity="0" class="fl-card${shown === undefined ? '' : ' filled'} ${decorate('card', i)}"/>` +
    layers
  );
}

// cost: time O(r), heap O(1), stack O(1)
// vars: r = 줄 수
// basis: estimate
// 내용이 고른 모습(look.js faceOf). 그 내용의 줄 가운데 처음 고른 모습이 이 내용의 면이다. 칠하는 일은 CSS(draw/paint.js)가 하고, 윤곽 표현의 경계 선이 내용 면 밖으로 나가지 않게 반 선 굵기 안쪽에 그린다. 고르지 않았으면 빈 글이다.
function drawFace(layout, box) {
  const look = contentLook(layout);
  if (look.tone === undefined) return '';
  const inset = values["border-width"].thin / 2;
  return `${rectOpen({ x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: box.h - inset * 2 }, CORNER.inner - inset)} class="face${lookClass(look)}"/>`;
}

// cost: time O(r·n), heap O(out), stack O(1)
// vars: r = 줄 수, n = 줄 글자 수, out = 만든 SVG 글자 수
// basis: estimate
// 줄마다 태그 알약(있으면), 관계 그래프의 선과 알약(있으면), 그 줄의 글. 글(태그, 표시, 본문, 그래프 이름)은 모두 측정이 놓은 text다.
function drawRows(layout, box, { toneOf, glyphs }) {
  return layout.rows.map((laid) => {
    return `${laid.tag ? drawTag(laid, box, toneOf(laid.row)) : ''}${''}${drawTexts(laid.texts, box, glyphs)}`;
  }).join('');
}

// 태그 알약. 알약은 줄 첫 줄의 세로 가운데에 놓이고 자리는 측정이 정했다.
function drawTag({ tag }, box, tone) {
  return `<rect x="${r(box.x + tag.x)}" y="${r(box.y + tag.center - tag.h / 2)}" width="${r(tag.w)}" height="${tag.h}" rx="${RADIUS.sm}" fill="${tone}" fill-opacity="${values.opacity.tag}"/>`;
}
