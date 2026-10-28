// 공통 상태 계약: 켜짐과 평소의 모습은 figure.css의 효과 한 벌(`--fx-*`) 하나가 정하고, 움직이는 SVG의 keyframes와 HTML 재생기의 규칙이 같은 사용자 정의 속성을 읽는다.
// 차트 방향선의 화살촉은 색 역할마다 정의 하나이고, 차트 종류가 섞여도 선언 순서와 상관없이 몸통과 같은 역할의 색을 읽는다.
// 브라우저에서 계산된 색은 보지 않는다(화면 검수는 따로 한다). 여기서는 출력이 어떤 정의를 읽는지만 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import postcss from 'postcss';
import { paintCss } from '../src/draw/paint.js';
import { STYLES } from '../src/draw/styles.js';
import { build, diagramplay, toHtml, toSvg } from './support.js';

const GRAPH = diagramplay(`
 table t "T" {
  id bigint pk
 }
 box s "S" tone=yellow appearance=outline
 box f "F" tone=blue appearance=filled
 s -> f "go"
 scene "s"
  light t.id s f
  s -> f
`);

const DUMBBELL = `chart d "지연" dumbbell {
  x "지연(ms)"
  series before "전" role=compare
  series after "후" role=main
  row "a" before=10 after=5
}`;
const SCATTER = `chart p "점" scatter {
  x "크기(줄)"
  y "장애(건)"
  point "p1" x=1 y=1
  point "p2" x=2 y=2
  link "p1" -> "p2"
}`;

const KEYFRAMES = /@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g;

test('outputs_use_shared_relation_roles_without_consumer_css_rewriting', async () => {
  const require = createRequire(import.meta.url);
  const shared = readFileSync(require.resolve('@woonyong-choi/design-tokens/styles/diagram/figure.css'), 'utf8');
  assert.equal(STYLES.figure, shared);
  assert.match(shared, /--fx-line-rest: var\(--color-figure-relation\)/);
  const result = await build(GRAPH);
  for (const output of [await toSvg(result), await toSvg(result, { isStatic: true }), await toHtml(result)]) assert.ok(output.includes(shared));
});

test('paintCss supplies only used tone variables; the shared stylesheet owns appearance', () => {
  const css = paintCss({ items: [{ tone: 'blue', content: { layouts: [{ rows: [{ row: { tone: 'red', appearance: 'filled' } }] }] } }], groups: [{ tone: 'green' }, { tone: 'blue' }] });
  const rules = postcss.parse(css);
  assert.deepEqual(rules.nodes.map((rule) => rule.selector), ['.fl .tn-blue', '.fl .tn-green', '.fl .tn-red']);
  rules.walkDecls((declaration) => {
    assert.match(declaration.prop, /^--paint-(fill|outline|ink)$/);
    assert.match(declaration.value, /^var\(--color-paint-(blue|green|red)-(fill|outline|ink)\)$/);
  });
  assert.equal(paintCss({ items: [{}], groups: [] }), '');
});

