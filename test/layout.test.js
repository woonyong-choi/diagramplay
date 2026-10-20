import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildFigure, toSvg } from '../src/index.js';
import { reflowFigure } from '../src/build.js';
import { buildModel } from '../src/layout/model.js';
import { compactOrderVariants, orderCompactGroups } from '../src/layout/order.js';
import { viewFigure } from '../src/views.js';

// #390: 두 분기가 같은 목적지를 공유하는 실제 문서 구조. 카드와 라벨은 줄이지 않는다.
const SOURCE = String.raw`diagramplay
group db "DB 파일" dashed {
  box previous "이전 제어" "\`control g-1\` · 슬롯 A"
  box current "현재 제어" "\`control g\` · 슬롯 B" tone=blue appearance=filled
  box oldcat "옛 카탈로그" "\`catalog overflow\`"
  box newcat "새 카탈로그" "\`catalog overflow\`"
  box oldroots "T 옛 루트" "변경한 테이블 T"
  box shared "공유 루트" "미변경 테이블 U" tone=blue appearance=filled
  box newroots "T 새 루트" "변경한 테이블 T"
}
previous -> oldcat "catalog head · size"
current -> newcat "catalog head · size"
oldcat -> oldroots "T: heap · 색인"
oldcat -> shared "U: heap · 색인"
newcat -> shared "U: heap · 색인"
newcat -> newroots "T: heap · 색인"
scene "현재 참조" mode=loop
  current -> newcat time=1000ms
  newcat -> newroots time=1000ms
  wait 1200ms
scene "공유 루트" mode=loop
  previous -> oldcat & current -> newcat time=1000ms
  oldcat -> shared & newcat -> shared time=1000ms
  wait 1200ms
`.replaceAll('\\`', '`');

function routeLength(edge) {
  return edge.points.slice(1).reduce((sum, point, i) => sum + Math.abs(point.x - edge.points[i].x) + Math.abs(point.y - edge.points[i].y), 0);
}

test('buildFigure_narrow_shared_destination_reduces_detours_without_losing_content', async () => {
  const wide = await buildFigure(SOURCE, { layoutWidth: 1000, strict: true });
  const original = structuredClone(wide.figure);
  const narrow = await reflowFigure(wide, { layoutWidth: 390, strict: true });
  const lengths = narrow.scene.edges.map(routeLength);

  assert.ok(narrow.scene.width <= 390);
  assert.ok(Math.max(...lengths) < 600, `longest route ${Math.max(...lengths)}`);
  assert.ok(lengths.reduce((a, b) => a + b) < 2400);
  assert.equal(narrow.scene.items.length, 7);
  assert.equal(narrow.scene.edges.length, 6);
  assert.equal(narrow.scene.items.filter(item => item.id === 'shared').length, 1);
  assert.deepEqual(narrow.scene.items.map(item => item.id), wide.scene.items.map(item => item.id));
  assert.deepEqual(narrow.scene.edges.map(({ from, to, label }) => [from, to, label]), wide.scene.edges.map(({ from, to, label }) => [from, to, label]));
  assert.deepEqual(narrow.scene.items.map(item => item.texts.map(text => [text.text, text.style.size])), wide.scene.items.map(item => item.texts.map(text => [text.text, text.style.size])));
  assert.deepEqual(wide.figure, original);
  assert.deepEqual(narrow.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]), wide.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]));
  assert.equal(await toSvg(narrow), await toSvg(await reflowFigure(wide, { layoutWidth: 390, strict: true })));
  for (const layoutWidth of [800, 1000]) {
    const result = await buildFigure(SOURCE, { layoutWidth, strict: layoutWidth >= wide.scene.width });
    assert.ok(result.warnings.every(warning => warning.code === 'layout-width'));
    assert.equal(result.scene.width, wide.scene.width);
    assert.equal(result.scene.height, 361);
    assert.ok(Math.abs(Math.max(...result.scene.edges.map(routeLength)) - 196.43515625) < 0.01);
  }
});

// #390: 선택적 후보의 기하 해석 실패가 기존 유효 모바일 후보까지 버리는지 격리된 실제 배치 진입점으로 확인한다.
test('layoutOrFail_optional_candidate_failure_preserves_the_fitting_original', async () => {
  const wide = await buildFigure(SOURCE, { layoutWidth: 1000, strict: true });
  const figure = viewFigure(wide.figure, wide.figure.views[0]);
  const sizes = new Map(wide.scene.items.map(item => [item.id, item.size]));
  const elkUrl = import.meta.resolve('elkjs/lib/elk.bundled.js');
  const errorUrl = new URL('../src/layout/error.js', import.meta.url).href;
  for (const failure of ['route', 'geometry', 'width']) {
    const fake = `import ELK from ${JSON.stringify(elkUrl)};
    import { LayoutError } from ${JSON.stringify(errorUrl)};
    export const calls = [];
    export default class {
      constructor() {
        const engine = new ELK();
        let compact = 0;
        this.layout = async graph => {
          const isCompact = graph.children.some(child => child.layoutOptions?.['elk.layered.layering.strategy'] === 'COFFMAN_GRAHAM');
          calls.push(isCompact);
          const optional = isCompact && ++compact > 1;
          if (optional && ${JSON.stringify(failure)} === 'route') throw new LayoutError('optional candidate route is invalid');
          const laid = await engine.layout(graph);
          if (optional && ${JSON.stringify(failure)} === 'geometry') Object.assign(laid.children[0].children[1], { x: laid.children[0].children[0].x, y: laid.children[0].children[0].y });
          if (optional && ${JSON.stringify(failure)} === 'width') laid.width = 500;
          return laid;
        };
      }
    }`;
    const replacement = `data:text/javascript,${encodeURIComponent(fake)}`;
    const { calls } = await import(replacement);
    const graphUrl = new URL('../src/layout/graph.js', import.meta.url);
    const code = readFileSync(graphUrl, 'utf8').replace(/from '([^']+)'/g, (_, specifier) => `from ${JSON.stringify(specifier === 'elkjs/lib/elk.bundled.js' ? replacement : specifier.startsWith('.') ? new URL(specifier, graphUrl).href : import.meta.resolve(specifier))}`);
    const { layoutOrFail } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const scene = await layoutOrFail(figure, sizes, { width: 390 });

    assert.equal(scene.width, 305.959375, `${failure}: keep the original fitting candidate`);
    assert.equal(scene.height, 977, failure);
    assert.equal(scene.items.length, 7);
    assert.equal(scene.edges.length, 6);
    assert.ok(calls.length <= 12, `${failure}: no more than four extra ELK calls`);
    assert.ok(calls.filter(Boolean).length <= 5, failure);
  }
});

