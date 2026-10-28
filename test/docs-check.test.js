// 문서 품질 검사(`--docs`)의 공개 계약 시험. docs/design/figure-quality.md 요구사항 표의 D1~D8이다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli, diagramplay, lineOf, snapshot, workspace } from './support.js';

// cost: time O(d), heap O(d), stack O(1), io 2
// vars: d = 진단 수
// basis: estimate
// 원본 하나를 --json으로 검사해 { status, diagnostics }를 돌려준다.
function run(t, source, args = ['--docs']) {
  const dir = workspace(t, { 'f.diagramplay': source });
  const result = cli(['check', 'f.diagramplay', '--json', ...args], { cwd: dir });
  const diagnostics = result.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return { status: result.status, diagnostics, stderr: result.stderr };
}

const codes = (t, source, args) => run(t, source, args).diagnostics.map((d) => d.code).filter((code) => code.startsWith('docs-'));
const has = (t, source, code) => codes(t, source).includes(code);

const chain = (count, head = '') => diagramplay(`${head}${Array.from({ length: count }, (_, i) => `box n${i} "카드${i}" badge="S"`).join('\n')}\n${Array.from({ length: count - 1 }, (_, i) => `n${i} -> n${i + 1}`).join('\n')}\n`);

test('D1 without --docs there is no document check, and a require line is only read for its syntax', (t) => {
  const missing = diagramplay('require "없는 글"\nbox a "가"\n');
  const plain = run(t, missing, []);
  assert.equal(plain.status, 0);
  assert.deepEqual(plain.diagnostics, []);
  for (const bad of ['require "가" "나"', 'require', 'require 가', 'require "가" or']) {
    const result = run(t, diagramplay(`${bad}\nbox a "가"\n`), []);
    assert.equal(result.status, 1, bad);
    assert.ok(result.diagnostics.every((d) => d.code === 'syntax' && d.line === 2), bad);
  }
  const twice = run(t, diagramplay('require "가" or "나"\nrequire "나" or "가"\nbox a "가"\n'), []);
  assert.deepEqual(twice.diagnostics.map((d) => [d.code, d.severity, d.line]), [['syntax', 'warning', 3]]);
});

test('D2 require finds table columns and chart rows, passes on one alternative, and fails on the line of a missing item', (t) => {
  const source = diagramplay(`
    require "pull_requests"
    require "merged_at"
    require "401" or "주간 머지"
    require "토큰 갱신"
    table pull_requests "pull_requests" {
      id bigint pk
      merged_at timestamp
    }
    chart c "추이" bar {
      x "건수(개)"
      series v "개수"
      row "주간 머지" v=3
    }
  `);
  const result = run(t, source);
  assert.equal(result.status, 1);
  const found = result.diagnostics.filter((d) => d.code === 'docs-15');
  assert.deepEqual(found.map((d) => [d.severity, d.line]), [['error', lineOf(source, 'require "토큰 갱신"')]]);
});

test('D3 a require line in a Markdown block is checked by md --docs and reported on the Markdown line', (t) => {
  const doc = '# 문서\n\n```diagramplay\ndiagramplay\nrequire "없는 글"\nbox a "가"\n```\n';
  const dir = workspace(t, { 'doc.md': doc });
  const before = snapshot(dir);
  const result = cli(['md', 'doc.md', '--docs', '--json'], { cwd: dir });
  assert.equal(result.status, 1);
  const [diagnostic] = result.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(diagnostic.code, 'docs-15');
  assert.equal(diagnostic.line, 5);
  assert.deepEqual(snapshot(dir), before);
  assert.equal(cli(['md', 'doc.md', '--json'], { cwd: dir }).status, 0);
});

