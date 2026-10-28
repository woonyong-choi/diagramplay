// 한 문서의 카드 모형: 연결점(표 열, API 칸, 격자 칸, 추적 구간), 카드가 여러 보기에 함께 놓이는 일, 보기 규칙.
// 시험 이름 첫 낱말(S1~S11)이 요구사항 번호이고, 번호와 계약의 대응은 docs/design/expression-coverage.md의 시험 번호 표에 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measure } from '../src/measure/fonts.js';
import { STYLE } from '../src/measure/texts.js';
import { build, descendants, diagramplay, EXAMPLES, findAll, lineOf, parseMarkup, read, reject, stillDom, textContent, textsOf, toHtml, toSvg } from './support.js';

test('S4 a table foreign key becomes an edge between the two columns, to a key column only, and a column cannot reference itself', async () => {
  const doc = (child) => diagramplay(`table users "users" {\n  id bigint pk\n  name text\n}\ntable orders "orders" {\n  id bigint pk\n  ${child}\n}\n`);
  await build(doc('user_id bigint fk=users.id'));
  const cases = [
    [doc('user_id bigint fk=users.name'), 'user_id', /fk must point to a pk or unique column/],
    [doc('user_id bigint fk=users.zz'), 'user_id', /unknown column in "users" "zz"/],
    [doc('user_id bigint fk=nope.id'), 'user_id', /unknown table "nope"/],
    [diagramplay('table orders "orders" {\n  id bigint pk fk=orders.id\n}\n'), 'fk=orders.id', /cannot go from "orders.id" to itself/],
  ];
  for (const [source, needle, message] of cases) {
    const problems = await reject(source);
    assert.ok(problems.some((p) => p.line === lineOf(source, needle) && message.test(p.message)), `${needle}: ${JSON.stringify(problems)}`);
  }
  const contradictory = diagramplay(`table t "t" {\n  id bigint pk nullable\n}\n`);
  assert.ok((await reject(contradictory)).some((p) => p.line === lineOf(contradictory, 'id bigint')));
});

test('S4 table relations and foreign keys share endpoint labels (multiplicity, delete policy) without inferring constraints', async () => {
  const tables = (column = 'owner bigint') => diagramplay(`
    table users "users" {
      id bigint pk
      name text
    }
    table orders "orders" {
      id bigint pk
      ${column}
    }
  `);
  for (const source of [
    `${tables()}orders.owner -> users.name from="0..*" to="1"\n`,
    `${tables()}orders -> users relation=association from="0..*" to="1"\n`,
    tables('owner bigint fk=users.id from="0..*" to="1"'),
  ]) {
    const result = await build(source);
    const dom = parseMarkup(await toSvg(result, { isStatic: true }));
    for (const edge of result.scene.edges) for (const label of edge.endpointLabels ?? []) {
      assert.equal(label.w, measure(label.text, STYLE.pill.size, STYLE.pill.face), 'multiplicity reserves only its rendered text width');
      assert.equal(label.h, STYLE.meta.line);
    }
    const labels = findAll(dom, (node) => node.tag === 'text' && node.attrs.class?.includes('fl-end-label'));
    assert.deepEqual(labels.map((node) => [node.attrs['data-end'], textContent(node)]), [['from', '0..*'], ['to', '1']]);
    assert.ok(findAll(dom, (node) => node.attrs['aria-label']?.includes('orders [0..*]')).length);
  }
  // 자기 참조 외래 키: 양 끝이 카드 오른쪽 면이고, 다중성 표시는 각자 닿는 열 줄 높이에 놓인다.
  const self = await build(diagramplay(`
    table users "users" {
      id bigint pk
      name text
      referrer_id bigint fk=users.id from="*" to="1"
    }
  `));
  const [loop] = self.scene.edges;
  const card = self.scene.items.find((it) => it.id === 'users');
  assert.ok([loop.points[0], loop.points.at(-1)].every((p) => Math.abs(p.x - (card.x + card.w)) < 1), 'self reference leaves and enters the right side');
  assert.deepEqual(loop.endpointLabels.map((l) => [l.end, l.y]), [['from', loop.points[0].y], ['to', loop.points.at(-1).y]]);
  assert.equal(findAll(await stillDom(tables('owner bigint fk=users.id')), (node) => node.attrs.class?.includes('fl-end-label')).length, 0);
  // 한 열은 한 줄: NULL 허용 여부는 키 표시 뒤의 작은 표시이고, 삭제 정책은 참조하는 열 쪽 끝의 선 위 알약이다. 다중성 글은 선 옆에 그대로 선다.
  const policy = await build(tables('owner bigint fk=users.id required ondelete=cascade from="0..*"'));
  const orders = policy.scene.items.find((it) => it.id === 'orders');
  assert.deepEqual(orders.tableRows.map((row) => row.h), orders.tableRows.map(() => orders.tableRows[0].h), 'every column is one row');
  assert.equal(orders.tableRows.find((row) => row.id === 'owner').texts[0].key.text, 'FK NN');
  const [fk] = policy.scene.edges;
  assert.deepEqual(fk.endpointLabels.map((l) => [l.end, l.text, l.isPill]), [['from', '0..*', false]]);
  assert.equal(fk.label, 'CASCADE', 'the delete policy uses the ordinary centered relationship label');
  const pills = findAll(parseMarkup(await toSvg(policy, { isStatic: true })), (node) => node.attrs.class === 'fl-pill');
  assert.deepEqual(pills.map((node) => textContent(node)), ['CASCADE']);
  for (const [source, needle, message] of [
    [`${tables()}orders -> users from="2..1"\n`, 'orders -> users', /invalid multiplicity/],
    [`${tables()}orders -> users relation=inheritance\n`, 'orders -> users', /table.*association/],
    [tables('owner bigint from="1"'), 'owner bigint', /requires fk/],
    [tables('owner bigint fk=users.id to="-1"'), 'owner bigint', /invalid multiplicity/],
    [`${tables('owner bigint fk=users.id')}orders.owner -> users.id\n`, 'owner bigint', /already an edge/],
  ]) {
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, needle) && message.test(p.message)), source);
  }
});

