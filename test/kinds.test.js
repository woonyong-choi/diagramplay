// 다섯 표현의 독립 최소 경계: 구성도, 클래스, 순서, 큐. (api, schema는 cards.test.js, flow는 values.test.js)
// 예제 원본은 examples.test.js가 읽는다. 시험 이름 첫 낱말(K-arch 등)이 요구사항 번호이고, 대응은 docs/design/expression-coverage.md의 시험 번호 표에 있다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIGURE_PAD } from '../src/measure/canvas.js';
import { measure } from '../src/measure/fonts.js';
import { sizePill } from '../src/measure/pills.js';
import { STYLE } from '../src/measure/texts.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { EXAMPLES, build, diagramplay, finalValue, findAll, lineOf, num, parseMarkup, read, reject, stillDom, textContent, textsOf, toHtml, toSvg, visibleTexts } from './support.js';

const rejectedAt = async (source, needle, pattern) => {
  const problems = await reject(source);
  assert.ok(problems.some((p) => p.line === lineOf(source, needle) && (pattern ? pattern.test(p.message) : true)), `${needle}: ${JSON.stringify(problems)}`);
};
const at = (dom, label) => {
  const found = visibleTexts(dom).filter((n) => textContent(n).trim() === label);
  assert.equal(found.length, 1, `expected one "${label}", found ${found.length}`);
  return { x: num(found[0], 'x'), y: num(found[0], 'y') };
};

test('K-arch a group holds boxes with badges, replica counts, icons and numbered edges; a quiet edge must be walked', async () => {
  const source = (scene) => diagramplay(`
    person u "User"
    group cloud "Cloud" direction=down badge="Zone" {
      box web "Web" count=3 badge="L7" icon=nginx
      store db "DB" icon=postgresql
    }
    u -> web "req" no=1
    web -> db "sql" no=2 quiet
    ${scene}
  `);
  const walked = source('scene "s" mode=static\n  u -> web\n  web -> db\n');
  const texts = textsOf(await stillDom(walked));
  for (const word of ['User', 'Cloud', 'Zone', 'Web', 'L7', 'DB', 'req', 'sql', '1', '2', '×3']) assert.ok(texts.includes(word), `${word} in ${JSON.stringify(texts)}`);
  await rejectedAt(source(''), 'quiet', /never/);
  for (const [line, pattern] of [
    ['box a "A" badge="toolongbadge"', /badge|8/],
    ['box a "A" count=1', /count/],
    ['box a "A" shape=circle badge="x"', /./],
    ['box a "A" shape=tile', /icon/],
    ['box a "A" icon=no-such-icon', /unknown icon "no-such-icon"/],
    ['box a "A"\nbox b "B"\na -> b no=0', /./],
    ['box a "A"\nbox b "B"\na -> b no=1.5', /./],
  ]) {
    const bad = diagramplay(`${line}\n`);
    assert.ok((await reject(bad)).length, line);
    assert.ok((await reject(bad)).some((p) => pattern.test(p.message)), `${line}: ${JSON.stringify(await reject(bad))}`);
  }
  // 번호는 겹쳐도 된다
  await build(diagramplay('box a "A"\nbox b "B"\nbox c "C"\na -> b no=1\nb -> c no=1\n'));
});

test('K-arch edges to a group and its own members, to itself, or twice in one direction are errors; opposite directions may coexist', async () => {
  const group = diagramplay('group g "G" {\n  box a "A"\n}\ng -> a\n');
  await rejectedAt(group, 'g -> a');
  await rejectedAt(diagramplay('box a "A"\na -> a\n'), 'a -> a');
  await rejectedAt(diagramplay('box a "A"\nbox b "B"\na -> b\na -> b "again"\n'), 'a -> b "again"', /already an edge/);
  await build(diagramplay('box a "A"\nbox b "B"\na -> b\nb -> a\n'));
  await rejectedAt(diagramplay('box a "A"\ngroup g "G" {\n}\n'), 'group g', /group "g" is empty/);
});