test('D4 badges, look, highlights, names and line text', (t) => {
  const four = (extra = '') => diagramplay(`box a "가"${extra}\nbox b "나"\nstore c "다"\nexternal d "라"\na -> b\na -> c\na -> d\n`);
  assert.ok(has(t, four(' badge="API"'), 'docs-1'));
  assert.ok(!has(t, four(' badge="API"').replace('box b "나"', 'box b "나" badge="APP"').replace('store c "다"', 'store c "다" badge="DB"').replace('external d "라"', 'external d "라" badge="EXT"'), 'docs-1'));
  assert.ok(has(t, four(), 'docs-2'));
  assert.ok(!has(t, four(' tone=blue appearance=filled'), 'docs-2'));
  const three = diagramplay('box a "가" tone=blue appearance=filled\nbox b "나" tone=blue appearance=filled\nbox c "다" tone=blue appearance=outline\na -> b\na -> c\n');
  assert.ok(has(t, three, 'docs-3'));
  assert.ok(!has(t, three.replace(' tone=blue appearance=outline', ''), 'docs-3'));
  const named = (name, sub = '') => diagramplay(`box a "${name}"${sub ? ` "${sub}"` : ''} badge="S"\nbox b "나" badge="S"\na -> b\n`);
  assert.ok(has(t, named('주문 서비스가 재고와 결제를 함께 확인함'), 'docs-4'));
  assert.ok(has(t, named('주문', '재고와 결제와 배송 상태를 한 번에 모두 확인해 알려 준다'), 'docs-4'));
  assert.ok(!has(t, named('주문 서비스', '재고 확인'), 'docs-4'));
  const label = (text) => diagramplay(`box a "가" badge="S"\nbox b "나" badge="S"\na -> b "${text}"\n`);
  assert.ok(has(t, label('HTTPS POST 요청으로 주문 내용을 전달'), 'docs-5'));
  assert.ok(!has(t, label('주문 전달'), 'docs-5'));
});

test('D5 a chain folded two per row gets an aspect that gives rows of three; a vertical chain is not a fold', (t) => {
  const subtitled = (head) => chain(6, head).replace(/"카드(\d)" badge/g, '"카드$1" "설명 글 조금 길게" badge');
  const folded = run(t, subtitled('aspect 1\n'));
  const warning = folded.diagnostics.find((d) => d.code === 'docs-7');
  assert.ok(warning, JSON.stringify(folded.diagnostics));
  const [, suggested] = /"aspect (\d)"/.exec(warning.message) ?? [];
  assert.ok(suggested, warning.message);
  assert.ok(!has(t, subtitled(`aspect ${suggested}\n`), 'docs-7'));
  assert.ok(!has(t, `${chain(4)}view graph down\n`, 'docs-7'));
  assert.ok(has(t, `${chain(4, 'aspect 2\n')}n0 -> n3\n`, 'docs-8'));
  assert.ok(!has(t, chain(4, 'aspect 3\n'), 'docs-8'));
  const many = diagramplay(`${Array.from({ length: 13 }, (_, i) => `box n${i} "카${i}" badge="S"`).join('\n')}\n${Array.from({ length: 12 }, (_, i) => `n0 -> n${i + 1}`).join('\n')}\n`);
  assert.ok(has(t, many, 'docs-6'));
  assert.ok(!has(t, chain(5), 'docs-6'));
});

test('D6 width wide, groups chained like stairs, and cards with no lines', (t) => {
  assert.ok(has(t, chain(3, 'width wide\n'), 'docs-9'));
  assert.ok(!has(t, chain(3), 'docs-9'));
  const stairs = diagramplay(`${[0, 1, 2].map((i) => `group g${i} "묶음${i}" direction=down {\n  box n${i} "카${i}" badge="S"\n  box m${i} "드${i}" badge="S"\n}`).join('\n')}\nn0 -> m0\nm0 -> n1\nn1 -> m1\nm1 -> n2\nn2 -> m2\n`);
  assert.ok(has(t, stairs, 'docs-10'));
  const nested = diagramplay(`group all "전체" direction=down {\n${[0, 1, 2].map((i) => `  group g${i} "묶음${i}" {\n    box n${i} "카${i}" badge="S"\n  }`).join('\n')}\n}\nn0 -> n1\nn1 -> n2\n`);
  assert.ok(!has(t, nested, 'docs-10'));
  const loose = diagramplay('box a "가" badge="S"\nbox b "나" badge="S"\nbox c "다" badge="S"\nbox d "라" badge="S"\na -> b\n');
  assert.ok(has(t, loose, 'docs-11'));
  assert.ok(!has(t, loose.replace('a -> b\n', 'a -> b\nc -> d\n'), 'docs-11'));
});