test('S5 the same card in a graph view and a sequence view is drawn once per view and moves once per view', async () => {
  const source = diagramplay(`
    person user "User"
    box gw "Gateway"
    value hits "hits" on=gw from=0
    user -> gw
    view graph "Structure"
    view sequence "Calls" {
      user gw
    }
    scene "s" mode=static
      user -> gw "POST" set="hits+1"
  `);
  const result = await build(source);
  const html = parseMarkup(await toHtml(result, 'x'), { html: true });
  const canvas = findAll(html, (n) => /\bfl-canvas\b/.test(n.attrs.class ?? ''))[0];
  const panels = findAll(canvas, (n) => n.tag === 'section' && n.attrs['data-strategy']);
  assert.deepEqual(panels.map((p) => p.attrs['data-strategy']), ['graph', 'sequence']);
  assert.deepEqual(textsOf(canvas).filter((t) => t === 'Structure' || t === 'Calls'), ['Structure', 'Calls']);
  const dom = parseMarkup(await toSvg(result, { isStatic: true }));
  const texts = textsOf(dom);
  assert.equal(texts.filter((t) => t === 'Gateway').length, 2, 'one head in the graph, one lifeline head in the sequence');
  assert.equal(texts.filter((t) => t === 'POST').length, 1, 'the message appears once, as the sequence message (the graph carries it as a moving chip)');
  const hits = findAll(dom, (n) => n.tag === 'text' && textContent(n).trim() === '1');
  assert.equal(hits.length, 1, 'the shared value changes once and shows once');
});

test('S6 sequence-only statements need their card in a sequence view', async () => {
  for (const line of ['note gw "n"', 'activate gw', 'deactivate gw', 'gw -> user "m" create']) {
    const source = diagramplay(`box gw "G"\nbox user "U"\ngw -> user\nscene "s" mode=static\n  ${line}\n`);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, `  ${line}`)), line);
  }
});

