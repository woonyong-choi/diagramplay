// Mermaid 원본 읽기. 머리말(frontmatter), 주석, 첫 줄의 그림 종류를 읽고 종류별 읽기에 넘긴다(docs/design/import.md Mermaid).
import { FAIL, skip, textOf } from './model.js';
import { readClass } from './mermaid-class.js';
import { readFlowchart } from './mermaid-flow.js';
import { readEr } from './mermaid-er.js';
import { readSequence } from './mermaid-sequence.js';
import { unquote } from './names.js';

// 그림 종류 낱말 → 읽기. flowchart와 graph는 같은 순서도다.
const READERS = {
  flowchart: readFlowchart,
  graph: readFlowchart,
  sequenceDiagram: readSequence,
  erDiagram: readEr,
  classDiagram: readClass,
};

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 원본 글자 수
// basis: estimate
/** Mermaid 원본 하나를 모형에 읽는다. 그림 종류를 모르면 그 줄의 오류다. */
export function readMermaid(text, model) {
  const lines = statements(text, model);
  const head = lines.shift();
  if (!head) {
    model.problems.error(1, 'there is no Mermaid diagram here. The first line names the diagram, such as flowchart TD', { code: FAIL });
    return;
  }
  const word = head.text.split(/\s+/)[0];
  const reader = Object.hasOwn(READERS, word) ? READERS[word] : undefined;
  if (!reader) {
    model.problems.error(head.line, `the Mermaid diagram "${word}" is not imported. Supported: flowchart, graph, sequenceDiagram, erDiagram, classDiagram`, { code: FAIL });
    return;
  }
  reader({ head, lines }, model);
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 원본 글자 수
// basis: estimate
// 의미 있는 줄 { text, line }. 앞뒤 공백은 지우고 안의 공백 연속은 한 칸으로 줄인다. `%%` 주석 줄은 버리고, `%%{...}%%` 설정과 머리말의 title 밖 설정은 경고한다.
function statements(text, model) {
  const raw = text.replace(/^﻿/, '').split(/\r?\n/);
  let start = 0;
  if (raw[0]?.trim() === '---') {
    const end = raw.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end > 0) {
      readFrontmatter(raw.slice(1, end), model);
      start = end + 1;
    }
  }
  const out = [];
  for (let i = start; i < raw.length; i++) {
    // 문장 안의 공백 연속은 공백 하나와 같은 뜻이다(글은 cleanText가 어차피 한 칸으로 줄인다). 한 칸으로 줄여 두면 문장 정규식이 긴 공백 위에서 되돌아가며 다시 맞춰 보지 않는다.
    const line = raw[i].trim().replace(/\s+/g, ' ');
    if (!line) continue;
    if (line.startsWith('%%{')) skip(model, i + 1, 'the Mermaid directive is not imported. Sizes and colors come from the design tokens');
    else if (!line.startsWith('%%')) out.push({ text: line, line: i + 1 });
  }
  return out;
}

// cost: time O(m), heap O(1), stack O(1)
// vars: m = 머리말 줄 수
// basis: estimate
// 머리말에서 title만 읽는다. 들여쓴 줄은 바로 위 키의 값이라 그 키와 함께 알린다.
function readFrontmatter(lines, model) {
  for (const [i, line] of lines.entries()) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const pair = /^([\w-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (pair?.[1] === 'title' && pair[2]) model.title = textOf(model, unquote(pair[2]), i + 2);
    else skip(model, i + 2, `the front matter "${pair?.[1] ?? line.trim()}" is not imported. DiagramPlay reads only title`);
  }
}