test('K-class members read as visibility marks; abstract and interface say so; multiplicity labels sit on their ends', async () => {
  const source = diagramplay(`
    interface repo "Repo" {
      method save "(x: T): void" visibility=public
    }
    class base "Base" abstract {
      field id "UUID" visibility=protected
    }
    class user "User" {
      field name "string" visibility=private
      method greet "(): void" visibility=public
    }
    user -> base relation=inheritance
    user -> repo relation=realization
    base -> repo relation=aggregation from="1" to="0..*"
  `);
  const texts = textsOf(await stillDom(source));
  for (const word of ['- name: string', '+ greet(): void', '# id: UUID', '{abstract}', '«interface»', '1', '0..*']) assert.ok(texts.includes(word), `${word} in ${JSON.stringify(texts)}`);
});

test('K-class relations: multiplicity only where it means something, no inheritance loop, members unique, relations only between classes', async () => {
  const base = 'class a "A" {\n  field n "int"\n}\nclass b "B" {\n  field n "int"\n}\nbox x "X"\n';
  await rejectedAt(diagramplay(`${base}a -> b relation=inheritance from="1"\n`), 'relation=inheritance', /multiplicity/);
  const loop = diagramplay(`${base}a -> b relation=inheritance\nb -> a relation=inheritance\n`);
  assert.ok((await reject(loop)).length);
  await rejectedAt(diagramplay('class a "A" {\n  field n "int"\n  field n "long"\n}\n'), 'field n "long"', /already/);
  await rejectedAt(diagramplay(`${base}a -> x relation=association\n`), 'relation=association');
  await rejectedAt(diagramplay(`${base}a -> b relation=nonsense\n`), 'relation=nonsense');
  await rejectedAt(diagramplay('class a "A" {\n  field n "int"\n'), 'class a', /./);
  await build(diagramplay(`${base}a -> b from="1" to="*"\n`));
});

test('K-sequence messages run top to bottom in the order written; notes and branches are drawn; the participant row is the view', async () => {
  const source = diagramplay(`
    person a "A"
    box b "B"
    box c "C"
    view sequence {
      a
      b
      c
    }
    scene "s" mode=static
      a -> b "one"
      b -> c "two" dashed
      note c "memo"
      activate c
      c -> b "inside"
      deactivate c
      fragment alt "pick" choose="yes" {
        branch "yes" {
          c -> b "ok"
        }
        branch "no" {
          c -> b "fail"
        }
      }
  `);
  const dom = await stillDom(source);
  const ys = ['one', 'two', 'inside', 'ok', 'fail'].map((label) => at(dom, label).y);
  assert.deepEqual([...ys].sort((p, q) => p - q), ys, 'top to bottom in the written order');
  const columns = ['A', 'B', 'C'].map((label) => at(dom, label).x);
  assert.deepEqual([...columns].sort((p, q) => p - q), columns, 'participants left to right in the view order');
  for (const word of ['memo', 'alt · pick']) assert.ok(textsOf(dom).includes(word), word);
});

test('K-view a panel is as wide as its title needs; a long Korean or Latin title stays inside the panel and the figure, and the content stays centered inside it', async () => {
  const long = '매우 긴 한국어 패널 이름을 반복해서 적어도 그림 안에서 잘리지 않는지 확인하는 호출 순서 long-latin-identifier-name-for-a-view';
  const views = (graphTitle) => diagramplay(`
    person a "A"
    box b "B"
    view graph ${graphTitle} {
      a
      b
    }
    view sequence "short" {
      a
      b
    }
    scene "s" mode=static
      a -> b "one"
  `);
  const figure = await build(views(`"${long}"`));
  const { scene } = figure;
  const [graph, sequence] = scene.panels;
  const need = measure(long, STYLE.group.size, STYLE.group.face) + FIGURE_PAD * 2;
  assert.ok(graph.box.w >= need && scene.width >= need, `panel ${graph.box.w} and figure ${scene.width} hold the ${need}px title`);
  assert.ok(graph.labelAt.x + measure(long, STYLE.group.size, STYLE.group.face) <= graph.box.x + graph.box.w - FIGURE_PAD + 1e-6, 'the title ends inside the panel padding');
  const dom = parseMarkup(await toSvg(figure, { isStatic: true }));
  const [title] = findAll(dom, (n) => n.tag === 'text' && n.attrs['data-view'] === graph.view);
  assert.ok(num(title, 'x') >= 0 && num(title, 'x') + measure(long, STYLE.group.size, STYLE.group.face) <= scene.width, 'the drawn title is within the figure');
  for (const panel of scene.panels) {
    assert.ok(panel.box.x >= 0 && panel.box.x + panel.box.w <= scene.width + 1e-6, `${panel.view} panel inside the figure`);
    for (const it of scene.items.filter((item) => item.panel === panel.index)) assert.ok(it.x >= panel.box.x && it.x + it.w <= panel.box.x + panel.box.w + 1e-6, `${it.id} inside the ${panel.view} panel`);
  }
  assert.ok(sequence.box.w <= graph.box.w, 'the narrow panel stays centered under the wide one');
  // 제목이 짧으면 내용 자리는 제목 폭에 달라지지 않는다.
  const plain = (await build(views('"ab"'))).scene;
  const bare = (await build(views('"ab"').replace('view graph "ab"', 'view graph'))).scene;
  assert.deepEqual(plain.items.map((it) => [it.id, it.x, it.w]), bare.items.map((it) => [it.id, it.x, it.w]), 'a short title leaves the content where it was');
});