test('D7 sequence messages and scenes, chart series, and text size in a 680px column', (t) => {
  const sequence = (scenes) => diagramplay(`person a "가"\nbox b "나"\nbox c "다"\nview sequence {\n  a\n  b\n  c\n}\n${scenes}`);
  const five = Array.from({ length: 5 }, (_, i) => `  a -> b "요청${i}"`).join('\n');
  assert.ok(has(t, sequence(`scene "하나"\n${five}\n`), 'docs-12'));
  assert.ok(!has(t, sequence('scene "하나"\n  a -> b "요청"\n  b -> c "전달"\n'), 'docs-12'));
  assert.ok(has(t, sequence('scene "하나"\n  a -> b "요청"\nscene "둘"\n  b -> c "전달"\n'), 'docs-13'));
  const series = (n) => diagramplay(`chart c "차트" bar {\n  x "값(개)"\n${Array.from({ length: n }, (_, i) => `  series s${i} "계열${i}"`).join('\n')}\n  row "가" ${Array.from({ length: n }, (_, i) => `s${i}=1`).join(' ')}\n}\n`);
  assert.ok(has(t, series(8), 'docs-14'));
  assert.ok(!has(t, series(7), 'docs-14'));
  const people = (n) => diagramplay(`${Array.from({ length: n }, (_, i) => `box p${i} "참여자 이름${i}"`).join('\n')}\nview sequence {\n${Array.from({ length: n }, (_, i) => `  p${i}`).join('\n')}\n}\nscene "하나"\n  p0 -> p1 "요청"\n`);
  assert.ok(has(t, people(8), 'docs-16'));
  assert.ok(!has(t, people(3), 'docs-16'));
});

test('D8 gallery and import refuse --docs; with --strict a document warning fails and nothing is written', (t) => {
  const dir = workspace(t, { 'f.diagramplay': chain(3, 'width wide\n') });
  for (const args of [['gallery', '.', '--docs'], ['import', 'f.diagramplay', '--docs']]) assert.equal(cli(args, { cwd: dir }).status, 2, JSON.stringify(args));
  const before = snapshot(dir);
  assert.equal(cli(['render', 'f.diagramplay', '--docs', '--strict'], { cwd: dir }).status, 1);
  assert.deepEqual(snapshot(dir), before);
  assert.equal(cli(['render', 'f.diagramplay', '--docs'], { cwd: dir }).status, 0);
  assert.equal(cli(['render', 'f.diagramplay', '--strict'], { cwd: dir }).status, 0);
});


test('NHN architecture keeps required content checks without arbitrary badge or element caps', async () => {
  const { buildFigure } = await import('../src/index.js');
  const { checkDocs } = await import('../src/compile/docs-check.js');
  const nodes = Array.from({ length: 13 }, (_, i) => `box a${i} "Action ${i}"`).join('\n');
  const result = await buildFigure(`diagramplay\nrequire "Missing requirement"\ngroup g "NKS" icon=nhn-group-nks {\n${nodes}\n}\n`);
  const diagnostics = await checkDocs(result);
  assert.ok(diagnostics.some(problem => problem.code === 'docs-15'));
  assert.ok(diagnostics.every(problem => !['docs-1', 'docs-2', 'docs-3', 'docs-6', 'docs-9'].includes(problem.code)));
});
