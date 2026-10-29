// 시작 선언와 줄·낱말·이름 규칙. 공개 진입점은 buildFigure(원본) 하나이고, 거절은 줄 번호와 자리가 있는 진단으로만 본다.
// 시험 이름 첫 낱말(V1~V7)이 요구사항 번호이고, 번호와 계약의 대응은 docs/design/expression-coverage.md의 시험 번호 표에 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build, finalValue, findOne, diagramplay, reject, stillDom, textsOf, valueOf } from './support.js';

const CARD = 'box a "A"\n';

test('V1 the first statement is diagramplay without a version or options', async () => {
  const cases = [
    [CARD, 'missing-preamble', 1, 1],
    ['', 'missing-preamble', 1, 1],
    ['# only a comment\n', 'missing-preamble', 1, 1],
    [`diagramplay 2\n${CARD}`, 'invalid-preamble', 1, 13],
    [`diagramplay extra\n${CARD}`, 'invalid-preamble', 1, 13],
    ['diagramplay\n', 'invalid-preamble', 1, 1],
    [`diagramplay\n${CARD}diagramplay\n`, 'invalid-preamble', 3, 1],
  ];
  for (const [source, code, line, column] of cases) {
    const problems = await reject(source);
    assert.equal(problems.length, 1, JSON.stringify(source));
    assert.deepEqual([problems[0].code, problems[0].line, problems[0].column], [code, line, column], JSON.stringify(source));
  }
});

test('V1 comments, blank lines, a BOM and Windows line endings may surround the first declaration', async () => {
  for (const source of [`# note\n\ndiagramplay\n${CARD}`, `﻿diagramplay\n${CARD}`, `diagramplay\r\n${CARD.replace('\n', '\r\n')}`, `  diagramplay  # trailing\n${CARD}`]) {
    assert.deepEqual(textsOf(await stillDom(source)), ['A'], JSON.stringify(source));
  }
});

test('V2 no legacy adapter: old names and removed statements are plain syntax errors with no migration advice', async () => {
  const removed = [
    ['step "x"', 'unknown statement'],
    ['say a "x"', 'unknown statement'],
    ['flow right', 'unknown statement'],
    ['sequence', 'unknown statement'],
    ['speed 2', 'unknown statement'],
  ];
  for (const [line, expected] of removed) {
    const problems = await reject(`diagramplay\n${CARD}${line}\n`);
    assert.equal(problems.length, 1, line);
    assert.equal(problems[0].code, 'syntax');
    assert.equal(problems[0].line, 3, line);
    assert.equal(problems[0].column, 1, line);
    assert.ok(problems[0].message.includes(expected), problems[0].message);
  }
  for (const source of ['torso\nbox a "A"\n', 'mutoscope 2\nbox a "A"\n', 'muto 2\nbox a "A"\n', 'thinkflow\nbox a "A"\n']) {
    for (const problem of await reject(source)) assert.doesNotMatch(problem.message, /migrat|convert|upgrade|renam/i);
  }
  // 글이 둘인 장면 줄은 설명 글을 받지 않는다.
  const scene = await reject(diagramplay(`${CARD}scene "name" "description"\n  a -> a\n`));
  assert.ok(scene.some((p) => p.line === 3 && p.code === 'syntax'));
});

// #423: 통계 차트, 분석 플롯, 측정 보기, 비트·메모리 격자, 독립 상태도의 문법은 일반 오류다. 옮기는 안내나 별칭을 두지 않는다.
test('V2 removed chart, plot, trace, timing, grid and state statements are plain syntax errors', async () => {
  const base = 'box a "A"\nbox b "B"\na -> b\n';
  const cases = [
    ['chart c "C" bar {\n  series v "v"\n  row "r" v=1\n}\n', 5],
    ['trace t "T" unit=ms {\n  span s "S" lane=a at=0 dur=1\n}\n', 5],
    ['grid g "G" rows=1 cols=2 {\n  item x "x"\n}\n', 5],
    ['state s "S"\n', 5],
    ['start a\n', 5],
    ['final a\n', 5],
    ['view plot {\n  a\n}\n', 5],
    ['view time {\n  a\n}\n', 5],
    ['view timing {\n  a\n}\n', 5],
    ['scene "s"\n  reveal a\n', 6],
    ['box c "C" {\n  chart k "K" bar {\n  }\n}\n', 6],
  ];
  for (const [body, line] of cases) {
    const problems = await reject(diagramplay(`${base}${body}`));
    const hit = problems.find((p) => p.line === line);
    assert.ok(hit, `${body} -> ${JSON.stringify(problems)}`);
    assert.equal(hit.code, 'syntax', body);
    assert.match(hit.message, /unknown statement|a view is one of graph, sequence|a card body takes/, body);
    for (const problem of problems) assert.doesNotMatch(problem.message, /migrat|convert|upgrade|renam|removed/i, body);
  }
});