test('K-sequence a message needs text; a fragment names a branch; an activation closes; an and-beat cannot carry messages', async () => {
  const head = 'person a "A"\nbox b "B"\nview sequence {\n  a\n  b\n}\nscene "s" mode=static\n';
  await rejectedAt(diagramplay(`${head}  a -> b\n`), '  a -> b', /needs text/);
  await rejectedAt(diagramplay(`${head}  a -> b "x"\n  activate b\n`), 'activate b', /deactivate/);
  await rejectedAt(diagramplay(`${head}  activate b\n`), 'activate b', /follows a message/);
  await rejectedAt(diagramplay(`${head}  fragment alt "p" choose="zz" {\n    branch "yes" {\n      a -> b "x"\n    }\n  }\n`), 'fragment alt', /branch/);
  await rejectedAt(diagramplay(`${head}  a -> b "x" & b -> a "y"\n`), '&', /./);
  await rejectedAt(diagramplay(`${head}  fragment maybe "p" {\n    branch "yes" {\n      a -> b "x"\n    }\n  }\n`), 'fragment maybe');
  await rejectedAt(diagramplay(`${head}  fragment alt "p" {\n    branch "yes" {\n      a -> b "x"\n`), 'fragment alt');
});

test('K-sequence #179 a fragment never changes what a card shows: a scene that starts with one, ends with one, nests one, disables one or has only skipped ones all keep the declared value and the shown rows', async () => {
  const head = (order) => `person u "U"\nbox a "A"\nvalue n "COUNT" on=a from=0\nu -> a\nview graph\nview sequence {\n  ${order}\n}\n`;
  const loop = '  fragment loop "F" times=2 {\n    a -> u "in"\n  }\n';
  const skipped = '  fragment opt "S" run=off {\n    a -> u "never"\n  }\n';
  const cases = [
    ['starts with a fragment', 'a\n  u', `scene "s" mode=static\n${loop}`, { COUNT: true, SHOWN: false }],
    ['has only a skipped fragment', 'a\n  u', `scene "s" mode=static\n${skipped}`, { COUNT: true, SHOWN: false }],
    ['shows after only a skipped fragment', 'a\n  u', `scene "s"\n${skipped}  show a "SHOWN"\n`, { COUNT: true, SHOWN: true }],
    ['a fragment between a move and a show', 'u\n  a', `scene "s" mode=static\n  u -> a "go"\n${loop}  show a "SHOWN"\n`, { COUNT: true, SHOWN: true }],
    ['a nested fragment with a disabled one inside', 'u\n  a', `scene "s" mode=static\n  u -> a "go"\n  show a "SHOWN"\n  fragment loop "O" times=2 {\n    fragment opt "I" run=off {\n      a -> u "x"\n    }\n    a -> u "y"\n  }\n`, { COUNT: true, SHOWN: true }],
    ['a branch that is not chosen', 'u\n  a', `scene "s" mode=static\n  u -> a "go"\n  show a "SHOWN"\n  fragment alt "P" choose="yes" {\n    branch "yes" {\n      a -> u "y"\n    }\n    branch "no" {\n      a -> u "n"\n    }\n  }\n  show a "AFTER"\n`, { COUNT: true, SHOWN: true, AFTER: true }],
    ['a fragment between two scenes of one card', 'u\n  a', `scene "s" mode=static\n  u -> a "go"\n  show a "SHOWN"\n${loop}scene "t" mode=static\n`, { COUNT: true, SHOWN: true }],
  ];
  for (const [name, order, body, expected] of cases) {
    const source = diagramplay(head(order) + body);
    const figure = await build(source);
    for (const options of [{ isStatic: true }, {}]) parseMarkup(await toSvg(figure, options));
    await toHtml(figure);
    const texts = textsOf(await stillDom(source));
    for (const [word, isShown] of Object.entries(expected)) assert.equal(texts.includes(word), isShown, `${name}: "${word}" in ${JSON.stringify(texts)}`);
    if (body.includes('scene "t"')) {
      const next = textsOf(await stillDom(source, 1));
      assert.ok(next.includes('COUNT') && !next.includes('SHOWN'), `${name}: the next scene starts from the declared card again: ${JSON.stringify(next)}`);
    }
  }
});

