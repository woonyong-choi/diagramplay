import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FigureError, toHtml, toSvg } from 'diagramplay';
import { runAtomicUpdate } from '../src/timeline/values.js';
import { build, diagramplay, findAll, lineOf, parseMarkup, reject, textContent, textsOf } from './support.js';

function source(options, scenes = '', extra = '') {
  return diagramplay(`box a "A"\nbox b "B" {\nvalue n "Count" ${options}\n}\na -> b\n${extra}\n${scenes}`);
}

function variants(svg) {
  return findAll(parseMarkup(svg), (node) => node.attrs['data-v'] !== undefined && node.attrs['data-t'] !== undefined);
}

function fillRects(node) {
  return findAll(node, (child) => child.attrs.class === 'queue-fill').flatMap((group) => findAll(group, (child) => child.tag === 'rect'));
}

test('toSvg_indicators_show_current_max_and_zero_mid_full_fill', async () => {
  for (const display of ['bar', 'slots']) {
    for (const [from, expected] of [[0, 0], [2, 2], [4, 4]]) {
      const built = await build(source(`display=${display} max=4 from=${from}`));
      const svg = await toSvg(built);
      const [variant] = variants(svg);
      const fills = fillRects(variant);
      const empty = variant.children.filter((child) => child.tag === 'rect');

      assert.equal(variant.attrs['data-t'], String(from));
      assert.equal(textContent(variant).trim(), `${from} / 4`);
      assert.equal(fills.length, display === 'slots' ? expected : expected === 0 ? 0 : 1);
      if (display === 'bar' && from > 0) assert.ok(Math.abs(Number(fills[0].attrs.width) / Number(empty[0].attrs.width) - from / 4) < 0.001);
      assert.equal(built.timeline.values[0].initial, String(from));
      assert.equal(built.timeline.values[0].slots, undefined);
    }
  }
});

test('buildFigure_indicator_options_and_types_reject_invalid_declarations_and_updates', async () => {
  const invalid = [
    'display=bar', 'max=4', 'display=pie max=4', 'display=bar max=0', 'display=bar max=-1',
    'display=bar max=Infinity', 'display=bar max=1e2', 'display=bar max="4"', 'display=bar max=word',
    'display=slots max=1.5', 'display=slots max=33', 'display=slots max=4 from=0.5', 'display=bar max=4 from=word',
  ];
  for (const options of invalid) assert.ok((await reject(source(options))).some((p) => p.severity === 'error'), options);
  for (const [display, expression] of [['bar', 'n=word'], ['slots', 'n=0.5'], ['slots', 'n+0.5']]) {
    assert.ok((await reject(source(`display=${display} max=4`, `scene "S" set="${expression}"`))).some((p) => p.severity === 'error'));
  }
  await build(source('display=bar max=2.5 from=1.25'));
  for (const max of [1, 32]) await build(source(`display=slots max=${max}`));
  for (const max of ['4.0000000000000001', '0.99999999999999999']) {
    const input = source(`display=slots max=${max}`);
    const problems = await reject(input);

    assert.ok(problems.some((p) => p.severity === 'error' && p.line === lineOf(input, 'value n') && p.message.includes('a whole max') && p.message.includes(max)), JSON.stringify(problems));
  }
  for (const [literal, expected] of [['-02.0', '-2'], ['00.0', '0'], ['02.000', '2']]) {
    const built = await build(source(`display=slots max=04.0 from=${literal}`), { strict: false });

    assert.equal(built.timeline.values[0].initial, expected);
  }
});

test('buildFigure_indicator_reference_followers_constrain_the_hidden_root_and_dynamic_reads', async () => {
  const head = 'box a "A"\nbox b "B"\na -> b\nvalue root "Root" from=0\nvalue link "Link" ref=root\nvalue n "N" on=b ref=link display=slots max=4\nvalue spare "Spare" from=0.5';
  for (const sets of ['root=word', 'root=0.5', 'root:=spare']) {
    const problems = await reject(diagramplay(`${head}\nscene "S"\na -> b set="${sets}"`));
    assert.ok(problems.some((p) => /number/.test(p.message)), sets);
  }
  assert.ok((await reject(diagramplay(head.replace('root "Root" from=0', 'root "Root" from=0.5')))).some((p) => /number/.test(p.message)));
  const built = await build(diagramplay(`${head.replace('spare "Spare" from=0.5', 'spare "Spare" from=3')}\nscene "S" mode=static\na -> b set="root:=spare"`));
  assert.ok(textsOf(parseMarkup(await toSvg(built, { isStatic: true }))).includes('3 / 4'));
});