test('buildFigure_supported_large_shapes_preserve_ids_cycles_directions_and_reflow_state', async () => {
  for (const [kind, count] of [['branch', 16], ['chain', 32], ['cycle', 12], ['explicit', 17]]) {
    const nodes = Array.from({ length: count }, (_, i) => `box n${i} "N${i}" "entry pointer"`).join('\n');
    const isBranch = kind === 'branch' || kind === 'explicit';
    const links = isBranch ? [['n0', 'n2'], ['n1', 'n3'], ...Array.from({ length: count - 4 }, (_, i) => [`n${i % 2 + 2}`, `n${i + 4}`]), ['n2', 'n5']] : Array.from({ length: count - 1 }, (_, i) => [`n${i}`, `n${i + 1}`]);
    if (kind === 'cycle') links.push([`n${count - 1}`, 'n0']);
    const source = `diagramplay\ngroup g "Group" ${kind === 'explicit' ? 'direction=right' : ''} {\n${nodes}\n}\n${links.map(([a, b]) => `${a} -> ${b}`).join('\n')}\nscene "route" mode=loop\n  n0 -> ${isBranch ? 'n2' : 'n1'} time=1000ms\n  wait 1000ms\n`;
    const original = await buildFigure(source, { layoutWidth: 1000 });
    const saved = structuredClone(original.figure);
    const narrow = await reflowFigure(original, { layoutWidth: 390 });

    assert.deepEqual(original.figure, saved, kind);
    assert.deepEqual(narrow.scene.items.map(item => item.id).sort(), saved.nodes.map(node => node.id).sort(), kind);
    assert.deepEqual(narrow.scene.edges.map(({ from, to }) => [from, to]), links, kind);
    assert.deepEqual(narrow.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]), original.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]), kind);
    if (kind === 'branch') {
      assert.ok(narrow.scene.width <= 390);
      for (const [from, to] of links) assert.ok(narrow.scene.items.find(node => node.id === from).y < narrow.scene.items.find(node => node.id === to).y);
    }
    if (kind === 'explicit') assert.ok(narrow.scene.items.every(item => item.direction === 'right'));
    assert.ok(narrow.warnings.every(warning => ['layout-width', 'check-9'].includes(warning.code)), kind);
  }
});

test('orderCompactGroups_bounded_topological_candidates_preserve_model_identity_and_constraints', async () => {
  const built = await buildFigure(SOURCE, { layoutWidth: 1000, strict: true });
  const figure = { ...viewFigure(built.figure, built.figure.views[0]), direction: 'down' };
  const sizes = new Map(built.scene.items.map(item => [item.id, item.size]));
  const original = structuredClone(figure);
  const variants = compactOrderVariants();
  assert.equal(variants.length, 4);
  for (const variant of variants) {
    const model = buildModel(figure, sizes);
    const edges = structuredClone(model.edges);
    orderCompactGroups(model, variant);
    const order = model.containers.get('db').children;
    for (const edge of model.edges) assert.ok(order.indexOf(edge.from) < order.indexOf(edge.to));
    assert.deepEqual([...model.nodes.keys()], figure.nodes.map(node => node.id));
    assert.deepEqual(model.edges, edges);
  }
  assert.deepEqual(figure, original);
  for (const kind of ['chain', 'cycle', 'horizontal', 'large', 'node-budget', 'edge-budget']) {
    const model = buildModel(figure, sizes);
    const group = model.containers.get('db');
    if (kind === 'chain') model.pieces = new Map([...model.pieces].slice(0, 2));
    if (kind === 'cycle') group.hasBack = true;
    if (kind === 'horizontal') group.direction = 'right';
    if (kind === 'large') group.children = Array.from({ length: 17 }, (_, i) => `extra-${i}`);
    if (kind === 'node-budget') for (let i = 0; i < 65; i++) model.nodes.set(`extra-${i}`, {});
    if (kind === 'edge-budget') model.edges = Array.from({ length: 129 }, () => model.edges[0]);
    const before = structuredClone(model);
    for (const variant of variants) assert.equal(orderCompactGroups(model, variant), false, kind);
    assert.deepEqual(model, before, kind);
  }
});