test('K-queue a count past its ends warns (an error under strict) while exactly empty or exactly full does not', async () => {
  const queue = (moves) => diagramplay(`box a "A"\nqueue q "Q" slots=2\nvalue len "len" on=a ref=q\na -> q\nscene "s" mode=static\n${moves.map((m) => `  ${m}`).join('\n')}\n`);
  await build(queue(['a -> q set="q+2"']));
  await build(queue(['a -> q set="q+1"', 'a -> q set="q-1"']));
  const under = queue(['a -> q set="q-1"']);
  const over = queue(['a -> q set="q+3"']);
  for (const source of [under, over]) {
    assert.ok((await reject(source)).some((p) => p.code === 'check-14'), 'strict makes the warning an error');
    const lenient = await build(source, { strict: false });
    assert.ok(lenient.warnings.some((w) => w.code === 'check-14'));
  }
  assert.equal(await finalValue(under, 'len', 0, { strict: false }), '-1', 'the value is not clamped; only the picture is');
  assert.equal(await finalValue(over, 'len', 0, { strict: false }), '3');
});





test('K-queue slot rows are balanced and a shorter last row is centred under the rows above', async () => {
  const { queueSlots, sizeQueue } = await import('../src/measure/queue.js');
  const rowsOf = (count) => {
    const size = sizeQueue({ label: 'q', slots: count });
    const slots = queueSlots({ x: 0, y: 0, w: size.w, h: size.h, slots: count });
    const rows = new Map();
    for (const s of slots) rows.set(s.y, [...(rows.get(s.y) ?? []), s]);
    return [...rows.values()];
  };
  assert.deepEqual(rowsOf(10).map((row) => row.length), [5, 5]);
  const [top, bottom] = rowsOf(9);
  assert.deepEqual([top.length, bottom.length], [5, 4]);
  const middle = (row) => (row[0].x + row.at(-1).x + row.at(-1).w) / 2;
  assert.ok(Math.abs(middle(top) - middle(bottom)) < 1e-9, 'the short last row is centred');
  assert.deepEqual(rowsOf(6).map((row) => row.length), [6]);
});

test('K-graph an edge label lies inside or outside a group, never across its border (architecture)', async () => {
  for (const name of ['architecture.diagramplay']) {
    const { scene } = await build(read(EXAMPLES, name), { baseDir: EXAMPLES });
    for (const e of scene.edges.filter((edge) => edge.labelAt && (edge.label || edge.no))) {
      const { w, h } = sizePill(e.label, e.no);
      const box = { x: e.labelAt.x - w / 2, y: e.labelAt.y - h / 2, w, h };
      for (const g of scene.groups) {
        const meets = box.x < g.x + g.w && g.x < box.x + box.w && box.y < g.y + g.h && g.y < box.y + box.h;
        const inside = g.x <= box.x && g.y <= box.y && box.x + box.w <= g.x + g.w && box.y + box.h <= g.y + g.h;
        assert.ok(!meets || inside, `${name}: label "${e.label ?? e.no}" crosses the border of group ${g.id}`);
      }
    }
  }
});