test('buildFigure_slots_reject_unrounded_fractional_literals_at_the_source_line', async () => {
  for (const [id, declaration] of [
    ['n', 'value n "N" on=b display=slots max=4 from=0'],
    ['root', 'value root "Root" from=0\nvalue link "Link" ref=root\nvalue n "N" on=b ref=link display=slots max=4'],
  ]) {
    const head = `box a "A"\nbox b "B"\na -> b\n${declaration}`;
    for (const literal of ['0.0000001', '0.9999999', '0.99999999999999999', '1.0000000000000001']) {
      for (const [body, needle] of [
        [head.replace('from=0', `from=${literal}`), `from=${literal}`],
        [`${head}\nscene "S" set="${id}=${literal}"`, 'scene "S"'],
        [`${head}\non b ${id}=${literal}`, 'on b'],
        [`${head}\nscene "S"\na -> b set="${id}=${literal}"`, 'set='],
        [`${head}\nscene "S"\na -> b set="${id}+${literal}"`, 'set='],
        [`${head}\nscene "S"\na -> b set="${id}-${literal}"`, 'set='],
        [`${head}\nscene "S"\na -> b when="${id}<4" reserve="${id}=${literal}"`, 'reserve='],
      ]) {
        const input = diagramplay(body);
        const problems = await reject(input);

        assert.ok(problems.some((p) => p.severity === 'error' && p.line === lineOf(input, needle) && p.message.includes('a whole number') && p.message.includes(literal)), JSON.stringify(problems));
      }
    }
  }
});

test('buildFigure_plain_and_bar_values_keep_six_decimal_literal_normalization', async () => {
  for (const display of ['', 'display=bar max=4']) {
    for (const [literal, expected] of [['0.0000001', '0'], ['0.9999999', '1'], ['0.99999999999999999', '1'], ['1.0000000000000001', '1']]) {
      const initial = await build(source(`${display} from=${literal}`));
      const assigned = await build(source(`${display} from=2`, `scene "S" set="n=${literal}"`));

      assert.equal(initial.timeline.values[0].initial, expected);
      assert.equal(assigned.timeline.values[0].initial, expected);
      assert.ok(textsOf(parseMarkup(await toSvg(assigned, { isStatic: true }))).includes(display ? `${expected} / 4` : expected));
    }
    for (const [expression, expected] of [['n+0.0000001', '2'], ['n-0.0000001', '2'], ['n+0.9999999', '3'], ['n-0.9999999', '1']]) {
      const built = await build(source(`${display} from=2`, `scene "S"\na -> b set="${expression}"`));

      assert.equal(built.timeline.values[0].periods.at(-1)[2], expected);
    }
    const shared = await build(diagramplay(`box a "A"\nbox b "B"\nbox c "C"\na -> c\nb -> c\nvalue n "N" on=c ${display} from=2\nscene "S"\ntrack a, b -> c set="n+0.0000001"`));

    assert.equal(shared.timeline.values[0].periods.at(-1)[2], '2');
  }
});

test('toSvg_indicator_overflow_preserves_numbers_and_warns_once_per_side_per_value', async () => {
  const built = await build(source('display=slots max=4', 'scene "S"\na -> b set="n=-2"\na -> b set="n=6"\na -> b set="n=-1"\na -> b set="n=7"\nscene "T" set="n=8"'), { strict: false });
  const warnings = built.warnings.filter((warning) => warning.code === 'check-14');
  assert.equal(warnings.length, 2);
  const nodes = variants(await toSvg(built));
  assert.equal(fillRects(nodes.find((node) => node.attrs['data-t'] === '-2')).length, 0);
  assert.equal(fillRects(nodes.find((node) => node.attrs['data-t'] === '7')).length, 4);
  assert.ok(textContent(nodes.find((node) => node.attrs['data-t'] === '7')).includes('7 / 4'));
  assert.equal(built.timeline.values[0].periods.at(-1)[2], '7');
});

