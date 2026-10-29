// 작성 기본값: 이름 없는 보기와 묵시 보기, 장면 기본 mode, 한 낱말 색(tone)과 모양(appearance).
// 문법 단순화(G2, G3, G5) 계약이다. 시험 이름 첫 낱말이 요구사항 번호이고, 대응은 docs/design/expression-coverage.md의 시험 번호 표에 있다. (G1, 이름 있는 보기의 거절은 cards.test.js의 S9가 본다.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build, diagramplay, lineOf, panelStrategies, parseMarkup, reject, textsOf, toHtml, toSvg, valueOf } from './support.js';

test('#186 a card body renders in declaration order without a scene in SVG and HTML', async () => {
  for (const shape of ['box', 'person', 'external', 'store']) {
    const source = diagramplay(`${shape} a "주문 API" {\n  text "주문을 검증합니다"\n  value pending "처리 중" from=7\n  graph "검증 -> 저장"\n}\n`);
    const result = await build(source);
    const outputs = [parseMarkup(await toSvg(result)), parseMarkup(await toHtml(result), { html: true })];
    for (const dom of outputs) {
      const texts = textsOf(dom);
      assert.ok(texts.includes('주문을 검증합니다'), shape);
      assert.ok(texts.includes('검증') && texts.includes('저장'), shape);
      assert.ok(texts.indexOf('주문을 검증합니다') < texts.indexOf('처리 중'), 'body follows source order');
      assert.equal(valueOf(dom, '처리 중'), '7', shape);
    }
    assert.equal(result.timeline.steps.length, 0);
  }
});

test('#186 clearing a body preserves values and every scene starts from its declaration', async () => {
  const result = await build(diagramplay(`
    box a "API" {
      text "검증 전"
      value n "처리 중" from=0
    }
    box b "사용자"
    b -> a
    scene "교체" mode=static
      clear a
      show a "검증 완료"
    scene "초기 구성"
    scene "값 변경"
      b -> a set="n=3"
  `));
  for (const [scene, expected, absent, value] of [[0, '검증 완료', '검증 전', '0'], [1, '검증 전', '검증 완료', '0'], [2, '검증 전', '검증 완료', '3']]) {
    const dom = parseMarkup(await toSvg(result, { scene, isStatic: true }));
    assert.ok(textsOf(dom).includes(expected));
    assert.ok(!textsOf(dom).includes(absent));
    assert.equal(valueOf(dom, '처리 중'), value);
  }
});

test('#186 invalid body syntax and a body hidden by a sequence-only view are located errors', async () => {
  const cases = [
    ['box a "A" {\n text bare\n}\n', 'text bare'],
    ['box a "A" {\n value n "N" on=a\n}\n', 'value n'],
    ['box a "A" {\n text "T" mark="123456789"\n}\n', 'text "T"'],
    ['box a "A" shape=circle {\n text "T"\n}\n', 'box a'],
    ['box a "A" {\n text "T"\n', 'box a'],
    ['box a "A" {\n text "T"\n}\nview sequence {\n a\n}\n', 'text "T"'],
  ];
  for (const [body, line] of cases) {
    const source = diagramplay(body);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, line)), body);
  }
});

test('G2 #187 default views follow the declared composition, independently of edges', async () => {
  const cases = [
    ['box a "A"\n', ['graph']],
    ['box a "A"\nbox b "B"\n', ['graph']],
    ['box a "A"\nbox b "B"\na -> b\n', ['graph']],
    ['group g "G" {\n  box a "A"\n}\nbox b "B"\n', ['graph']],
  ];
  for (const [body, expected] of cases) assert.deepEqual(await panelStrategies(diagramplay(body)), expected, body);
});

test('G2 an explicit view only adds: its members get no second implicit view and an unlisted card still gets one graph', async () => {
  assert.deepEqual(await panelStrategies(diagramplay('box a "A"\nbox b "B"\nview graph\n')), ['graph']);
  assert.deepEqual(await panelStrategies(diagramplay('box a "A"\nbox b "B"\nview graph "All"\n')), ['graph']);
  assert.deepEqual(await panelStrategies(diagramplay('person u "U"\nbox s "S"\nview sequence {\n  u\n  s\n}\n')), ['sequence']);
  assert.deepEqual(await panelStrategies(diagramplay('person u "U"\nbox s "S"\nbox z "Z"\nview sequence {\n  u\n  s\n}\n')), ['sequence', 'graph']);
  // 같은 카드를 여러 방식에 함께 놓는 일은 그대로 된다
  assert.deepEqual(await panelStrategies(diagramplay('person u "U"\nbox s "S"\nu -> s\nview graph\nview sequence {\n  u\n  s\n}\n')), ['graph', 'sequence']);
});

test('G2 an explicit view lists only members its kind can hold', async () => {
  const wrong = [
    ['decision a "A"\nbox b "B"\nview sequence {\n  a\n  b\n}\n', 'decision'],
    ['box a "A"\nview sequence {\n  zz\n}\n', 'zz'],
  ];
  for (const [body, member] of wrong) {
    const source = diagramplay(body);
    assert.ok((await reject(source)).some((p) => p.message.includes(member)), body);
  }
});