test('S7 #175 a value, show or clear on a card that no graph view shows is rejected at its own line, and the same figure with the card in a graph view is drawn', async () => {
  const doc = (line, graph = '') => diagramplay(`
    person u "User"
    box s "Service"
    value n "count" on=s from=0
    ${graph}
    view sequence {
      u s
    }
    scene "s" mode=static
      u -> s "call" set="n+1"
      ${line}
  `);
  const kinds = [['', 'value n'], ['show s "verified" tag="ok"', 'show s'], ['clear s', 'clear s']];
  for (const [line, statement] of kinds) {
    const source = doc(line);
    const problems = await reject(source);
    const lines = problems.map((p) => p.line);
    assert.ok(lines.includes(lineOf(source, 'value n')), `${statement}: the value declaration is located: ${JSON.stringify(problems)}`);
    if (line) assert.ok(lines.includes(lineOf(source, statement)), `${statement}: the statement is located: ${JSON.stringify(problems)}`);
    assert.ok(problems.every((p) => p.severity === 'error' && /no graph view shows/.test(p.message) && p.line >= 1), JSON.stringify(problems));
  }
  const shown = textsOf(parseMarkup(await toSvg(await build(doc('show s "verified" tag="ok"', 'view graph {\n      s\n    }')), { isStatic: true })));
  for (const word of ['verified', 'count']) assert.ok(shown.includes(word), `${word} is drawn once a graph view shows the card: ${JSON.stringify(shown)}`);
});

test('S8 #172 card content shown by a scene is drawn whichever view is declared first', async () => {
  const doc = (views) => diagramplay(`
    box api "API"
    store db "DB"
    api -> db
    ${views}
    scene "s" mode=static
      api -> db "write"
      show db "committed"
  `);
  const sequenceFirst = doc('view sequence {\n  api\n  db\n}\nview graph');
  const graphFirst = doc('view graph\nview sequence {\n  api\n  db\n}');
  for (const source of [sequenceFirst, graphFirst]) {
    const result = await build(source);
    const texts = textsOf(parseMarkup(await toSvg(result, { isStatic: true })));
    assert.equal(texts.filter((t) => t === 'committed').length, 1, JSON.stringify(texts));
    const html = parseMarkup(await toHtml(result, 'x'), { html: true });
    const graphPanel = findAll(html, (n) => n.tag === 'section' && n.attrs['data-strategy'] === 'graph')[0];
    assert.ok(descendants(graphPanel).some((n) => n.tag === 'text' && textContent(n) === 'committed'), 'the graph panel carries the card layer');
  }
});

test('S9 a view names its kind first and has no id of its own: the old "view id kind" form is a plain syntax error', async () => {
  for (const line of ['view main graph', 'view calls sequence {', 'view p plot {', 'view t time {']) {
    const source = diagramplay(`box a "A"\n${line}\n${line.endsWith('{') ? '  a\n}\n' : ''}`);
    const problems = await reject(source);
    assert.ok(problems.some((p) => p.line === lineOf(source, line) && p.code === 'syntax'), line);
    for (const problem of problems) assert.doesNotMatch(problem.message, /renamed|no longer|used to|old form|instead of/i, 'no migration advice');
  }
});

test('S11 participants are listed in the order they first send: a different order is a warning (an error under strict) pointing into the view block', async () => {
  const source = diagramplay(`person u "U"\nbox s "S"\nview sequence {\n  s\n  u\n}\nscene "m" mode=static\n  u -> s "hi"\n`);
  const firstParticipant = lineOf(source, 'view sequence') + 1;
  const strict = await reject(source);
  assert.ok(strict.some((p) => /first send/.test(p.message) && p.line === firstParticipant), JSON.stringify(strict));
  const lenient = await build(source, { strict: false });
  assert.deepEqual(lenient.warnings.map((w) => w.line), [firstParticipant]);
  await build(diagramplay(`person u "U"\nbox s "S"\nview sequence {\n  u\n  s\n}\nscene "m" mode=static\n  u -> s "hi"\n`));
});


test('class multiplicities leave room for moving relationship text without hiding it', async () => {
  const result = await build(read(EXAMPLES, 'class.diagramplay'));
  assert.equal(result.warnings.filter(warning => warning.code === 'check-7').length, 0);
  const hop = result.timeline.segs.flatMap(segment => segment.hops).find(hop => hop.data?.includes('연관'));
  assert.ok(hop, 'the relationship message remains in the animation');
  assert.equal(hop.ms, 700, 'layout repairs do not change authored timing');
});
