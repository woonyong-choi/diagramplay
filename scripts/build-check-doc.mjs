// 검사 항목 목록으로 docs/design/figure-check.md와 docs/design/figure-quality.md의 "검사 항목" 구간을 다시 쓴다.
// 사용: node scripts/build-check-doc.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { CHECK_DOCS, DOC_END, DOC_START, renderCheckTable } from './lib/check-doc.mjs';

for (const { path, list } of CHECK_DOCS) {
  const doc = new URL(`../${path}`, import.meta.url);
  const text = readFileSync(doc, 'utf8');
  const start = text.indexOf(DOC_START);
  const end = text.indexOf(DOC_END);
  if (start < 0 || end < start) {
    process.stderr.write(`${doc.pathname}: put ${DOC_START} and ${DOC_END} where the check table goes\n`);
    process.exitCode = 1;
    continue;
  }
  const output = `${text.slice(0, start + DOC_START.length)}\n${renderCheckTable(list)}\n${text.slice(end)}`;
  if (!process.argv.includes('--check')) writeFileSync(doc, output);
  else if (output !== text) {
    process.stderr.write(`${doc.pathname}: generated table is stale\n`);
    process.exitCode = 1;
  }
}
