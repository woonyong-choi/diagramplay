// 문서 품질 검사(`--docs`)를 만든 그림 하나에 돌린다. 그림 검사 뒤에 compile/reported.js가 부른다. 보이는 글을 SVG에서 읽으므로 check/가 아니라 compile/에 둔다(docs/design/figure-quality.md).
import { createProblems } from '../source/problems.js';
import { toSvg } from '../svg/output.js';
import { graphViews, STRUCTURE_JUDGES } from '../check/docs.js';
import { checkColumn, checkRequires, checkWrappedChain, visibleTexts } from '../check/docs-text.js';
import { CHECKS } from '../check/items.js';

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 원본 글자 수
// basis: estimate
/** 원본의 aspect 줄을 바꾸거나, 없으면 시작 선언 바로 뒤에 넣은 원본 글. docs-7이 권할 값을 찾을 때 다시 배치하는 데 쓴다. */
export function withAspect(figure, aspect) {
  const lines = figure.source.split('\n');
  const eol = lines[0]?.endsWith('\r') ? '\r' : '';
  if (figure.aspectLine) lines[figure.aspectLine - 1] = `aspect ${aspect}${eol}`;
  else lines.splice(figure.line, 0, `aspect ${aspect}${eol}`);
  return lines.join('\n');
}

// cost: time O(judges + k·build + svg), heap O(svg), stack O(1)
// vars: judges = 구조 판정 비용, k = 다시 배치해 보는 aspect 수(최대 5), build = 그림 하나를 만드는 비용, svg = SVG 글자 수
// basis: estimate
/**
 * 만든 그림({ figure, scene, timeline })의 문서 품질 진단 목록(오류와 경고). 줄 번호는 원본 줄이다.
 * @param options { rebuild }. rebuild는 (aspect) => Promise<result | undefined>로 docs-7이 다시 배치할 때 쓴다
 */
export async function checkDocs(result, { rebuild } = {}) {
  const problems = createProblems(result.figure.source);
  const context = { ...result, views: graphViews(result) };
  const nhn = [...result.figure.nodes, ...result.figure.groups].some(item => item.iconData?.library === 'nhn-cloud');
  for (const { judge, stage } of CHECKS) if (stage === 'docs') judge?.(context, problems);
  for (const judge of STRUCTURE_JUDGES) judge(context, problems);
  if (rebuild && !nhn) await checkWrappedChain(result, rebuild, problems);
  // 보이는 글은 모든 장면의 글이 든 움직이는 SVG에서 읽는다. 요구 항목이 없으면 만들지 않는다.
  if (result.figure.requires?.length) checkRequires(result, visibleTexts(await toSvg(result, { scene: 0, isStatic: false, name: 'docs' })), problems);
  checkColumn(result, problems);
  const diagnostics = [...problems.errors, ...problems.warnings];
  // NHN 가이드는 모든 카드의 배지, 초점 수와 12개 개수 제한을 요구하지 않는다. 요구 항목과 실제 본문 읽힘 검사는 유지한다.
  const editorial = new Set(['docs-1', 'docs-2', 'docs-3', 'docs-6', 'docs-9']);
  return nhn ? diagnostics.filter(problem => !editorial.has(problem.code)) : diagnostics;
}
