
import { hasUnpairedBacktick, isLiteralFace } from '../format/text.js';
import { attachIcons } from '../icons/index.js';
import { checkLayoutWidth } from '../layout/graph.js';
import { findMissingGlyph } from '../measure/fonts.js';
import { STYLE } from '../measure/texts.js';
import { readFigure } from '../source/parse.js';
import { createProblems } from '../source/problems.js';
import { resolveBudget } from './budget.js';
import { buildScene } from './scene.js';

// cost: time O(n + elk + b·(e + s)), heap O(n + s + e), stack O(d), io 1
// vars: n = 원본 글자 수, elk = 배치 시간, b = 박자 수, e = 선 수, s = 도형 수, d = 그룹 깊이
// basis: estimate
/**
 * 원본을 장면과 시간표로 만든다.
 * @param strict 경고도 오류로 올린다
 * @param budget 올린 예산 { 이름: 값 }. 이름 없는 예산은 기본 한도다(src/compile/budget.js)
 * @param layoutWidth 명시적인 그래프 배치 목표 폭. 생략하면 자연 배치하고 화면 맞춤은 뷰어가 맡는다
 * @throws FigureError 원본 오류나 그림 검사 오류가 있을 때. 모든 문제를 담는다
 */
export async function buildFigure(source, { baseDir = '.', strict = false, budget, layoutWidth, allowFileAccess = true } = {}) {
  const limits = resolveBudget(budget);
  const problems = createProblems(source);
  const figure = readFigure(source, problems);
  checkLayoutWidth(figure, layoutWidth, problems);
  if (!allowFileAccess) {
    for (const set of figure.iconSets) problems.error(set.line, 'file-based icon sets are not allowed in embedded documents');
    problems.throwIfAny();
  }
  checkGlyphs(figure, problems);
  attachIcons(figure, baseDir, problems);
  problems.throwIfAny();
  const built = await buildScene(figure, { source, limits, layoutWidth }, problems);
  return finish({ figure, ...built }, problems, { strict });
}

// cost: time O(elk + check + n), heap O(n + s + e), stack O(d)
// vars: elk = 배치 시간, check = 그림 검사 시간, n = 시간표 크기, s = 도형 수, e = 선 수, d = 그룹 깊이
// basis: estimate
/**
 * @param layoutWidth 그래프 보기의 배치 목표 폭(그래프 보기가 있을 때만)
 */
export async function reflowFigure(reference, { layoutWidth, strict = false, budget } = {}) {
  const { figure } = reference;
  const problems = createProblems();
  checkLayoutWidth(figure, layoutWidth, problems);

  const limits = resolveBudget(budget);
  const built = await buildScene(figure, { limits, layoutWidth, reference }, problems);
  return finish({ figure, ...built }, problems, { strict });
}

// cost: time O(w), heap O(w), stack O(1)
// vars: w = 경고 수
// basis: estimate
// 경고(strict)를 오류로 올리고, 오류가 없으면 남은 진단과 함께 돌려준다.
function finish(result, problems, { strict }) {
  for (const d of strict ? problems.warnings : []) problems.error(d.line, d.message, { code: d.code, column: d.column });
  problems.throwIfAny();
  return { ...result, warnings: problems.warnings };
}

// cost: time O(n), heap O(t), stack O(d)
// vars: n = 문서 모형의 글 글자 수, t = 글 수, d = 모형 깊이
// basis: estimate
// 그림 글꼴에 없는 글자를 줄 번호와 함께 알린다. 대신 그릴 글꼴의 폭을 알 수 없기 때문이다.
// 모형의 글은 그려지는 역할의 글꼴로 한 번만 본다(LITERAL_KEYS: 클래스 멤버, 열 형식, mono 줄, 값 글. 나머지는 산문). 산문은 백틱 구간이 코드라서 짝이 안 맞으면 오류이고,
// 글 그대로 읽는 글(format/text.js isLiteralFace)은 백틱도 글자라 홀수 개여도 받는다. 글 종류를 빠뜨리지 않기 위해 모형 전체를 훑는다.
function checkGlyphs(figure, problems) {
  const texts = [];
  for (const key of ['nodes', 'groups', 'edges', 'views', 'values', 'steps']) collectTexts(figure[key], figure.line ?? 1, texts, { owner: key });
  for (const text of [figure.title, figure.subtitle]) collectTexts(text, figure.line ?? 1, texts);
  const reported = new Set();
  for (const [text, line, face] of texts) {
    if (!isLiteralFace(face) && hasUnpairedBacktick(text) && !reported.has(`${line}\u0000${text}`)) {
      reported.add(`${line}\u0000${text}`);
      problems.error(line, `the backticks in "${text}" are not paired. Close the code span with a second backtick`);
    }
    const missing = text ? findMissingGlyph(text, face) : undefined;
    if (missing === undefined || reported.has(`${line}\u0000${missing}`)) continue;
    reported.add(`${line}\u0000${missing}`);
    problems.error(line, `the font has no glyph for "${missing}". Remove the character`);
  }
}

// cost: time O(n), heap O(t), stack O(d)
// vars: n = 모형 원소 수, t = 글 수, d = 모형 깊이
// basis: estimate
function collectTexts(value, line, out, { owner, face = PROSE_FACE } = {}, seen = new Set()) {
  if (typeof value === 'string') out.push([value.replaceAll('\u0000', ' '), line, face]);
  else if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    const own = typeof value.line === 'number' ? value.line : line;
    if (Array.isArray(value)) for (const item of value) collectTexts(item, line, out, { owner, face }, seen);
    else for (const [key, item] of Object.entries(value)) collectTexts(item, own, out, { owner: key, face: faceOfKey(owner, value, key) }, seen);
  }
}

// 모형에서 산문이 아닌 글의 자리: 담고 있는 키 → 글 키 → 그려지는 역할의 글꼴. 클래스 멤버의 표기, 표·API 열 형식, 값 글은 글 그대로 그린다.
const LITERAL_KEYS = {
  members: { id: STYLE.mono.face, signature: STYLE.mono.face },
  columns: { type: STYLE.type.face },
  values: { from: STYLE.value.face },
  sets: { operand: STYLE.value.face },
};
const PROSE_FACE = STYLE.row.face;

// 글 키가 그려지는 글꼴. `show ... mono` 줄(row)의 글과 덧붙임도 고정폭 글꼴이다.
function faceOfKey(owner, parent, key) {
  if (owner === 'row' && parent.isMono && (key === 'text' || key === 'meta')) return STYLE.mono.face;
  return LITERAL_KEYS[owner]?.[key] ?? PROSE_FACE;
}

