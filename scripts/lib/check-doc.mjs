// 검사 항목 목록을 문서 표로 쓴다. docs/design/figure-check.md(items.js)와 docs/design/figure-quality.md(docs-items.js)의 "검사 항목" 구간이 이 출력과 같아야 하고, 어긋나면 테스트가 실패한다.
import { DOCS_CHECKS } from '../../src/check/docs-items.js';
import { CHECKS } from '../../src/check/items.js';

export const DOC_START = '<!-- check-table:start -->';
export const DOC_END = '<!-- check-table:end -->';

const SEVERITY_NAMES = { error: '오류', warning: '경고' };

// cost: time O(c), heap O(c), stack O(1)
// vars: c = 검사 항목 수
// basis: estimate
/** 검사 항목 표(Markdown). 머리 줄, 구분 줄, 항목마다 한 줄이다. 기본은 그림 검사 목록이다. */
export function renderCheckTable(list = CHECKS) {
  const rows = list.map((c) => `| ${c.number} | \`${c.code}\` | ${c.title} | ${c.severity.map((s) => SEVERITY_NAMES[s]).join(', ')} | ${c.criterion} |`);
  return ['| 번호 | code | 검사 | 등급 | 기준 |', '|---|---|---|---|---|', ...rows].join('\n');
}

/** 표를 쓰는 문서와 그 목록. scripts/build-check-doc.mjs가 차례로 다시 쓴다. */
export const CHECK_DOCS = [
  { path: 'docs/design/figure-check.md', list: CHECKS },
  { path: 'docs/design/figure-quality.md', list: DOCS_CHECKS },
];
