// 문서 품질 검사의 글 판정(docs-15, docs-16)과 접힌 사슬(docs-7). 판정 함수와 항목 목록의 짝은 compile/docs-check.js가 정한다(docs/design/figure-quality.md).
import { LIMITS } from './docs-items.js';
import { chainLength, graphViews, widestRow } from './docs.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const say = (problems, n, severity = 'warn') => (line, message) => problems[severity](line, message, { code: `docs-${n}` });

// 띄어쓰기를 하나로 접는다. 요구 항목과 그림 글을 같은 꼴로 견주기 위해서다.
const fold = (text) => text.replace(/\s+/g, ' ').trim();

// cost: time O(n), heap O(n), stack O(1)
// vars: n = SVG 글자 수
// basis: estimate
/** SVG의 보이는 글(`<text>` 요소마다 한 덩어리). 줄로 나뉜 tspan은 띄어쓰기로 잇는다. `<title>`과 `<desc>`는 문서 캡션 자리라 넣지 않는다. */
export function visibleTexts(svg) {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => fold(m[1].replace(/<[^>]+>/g, ' ').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, name) => decodeEntity(name) ?? all)))
    .filter(Boolean);
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
function decodeEntity(name) {
  if (name[0] !== '#') return ENTITIES[name.toLowerCase()];
  const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
  return Number.isFinite(code) ? String.fromCodePoint(code) : undefined;
}

// cost: time O(r·a·t·n), heap O(1), stack O(1)
// vars: r = 요구 항목 수, a = 대안 수, t = 보이는 글 수, n = 글 길이
// basis: estimate
// docs-15: require 줄마다 대안 하나 이상이 보이는 글에 있다.
export function checkRequires({ figure }, texts, problems) {
  const fail = say(problems, 15, 'error');
  for (const { alternatives, line } of figure.requires ?? []) {
    if (alternatives.some((want) => texts.some((text) => text.includes(fold(want))))) continue;
    fail(line, `${alternatives.map((a) => `"${a}"`).join(' or ')} is not in the figure. Add it to a card or a line, or remove the require line`);
  }
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// docs-16: 본문 단 폭으로 줄인 가장 작은 그리는 글이 읽히는 가장 작은 글 이상이다.
export function checkColumn({ figure, scene }, problems) {
  if (scene.width <= LIMITS.column) return;
  const smallest = (LIMITS.smallestText * LIMITS.column) / scene.width;
  // 알리는 값(소수 첫째 자리)과 같은 값으로 견준다. 9.0px로 알리면서 경고하지 않기 위해서다.
  if (Math.round(smallest * 10) / 10 >= LIMITS.readable) return;
  say(problems, 16)(figure.line, `in a ${LIMITS.column}px document column the smallest text is ${smallest.toFixed(1)}px. Shorten names and subtitles, use fewer cards per row, or split the figure`);
}

// cost: time O(v·(s log s) + k·build), heap O(s), stack O(1)
// vars: v = 그래프 보기 수, s = 도형 수, k = 다시 배치해 보는 aspect 수(최대 5), build = 그림 하나를 만드는 비용
// basis: estimate
/**
 * docs-7: 접힌 사슬의 한 줄 칸 수가 적으면 경고한다. 권하는 aspect는 지금 값보다 큰 정수를 차례로 다시 배치해 찾는다.
 * @param rebuild (aspect) => Promise<result | undefined>. 그 aspect로 같은 원본을 다시 만든다. 만들 수 없으면 undefined다
 */
export async function checkWrappedChain(result, rebuild, problems) {
  const narrow = graphViews(result).find((entry) => chainLength(entry) && (widestRow(entry.items) ?? LIMITS.rowCards) < LIMITS.rowCards);
  if (!narrow) return;
  const rows = widestRow(narrow.items);
  const from = Math.max(1, Math.floor(result.figure.aspect ?? 1) + 1);
  let found;
  for (let aspect = from; aspect <= LIMITS.aspectMax && found === undefined; aspect++) {
    const tried = await rebuild(aspect);
    if (tried && fitsRows(tried)) found = aspect;
  }
  const fix = found === undefined ? 'Split the chain into two figures' : `Use "aspect ${found}" for rows of ${LIMITS.rowCards} or more`;
  say(problems, 7)(result.figure.aspectLine ?? result.figure.line, `the chain of ${narrow.items.length + narrow.dots.length} cards folds into rows of ${rows} cards. ${fix}`);
}

// cost: time O(s log s), heap O(s), stack O(1)
// vars: s = 도형 수
// basis: estimate
// 다시 배치한 그림의 모든 사슬이 한 줄(또는 접히지 않음)이거나 줄마다 3칸 이상이고, 그림 검사 10번 경고가 없다.
function fitsRows(result) {
  if (result.warnings.some((d) => d.code === 'check-10')) return false;
  return graphViews(result).every((entry) => !chainLength(entry) || (widestRow(entry.items) ?? LIMITS.rowCards) >= LIMITS.rowCards);
}