test('S1 켜짐과 평소 모습은 효과 한 벌(--fx-*)을 움직이는 SVG와 HTML이 함께 읽는다', async () => {
  const result = await build(GRAPH);
  const svg = await toSvg(result);
  const html = await toHtml(result, 'state');
  for (const out of [svg, html]) {
    const defined = new Set([...out.matchAll(/(--fx-[\w-]+)\s*:/g)].map((m) => m[1]));
    const read = [...out.matchAll(/var\((--fx-[\w-]+)/g)].map((m) => m[1]);
    assert.deepEqual(read.filter((name) => !defined.has(name)), [], 'every --fx-* that is read is defined in the same document');
  }
  const frames = (svg.match(KEYFRAMES) ?? []).filter((k) => k.includes('--fx-'));
  assert.ok(frames.length > 0, 'the lit nodes, parts and cells animate through --fx-*');
  assert.ok(frames.every((k) => !/--color-state-active\)|--color-paint/.test(k)), 'keyframes do not repeat token colors');
  assert.match(html, /\.fl-part\.on :is\(\.part-bg, \.grid-cell\)\s*\{\s*fill: var\(--fx-face-on\)/, 'the HTML lit field and cell read the same lit face as the animated SVG');
  assert.ok(frames.some((k) => k.includes('fill: var(--fx-face-on)') && !k.includes('stroke')) && frames.some((k) => k.includes('fill: var(--fx-face);')), 'the animated SVG lights a field and a cell by that lit face only');
  assert.match(svg, /\.fl-node\.ap-outline\s*\{\s*--fx-edge-rest: var\(--paint-outline\)/, 'the shared appearance changes only the rest values');
  assert.match(svg, /\.fl-node\.ap-filled\s*\{\s*--fx-face: var\(--paint-fill\)/);
  assert.match(svg, /\.tn-yellow\s*\{[^}]*--paint-outline: var\(--color-paint-yellow-outline\)/);
  assert.match(svg, /\.tn-blue\s*\{[^}]*--paint-fill: var\(--color-paint-blue-fill\)/);
});

// 움직이는 SVG의 시간은 재생기(player/sample.js)와 같다: 점이 선을 떠나면 선 색과 알약은 평소로 돌아오고(알약은 표시 400ms, speed와 상관없다), 조용한 선의 보임만 마지막 모습까지 남는다.
const WALK = diagramplay(`
  box a "A"
  box b "B"
  box c "C"
  a -> b "x"
  b -> c quiet
  scene "walk" mode=once speed=4
    b -> c time=1s
    a -> b time=1s
  scene "later" mode=once
    wait 1s
`);

// keyframes 본문을 [{ at: 퍼센트 목록, value }]로 읽는다.
const stopsOf = (frames) => [...frames.slice(frames.indexOf('{') + 1).matchAll(/([\d.,%]+) \{ ([^}]*) \}/g)].map(([, at, value]) => ({ at: at.split(',').map(parseFloat), value }));

test('S4 움직이는 SVG의 선은 점이 떠나면 평소로 돌아오고, 알약은 speed와 상관없이 400 표시 ms 뒤에 평소가 되며, 조용한 선의 보임만 마지막 모습까지 남는다', async () => {
  const result = await build(WALK);
  const svg = await toSvg(result, { scene: 0 });
  const framesOf = (out, name) => stopsOf((out.match(KEYFRAMES) ?? []).find((k) => k.startsWith(`@keyframes ${name} `)));
  const durationMs = Number(/\.fl \.a\d+ \{ animation: a\d+ ([\d.]+)s/.exec(svg)[1]) * 1000;
  const ms = (percent) => (percent / 100) * durationMs;
  const [lineClass] = /class="fl-edge (a\d+)"/.exec(svg).slice(1);
  const lineStops = framesOf(svg, lineClass);
  assert.deepEqual([lineStops.at(-1).at.at(-1), lineStops.at(-1).value], [100, 'color: var(--fx-line-rest)'], '100%에서 움직인 선은 평소 색이다');
  // 점은 a -> b 선에 논리 1000ms에 들어서고(speed 4에서 250 표시 ms) 2000ms에 떠난다(500 표시 ms). 알약은 들어서는 즉시 활성 색이고, 떠난 뒤 400 표시 ms(논리 1600이 아니다) 동안 평소 색으로 돌아온다.
  const [pillClass] = /class="pill (a\d+)"/.exec(svg).slice(1);
  const pillStops = framesOf(svg, pillClass);
  const [hold, settled] = pillStops.slice(-2);
  assert.equal(settled.value, 'fill: var(--fx-pill-rest)');
  assert.equal(hold.value, 'fill: var(--color-figure-label-active-fill)');
  assert.ok(Math.abs(ms(hold.at[0]) - 500) < 1, `the pill stays active until the dot leaves (${ms(hold.at[0])}ms)`);
  assert.ok(Math.abs(ms(settled.at[0]) - ms(hold.at[0]) - 400) < 1, `the pill fades for 400 display ms at speed 4 (${ms(settled.at[0]) - ms(hold.at[0])}ms)`);
  const on = pillStops.findIndex((stop) => stop.value === 'fill: var(--color-figure-label-active-fill)');
  assert.ok(on > 0 && pillStops[on - 1].value === 'fill: var(--fx-pill-rest)' && pillStops[on].at[0] - pillStops[on - 1].at.at(-1) < 0.01, 'the pill turns active at once, with no rise');
  const [quietClass] = /class="fl-edge quiet (a\d+) a\d+"/.exec(svg).slice(1);
  const quietStops = framesOf(svg, quietClass);
  assert.deepEqual([quietStops.at(-1).at.at(-1), quietStops.at(-1).value], [100, 'opacity: 1'], '조용한 선은 100%에서도 보인다');
  // 마지막 모습 층(움직임 줄이기)은 드러내는 움직임이 없어 조용한 선을 숨기는 class 없이 평소 모습으로 그린다.
  const still = svg.slice(svg.indexOf('class="fl-still"'));
  assert.match(still, /class="fl-edge quiet\s*"/, '마지막 모습 층에서도 보인다');
  assert.doesNotMatch(svg, /\.fl \.sa\d+ \{[^}]*--fx-edge\)/, '마지막 모습 층의 선과 알약은 평소 색이다');
  // 다른 장면에서 지나간 조용한 선은 이 장면에서 보이지 않는다.
  const later = await toSvg(result, { scene: 1 });
  const [laterClass] = /class="fl-edge quiet (a\d+)/.exec(later).slice(1);
  assert.deepEqual(framesOf(later, laterClass).map((stop) => stop.value), ['opacity: 0']);
  // 켜짐 구간의 시각은 반올림하지 않는다: 1ms보다 작게 다른 두 일정은 서로 다른 keyframes를 받고, 같은 일정은 class 하나를 나눠 쓴다.
  const edgeClasses = async (first, second) => {
    const out = await toSvg(await build(diagramplay(`
      box a "A"
      box b "B"
      box c "C"
      a -> b
      b -> c
      scene "s" mode=once
        track a -> b at=${first}ms time=10ms
        track b -> c at=${second}ms time=10ms
    `)), { scene: 0 });
    return [...out.matchAll(/class="fl-edge (a\d+)"/g)].map(([, name]) => name);
  };
  const [near, far] = await edgeClasses(10.1, 10.4);
  assert.notEqual(near, far, 'edges that start 0.3ms apart do not share a keyframes');
  const [same, again] = await edgeClasses(10.1, 10.1);
  assert.equal(same, again, 'identical schedules reuse one class');
});

test('S5 light가 켠 그룹은 경계 색만 강조 색이 되고 굵기와 면은 바뀌지 않으며, 켜지 않은 그룹은 아무 class도 받지 않는다', async () => {
  const result = await build(diagramplay(`
    group g "G" {
      box a "A"
      box b "B"
    }
    group h "H" {
      box d "D"
    }
    box c "C"
    a -> c
    scene "s" mode=once
      a -> c time=1s
      light g
  `));
  const svg = await toSvg(result);
  const boxes = [...svg.matchAll(/class="frame-box fl-stroke([^"]*)"/g)].map((m) => m[1].trim());
  // 움직이는 층과 마지막 모습 층(sa) 각각에서 켠 그룹 하나만 켜짐 class를 받는다.
  assert.deepEqual(boxes.filter(Boolean).map((name) => name.trim().replace(/\d+$/, '')).sort(), ['a', 'sa'], 'only the lit group has a lit class');
  const [name] = boxes.filter((value) => /^a\d+$/.test(value));
  const frames = (svg.match(KEYFRAMES) ?? []).find((k) => k.startsWith(`@keyframes ${name} `));
  assert.ok(frames.includes('stroke: var(--fx-edge)') && frames.includes('stroke: var(--fx-edge-rest)'), 'the border goes from its rest colour to the lit colour');
  assert.doesNotMatch(frames, /stroke-width|fill/, 'only the border colour changes');
  assert.match(await toHtml(result, 'group'), /\.fl \.fl-group\.on > \.frame-box \{\s*stroke: var\(--fx-edge\);\s*\}/, 'the HTML player lights the same border');
  assert.match(svg, /\.fl \.frame-box \{\s*--fx-edge-rest: var\(--color-figure-boundary\);\s*--fx-edge: var\(--color-figure-boundary-active\);\s*fill: none;\s*stroke: var\(--fx-edge-rest\);/, 'a group reads its rest border through the variable, set on the rect itself so a badge inside the group does not inherit it');
});

test('surface_paint_and_relation_dashes_are_owned_by_shared_css', async () => {
  const result = await build(diagramplay(`
    group g "외부 경계" dashed {
      external e "외부"
    }
    box a "요청" count=2
    a -> e dashed
    scene "전달"
      a -> e time=1s
  `));
  for (const output of [await toSvg(result), await toSvg(result, { isStatic: true }), await toHtml(result)]) {
    assert.doesNotMatch(output, /stroke-dasharray="/);
    assert.doesNotMatch(output, /<[^>]*fill="var\(--color-ui-card\)"[^>]*class="fl-stroke/);
    assert.match(output, /class="fl-path dashed"/);
    assert.match(output, /\.fl :where\(\.fl-node\) > \.fl-stroke:where\(:not\(\[fill='none'\]\)\)/);
    assert.match(output, /\.fl \.fl-shape-external > :is\(\.fl-stroke, \.fl-pulse\)/);
  }
});