test('V3 words are separated by spaces: "->" and "=" need the documented spacing, and options cannot repeat', async () => {
  const cases = [
    ['box a "A"\nbox b "B"\na->b\n', 4],
    ['box a "A" icon = server\n', 2],
    ['box a "A" icon=nginx icon=postgresql\n', 2],
    ['box a "A" badge=api\n', 2],
    ['box a "A" badge="LB"tone=orange\n', 2],
    ['box a "A"\nbox b "B"\na -> b quiet=yes\n', 4],
    ['box a ""\n', 2],
    ['box a "   "\n', 2],
    ['box a "unterminated\n', 2],
    ['box a "bad \\q escape"\n', 2],
    ['box a "A" {\n', 2],
  ];
  for (const [body, line] of cases) {
    const problems = await reject(`diagramplay\n${body}`);
    assert.ok(problems.some((p) => p.line === line && p.code === 'syntax'), `${JSON.stringify(body)} -> ${JSON.stringify(problems)}`);
  }
});

test('V3 text escapes are exactly \\" and \\\\, and quotes may hold # and unicode', async () => {
  assert.deepEqual(textsOf(await stillDom(diagramplay(`box a "say \\"hi\\" \\\\ # 한글"\n`))), ['say "hi" \\ # 한글']);
});

test('V4 header lines come first, then declarations, then scenes; going back is an error and a repeated header too', async () => {
  const cases = [
    ['box a "A"\ntitle "late"\n', 3],
    ['title "one"\ntitle "two"\nbox a "A"\n', 3],
    ['box a "A"\nscene "s" mode=static\n  light a\nbox b "B"\n', 5],
    ['subtitle "x"\ntitle "y"\nbox a "A"\npace 2s\n', 5],
  ];
  for (const [body, line] of cases) {
    const problems = await reject(`diagramplay\n${body}`);
    assert.ok(problems.some((p) => p.line === line), `${JSON.stringify(body)} -> ${JSON.stringify(problems)}`);
  }
});

test('V5 ids are lower-case words joined by single hyphens; one name space covers cards, groups and values', async () => {
  for (const id of ['A', '1a', 'a-', 'a--b', '-a', 'a_b', 'é']) {
    const problems = await reject(`diagramplay\nbox ${id} "A"\n`);
    assert.ok(problems.some((p) => p.line === 2), id);
  }
  for (const id of ['a', 'a1', 'a-b', 'a-b-2']) await build(`diagramplay\nbox ${id} "A"\n`);
  const clashes = [
    'box a "A"\nbox a "B"\n',
    'box a "A"\nvalue a "n" from=0\n',
    'box a "A"\nvalue n "n" from=0\nvalue n "m" from=1\n',
    'box a "A"\ngroup a "G" {\n  box b "B"\n}\n',
  ];
  for (const body of clashes) {
    const problems = await reject(`diagramplay\n${body}`);
    assert.ok(problems.some((p) => /already used/.test(p.message)), body);
  }
});

test('V5 statement and option words can be ids, and a second word "->" makes any first word a move source', async () => {
  const source = diagramplay(`
    box data "D"
    box scene "S"
    value n "n" on=data from=0
    table row "R" {
      id bigint pk
    }
    scene -> data
    scene "go" mode=static
      scene -> data "send" set="n+1"
  `);
  const dom = await stillDom(source);
  for (const label of ['D', 'S', 'R']) assert.ok(textsOf(dom).includes(label), label);
  assert.equal(valueOf(dom, 'n'), '1');
});

test('V6 a mistyped name reports what exists and what was meant', async () => {
  const problems = await reject(diagramplay(`box codex "Codex"\nbox engine "E"\nengine -> cdex\n`));
  const unknown = problems.find((p) => /unknown card/.test(p.message));
  assert.ok(unknown);
  assert.equal(unknown.line, 4);
  assert.match(unknown.message, /Did you mean "codex"\?/);
  assert.match(unknown.message, /Declared: codex, engine/);
});