test('G3 a scene with no lines is still, a scene with lines plays once, and an explicit mode always wins', async () => {
  const mode = async (scene, extra = 'box a "A"\nbox b "B"\na -> b\n') => {
    const result = await build(diagramplay(`${extra}${scene}`));
    return result.timeline.steps.map((s) => s.mode);
  };
  assert.deepEqual(await mode('scene "s"\n'), ['static']);
  assert.deepEqual(await mode('scene "s"\n  a -> b\n'), ['once']);
  assert.deepEqual(await mode('scene "s" mode=static\n  a -> b\n'), ['static']);
  assert.deepEqual(await mode('scene "s" mode=loop\n  a -> b\n'), ['loop']);
  assert.deepEqual(await mode('scene "s"\nscene "t"\n  a -> b\nscene "u" mode=loop\n  a -> b\n'), ['static', 'once', 'loop']);
  // 렌더링도 같은 방식을 따른다
  const svg = (scene, i) => build(diagramplay(`box a "A"\nbox b "B"\na -> b\n${scene}`)).then((r) => toSvg(r, { scene: i }));
  assert.match(await svg('scene "s"\n  a -> b\n', 0), /data-mode="once"/);
  assert.match(await svg('scene "s"\n', 0), /data-mode="static"/);
});

test('G3 an empty scene cannot be asked to play: mode=once or mode=loop with no lines is a located error', async () => {
  for (const mode of ['once', 'loop']) {
    const source = diagramplay(`box a "A"\nscene "s" mode=${mode}\n`);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, 'scene "s"')), mode);
  }
  await build(diagramplay('box a "A"\nscene "s" mode=static\n'));
});

test('G3 a scene name is never only digits, since --scene reads digits as a number; names with other characters are fine', async () => {
  for (const label of ['2', '10', '007']) {
    const source = diagramplay(`box a "A"\nscene "${label}" mode=static\n`);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, 'scene "')), label);
  }
  for (const label of ['2단계', 'v2', '2.0', ' 2 x']) await build(diagramplay(`box a "A"\nscene "${label}" mode=static\n`));
});

const TONES = ['blue', 'orange', 'gray', 'silver'];

test('G5 tone is the one color word on people, boxes, externals, stores, groups and card rows; it takes the four distinction names only', async () => {
  for (const tone of TONES) {
    for (const card of ['person', 'box', 'external', 'store']) await build(diagramplay(`${card} a "A" tone=${tone}\n`));
    await build(diagramplay(`group g "G" tone=${tone} {\n  box a "A"\n}\n`));
    await build(diagramplay(`box a "A"\nbox b "B"\na -> b\nscene "s"\n  a -> b\n  show b "x" tag="t" tone=${tone}\n`));
  }
  // 상태색(빨강, 초록)과 없앤 색(보라, 노랑, 청록)도 다른 모르는 이름과 같은 일반 오류다.
  for (const bad of ['red', 'green', 'purple', 'yellow', 'cyan', 'brand', 'amber', 'teal', 'navy', 'pink', 'sky', '"blue"', '#ff0000', 'Blue', '']) {
    const source = diagramplay(`box a "A" tone=${bad}\n`);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, 'tone=')), `tone=${bad}`);
  }
});

test('G5 the options tone replaced are errors at their line, not silently ignored: fill, stroke and show card', async () => {
  for (const line of ['box a "A" fill=blue', 'box a "A" stroke=blue', 'person a "A" fill=red', 'group g "G" stroke=green {\n  box a "A"\n}', 'external a "A" fill=gray', 'store a "A" stroke=cyan']) {
    const source = diagramplay(`${line}\n`);
    const problems = await reject(source);
    assert.ok(problems.some((p) => p.line === lineOf(source, line.split('\n')[0]) && p.code === 'syntax'), line);
    for (const problem of problems) assert.doesNotMatch(problem.message, /renamed|no longer|used to|old form|instead of|replaced/i, 'no migration advice');
  }
  const card = diagramplay('box a "A"\nbox b "B"\na -> b\nscene "s"\n  a -> b\n  show b "x" card=blue\n');
  assert.ok((await reject(card)).some((p) => p.line === lineOf(card, 'show b')));
});

test('G5 appearance is plain, filled or outline; without a tone the colored two use the neutral gray family; plain is the default', async () => {
  for (const appearance of ['plain', 'filled', 'outline']) await build(diagramplay(`box a "A" tone=orange appearance=${appearance}\n`));
  for (const appearance of ['plain', 'filled', 'outline']) await build(diagramplay(`box a "A" appearance=${appearance}\ngroup g "G" appearance=${appearance} {\n  box b "B" {\n    text "t" appearance=${appearance}\n  }\n}\n`));
  for (const appearance of ['filled', 'outline']) {
    const gray = await build(diagramplay(`box a "A" tone=gray appearance=${appearance}\n`));
    const neutral = await build(diagramplay(`box a "A" appearance=${appearance}\n`));
    assert.equal(await toSvg(neutral, { isStatic: true }), await toSvg(gray, { isStatic: true }), `appearance=${appearance} without a tone is tone=gray`);
  }
  for (const line of ['box a "A" tone=orange appearance=hollow', 'box a "A" tone=orange appearance=']) {
    const source = diagramplay(`${line}\n`);
    assert.ok((await reject(source)).some((p) => p.line === lineOf(source, line)), line);
  }
});

test('G5 tone and appearance change the picture, and plain without a tone is the neutral default', async () => {
  const svg = async (options) => toSvg(await build(diagramplay(`box a "A" ${options}\nbox b "B"\na -> b\n`)), { isStatic: true });
  const neutral = await svg('');
  assert.equal(await svg('appearance=plain'), neutral, 'plain is the default');
  const toned = await svg('tone=blue');
  const filled = await svg('tone=blue appearance=filled');
  const outline = await svg('tone=blue appearance=outline');
  const other = await svg('tone=orange appearance=filled');
  assert.equal(new Set([neutral, toned, filled, outline, other]).size, 5, 'each choice draws something different');
});