test('toSvg_indicator_geometry_and_long_denominator_are_measured_before_playback', async () => {
  const built = await build(source('display=bar max=123456789012345', 'scene "S" mode=loop\na -> b set="n=12345678901234"\na -> b set="n=1"\nscene "T" keep="n"\na -> b set="n=2"'));
  const layouts = built.scene.items.find((item) => item.id === 'b').content.layouts;
  const laid = layouts[0].rows.find((row) => row.row.valueId === 'n');
  const svg = await toSvg(built);
  const nodes = variants(svg);
  const grounds = nodes.map((node) => node.children.filter((child) => child.tag === 'rect').map((node) => node.attrs));

  assert.ok(laid.valueSlot.lines > 1);
  assert.ok(laid.valueSlot.texts.has('12345678901234 / 123456789012345'));
  for (const rects of grounds) assert.deepEqual(rects, grounds[0]);
  assert.ok(layouts.every((layout) => layout.height <= built.scene.items.find((item) => item.id === 'b').content.h));
});

test('toSvg_and_toHtml_indicator_groups_use_existing_value_windows_and_raw_value_keys', async () => {
  const built = await build(source('display=slots max=4', 'scene "S" mode=loop\na -> b time=1s set="n+2"\na -> b time=1s set="n+2"'));
  const movingLayer = findAll(parseMarkup(await toSvg(built)), (node) => node.attrs.class === 'fl-motion')[0];
  const moving = findAll(movingLayer, (node) => node.attrs['data-v'] !== undefined && node.attrs['data-t'] !== undefined);
  for (const node of moving) {
    assert.ok(findAll(node, (child) => child.tag === 'animate').length);
    assert.ok(!node.attrs['data-t'].includes('/'));
  }
  const still = variants(await toSvg(built, { isStatic: true }));
  assert.equal(still.length, 1);
  assert.equal(still[0].attrs['data-t'], '4');
  assert.equal(fillRects(still[0]).length, 4);
  const html = await toHtml(built, 'Values');
  const htmlVariants = findAll(parseMarkup(html, { html: true }), (node) => node.attrs['data-v'] !== undefined && node.attrs['data-t'] !== undefined);
  assert.ok(htmlVariants.length >= 3);
  assert.ok(htmlVariants.every((node) => node.tag === 'g'));
});

test('buildFigure_indicator_concurrent_reservations_and_scene_keep_use_original_numeric_values', async () => {
  const built = await build(source('display=slots max=2', 'scene "S" mode=static\na -> b time=500ms when="n<2" reserve="n+1" & a -> b time=500ms when="n<2" reserve="n+1" & a -> b time=500ms when="n<2" reserve="n+1"\nscene "T" mode=static keep="n"\na -> b set="n-1"'));
  const rows = built.timeline.values;
  assert.equal(rows[0].periods.at(-1)[2], '2');
  assert.equal(rows[1].initial, '2');
  assert.equal(rows[1].periods.at(-1)[2], '1');
});

test('runAtomicUpdate_indicator_type_failure_does_not_commit_any_reservation', () => {
  const byId = new Map([['n', { id: 'n', from: '0', numericType: 'integer' }], ['other', { id: 'other', from: '5' }], ['word', { id: 'word', from: 'busy' }]]);
  const state = new Map([['n', '0'], ['other', '5'], ['word', 'busy']]);
  const writes = [];
  assert.throws(() => runAtomicUpdate([{ id: 'other', op: '-', operand: '1', line: 1 }, { id: 'n', op: ':=', operand: 'word', line: 1 }], { state, byId, onWrite: (e) => writes.push(e.id) }), FigureError);
  assert.deepEqual([...state], [['n', '0'], ['other', '5'], ['word', 'busy']]);
  assert.deepEqual(writes, []);
});

test('toSvg_plain_values_keep_original_text_and_do_not_gain_indicator_shapes', async () => {
  const built = await build(source('from=2', 'scene "S" mode=static\na -> b set="n+1"'));
  const [node] = variants(await toSvg(built, { isStatic: true }));
  assert.equal(node.tag, 'text');
  assert.equal(node.attrs['data-t'], '3');
  assert.equal(textContent(node), '3');
  assert.equal(findAll(node, (child) => child.tag === 'rect').length, 0);
});