test('V6 every independent error is reported at once, in line order, with the same five fields', async () => {
  const problems = await reject(diagramplay(`box a ""\nbox b "B" badge=toolongbadge\nstep "x"\nbox c "C" icon = server\n`));
  assert.deepEqual(problems.map((p) => p.line), [2, 3, 4, 5]);
  assert.deepEqual(problems.map((p) => p.line), [...problems.map((p) => p.line)].sort((x, y) => x - y));
  for (const problem of problems) assert.deepEqual(Object.keys(problem).sort(), ['code', 'column', 'line', 'message', 'severity']);
});

test('V6 a malformed block header or a rejected name is one error: its inner lines and its group add none', async () => {
  const cases = [
    'unknown g {\n}\n',
    'class Bad "T" {\n  nonsense\n}\n',
    'table t "T" broken= {\n  id int\n}\n',
    'table users {\n  id int pk\n}\n',
    'table Bad "T" {\n  id int\n  pk (id)\n}\n',
    'table Bad "T" {\n  id int\n  unique (id)\n}\n',
    'table Bad "T" {\n  id int\n  fk (id) -> parent (id)\n}\n',
    'table users {\n  id int\n  pk (id)\n}\n',
    'api a {\n  id int\n}\n',
    'class k {\n  field n "int"\n}\n',
  ];
  for (const body of cases) assert.equal((await reject(diagramplay(body))).length, 1, body);
});

test('V6 each rejection names its real cause and counts what the limit counts', async () => {
  const cases = [
    ['class k "K" abstract=yes {\n  field x "int"\n}\n', 2, /abstract takes no value/],
    ['class k "K" {\n  field x "int" static=yes\n}\n', 3, /static takes no value/],
    ['box a "A"\nscene "s" mode=once\n  light a "x"\n', 4, /light takes names\. Found "x"/],
    ['decision s "S"\nvalue v "V" on=s\n', 3, /Put a value on box, external, store, person, table, api/],
    [`box a "A" badge="${'😀'.repeat(9)}"\n`, 2, /at most 8 characters\. Found 9/],
    ['box a "A"\nvalue v "V" on=a from=1000000000000000000000\n', 3, /under 1e15/],
  ];
  for (const [body, line, message] of cases) {
    const problems = await reject(diagramplay(body));
    assert.ok(problems.some((p) => p.line === line && message.test(p.message)), `${JSON.stringify(body)} -> ${JSON.stringify(problems)}`);
  }
});

test('V7 ports are card.part with exactly one dot; classes expose no ports and plain boxes have no parts', async () => {
  const base = `table t "T" {\n  id bigint pk\n}\nclass k "K" {\n  field n "int"\n}\nbox b "B"\n`;
  const cases = [
    ['b -> t.id.x\n', /card\.part/],
    ['b -> k.n\n', /not ports/],
    ['b -> b.part\n', /no parts/],
    ['b -> t.nope\n', /nope/],
  ];
  for (const [edge, message] of cases) {
    const problems = await reject(diagramplay(`${base}${edge}`));
    assert.ok(problems.some((p) => message.test(p.message)), `${edge} -> ${JSON.stringify(problems)}`);
  }
  await build(diagramplay(`${base}b -> t.id\n`));
});

// 소비자 조사 T-E14: 다른 문장의 오류가 독립적인 값 진단을 가리지 않는다.
test('V6 앞선 문법 오류가 keep과 set 진단을 숨기지 않는다', async () => {
  const source = diagramplay('box a "A"\nbox b "B"\nvalue n "N" on=a\na -> b\nbogus bad\nscene "시작"\nscene "다음" keep="missing"\n  a -> b set="n:=absent"\n');
  const problems = await reject(source);
  for (const name of ['bogus', 'missing', 'absent']) assert.ok(problems.some(p => p.message.includes(name)), name);
});

test('원인 하나가 else 진단으로 번지지 않는다', async () => {
  const orphan = await reject(diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s" mode=once\n a -> b else=a`));
  assert.equal(orphan.length, 1);
  assert.match(orphan[0].message, /else/);
});

// 문법 점검(docs/decisions/2026-10-16-one-form-per-meaning.md): 모르는 낱말의 제안과 다른 도구의 습관은 틀린 낱말 자리의 진단 하나로 알린다.
test('V6 an unknown statement, key, value, unit, or column names the closest word at its line and column', async () => {
  const base = 'box web "W"\nbox api "A"\nweb -> api\n';
  const cases = [
    ['bx db "DB"\n', 5, 1, 'box'],
    ['scen "s"\n', 5, 1, null, `${base}scen "s"\n`],
    ['box db "DB" tone=orang\n', 5, 18, 'orange'],
    ['box db "DB" apperance=filled\n', 5, 13, 'appearance'],
    ['view graph dwon\n', 5, 12, 'down'],
    ['view graph TD\n', 5, 12, 'down'],
    ['group g "G" direction=dwn {\n  box c "C"\n}\n', 5, 23, 'down'],
    ['group g "G" dashd {\n  box c "C"\n}\n', 5, 13, 'dashed'],
    ['scene "s" mode=lop\n  web -> api\n', 5, 16, 'loop'],
    ['scene "s"\n  web -> api time=800mss\n', 6, 3, '800ms'],
    ['scene "s"\n  web -> api time=2\n', 6, 3, '2s'],
    ['scene "s"\n  web -> api lost=60\n', 6, 3, '60%'],
    ['scene "s"\n  shw web "x"\n', 6, 3, 'show'],
    ['table t "T" {\n  id bigint pkk\n}\n', 6, 13, 'pk'],
    ['table t "T" {\n  user_id bigint pk\n}\nscene "s"\n  light t.userid\n', 9, 3, 'user_id'],
  ];
  for (const [body, line, column, word, whole] of cases) {
    const problems = await reject(diagramplay(whole ?? `${base}${body}`));
    const hit = problems.find((p) => p.line === line);
    assert.ok(hit, `${body} -> ${JSON.stringify(problems)}`);
    assert.equal(hit.column, column, `${body} -> ${JSON.stringify(hit)}`);
    assert.match(hit.message, new RegExp(`Did you mean "${(word ?? 'scene').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\?`), body);
    assert.doesNotMatch(hit.message, /\.$/, 'a message has no trailing period');
  }
});

test('V6 habits from Mermaid, D2, PlantUML, and CSS are rejected with the DiagramPlay form', async () => {
  const base = 'box a "A"\nbox b "B"\n';
  const cases = [
    ['a --> b\n', /Did you mean "->"/],
    ['a <- b\n', /b -> a/],
    ['a <-> b\n', /head=both/],
    ['a-->|go|b\n', /a -> b "go"/],
    ['C[Client]\n', /box c "Client"/],
    ['C["Client"]\n', /box c "Client"/],
    ['D{ok?}\n', /decision d "ok\?"/],
    ['graph TD\n', /no diagram-type line/],
    ['web: Web Server\n', /box web "Web"/],
    ['title: "x"\n', /title "x"/],
    ['a -> b: calls\n', /a -> b "calls"/],
    ['box c "C" class="bg-blue-500"\n', /tone=blue/],
    ['box c label="C"\n', /box c "C"/],
    ['box c Client App\n', /box c "Client App"/],
    ['box WebServer "W"\n', /web-server/],
    ["box c 'C'\n", /double quotes/],
    ['// note\n', /comment starts with "#"/],
    ['a -> b;\n', /one statement per line/],
    ['box c "C"\na -> b -> c\n', /then b -> c/],
    ['subgraph g\n', /group id "name"/],
    ['group g "G" border=dashed {\n  box c "C"\n}\n', /write dashed instead of border=dashed/],
    ['a -> b dashed=true\n', /dashed takes no value/],
  ];
  for (const [body, message] of cases) {
    const source = diagramplay(`${base}${body}`);
    const problems = await reject(source);
    assert.equal(problems.length, 1, `${body} -> ${JSON.stringify(problems)}`);
    assert.ok(problems[0].line >= 4 && problems[0].column >= 1, JSON.stringify(problems[0]));
    assert.match(problems[0].message, message, body);
  }
});

test('V5 a group border is dashed like an edge, and an on line may come before its value', async () => {
  const dom = await stillDom(diagramplay('group g "G" dashed {\n  box a "A"\n}\nbox b "B"\na -> b dashed\n'));
  const frame = findOne(dom, (n) => n.tag === 'rect' && /\bframe-box\b/.test(n.attrs.class ?? ''), 'group frame');
  assert.match(frame.attrs.class, /\bdashed\b/);
  assert.equal(await finalValue(diagramplay('box a "A"\nbox b "B"\na -> b\non b n+1\nvalue n "n" on=b from=0\nscene "s"\n  a -> b\n'), 'n'), '1');
});
