import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMPARISON_EXAMPLES } from '../scripts/lib/comparison-examples.mjs';

import { isSoundGraph } from '../src/check/figure.js';
import { checkDocs } from '../src/compile/docs-check.js';
import { reflowFigure } from '../src/compile/figure.js';
import { viewFigure } from '../src/compile/views.js';
import { buildFigure, toSvg } from '../src/index.js';
import { buildModel } from '../src/layout/model.js';
import { compactOrderVariants, orderCompactGroups } from '../src/layout/order.js';

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

test('buildFigure_complex_groups_keep_the_entry_handoff_aligned_without_dropping_connections', async () => {
  const source = new URL('../examples/authentication/commerce-system.diagramplay', import.meta.url);
  const result = await buildFigure(readFileSync(source, 'utf8'), { baseDir: fileURLToPath(new URL('.', source)), strict: true });
  assert.equal(result.scene.items.length, 36);
  assert.equal(result.scene.groups.length, 9);
  assert.deepEqual(result.scene.edges.map(({ from, to }) => [from, to]), result.figure.edges.map(({ from, to }) => [from, to]));
  const clients = result.scene.groups.find(group => group.id === 'clients');
  const entry = result.scene.groups.find(group => group.id === 'edge');
  assert.ok(Math.abs(clients.y + clients.h / 2 - entry.y - entry.h / 2) < 1, 'entry groups share a centre instead of forming a staircase');
  assert.ok(result.scene.width * result.scene.height < 4000000, 'the same graph avoids the previous 4.9 million square-unit frame');
  for (const edge of result.scene.edges.filter(edge => edge.to === 'waf')) assert.ok(edge.points.length <= 4, `${edge.from}: an unrelated label error must not retain the six-turn group detour`);
  const published = result.scene.edges.find(edge => edge.from === 'relay' && edge.to === 'ordertopic');
  assert.ok(published.points.length <= 4, 'a rounded ELK port must not block the short path into the queue');
});

test('buildFigure_default_graph_keeps_a_wide_chain_straight_and_leaves_display_diagnostics_to_docs', async () => {
  const names = ['header', 'payload', 'signature', 'issuer', 'audience', 'expiry', 'subject', 'issued'];
  const source = `diagramplay\n${names.map(id => `box ${id} "${id}"`).join('\n')}\n${names.slice(1).map((id, i) => `${names[i]} -> ${id}`).join('\n')}\nview graph right\n`;
  const result = await buildFigure(source, { strict: true });
  assert.ok(result.scene.width > 960, 'the natural layout can exceed a document canvas');
  assert.ok(result.scene.items.every((item, i, items) => i === 0 || item.x > items[i - 1].x));
  assert.ok(result.scene.edges.every(edge => edge.points.length === 2), 'a plain chain has no wraparound route');
  assert.deepEqual(result.warnings, []);
  assert.ok((await checkDocs(result)).some(problem => problem.code === 'check-10'), 'small text at a fixed document width remains an explicit diagnostic');
});

test('buildFigure_store_reply_uses_the_face_toward_the_requester_in_both_directions', async () => {
  for (const direction of ['right', 'down']) {
    const result = await buildFigure(`diagramplay\nbox server "Server"\nstore db "Database"\nserver -> db "Request"\ndb -> server "Reply" dashed\nview graph ${direction}\n`, { strict: true });
    const db = result.scene.items.find(item => item.id === 'db');
    const reply = result.scene.edges.find(edge => edge.from === 'db');
    const start = reply.points[0];
    assert.ok(direction === 'right' ? Math.abs(start.x - db.x) < 0.5 : start.y <= db.y, `${direction}: the reply leaves the near face`);
    const end = reply.points.at(-1);
    const distance = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
    assert.ok(routeLength(reply) < distance + 2 * Math.min(db.w, db.h), `${direction}: the reply does not wrap around the database`);
  }
});

test('buildFigure_narrow_disconnected_workers_preserves_cards_in_one_column', async () => {
  const source = `diagramplay
width wide
group workers "처리 워커" {
  box a "워커 A" {
    value job-a "마지막 작업" from=없음
    value permission-a "처리 권한" from=없음
    value rejected "거절된 ACK" from=0
  }
  box b "워커 B" {
    value job-b "마지막 작업" from=없음
    value permission-b "처리 권한" from=없음
  }
}`;
  const wide = await buildFigure(source, { layoutWidth: 1000, strict: true });
  const narrow = await reflowFigure(wide, { layoutWidth: 390, strict: true });

  assert.ok(narrow.scene.width <= 390);
  assert.deepEqual(narrow.scene.items.map(item => item.size), wide.scene.items.map(item => item.size));
  assert.equal(narrow.scene.items[0].x, narrow.scene.items[1].x);
  assert.notEqual(narrow.scene.items[0].y, narrow.scene.items[1].y);
});

// #392: 공개 transaction-queue와 같은 카드·그룹·복귀선 구조의 최소 재현이며 실행 기록 원본이 아니다.
test('buildFigure_narrow_worker_return_keeps_moving_words_visible_and_reflow_times', async () => {
  const source = `diagramplay
width wide
pace 650ms
box request "주문 요청"
box transaction "쓰기 트랜잭션" {
  value pending-orders "미확정 주문" from=0
  value pending-jobs "미확정 작업" from=0
}
group database "같은 DB 파일" {
  store records "저장된 데이터" {
    value db-orders "주문" from=0
    value db-leased "처리 중" from=0
    value db-acked "ACK 완료" from=0
  }
  queue shipping "대기 작업" slots=3
}
group workers "처리 워커" {
  box worker-a "워커 A" {
    value job-a "마지막 작업" from=없음
    value fence-a "처리 권한" from=없음
    value rejected "거절된 ACK" from=0
  }
  box worker-b "워커 B" {
    value job-b "마지막 작업" from=없음
    value fence-b "처리 권한" from=없음
  }
}
external api "외부 API" "모의 함수" {
  value api-calls "호출 횟수" from=0
}
request -> transaction "주문·작업"
transaction -> records "함께 확정"
transaction -> request "취소" dashed quiet
shipping -> worker-a "작업 획득"
shipping -> worker-b "재획득" quiet
worker-a -> api "API 호출"
worker-b -> api "다시 요청" quiet
worker-a -> records "ACK" dashed
worker-b -> records "ACK" dashed quiet
scene "중단 · 재전달" mode=loop
  request -> transaction "작성 중" time=750ms
  transaction -> records time=750ms
  shipping -> worker-a time=750ms
  worker-a -> api time=750ms
  light worker-a
  show worker-a "ACK 없이 중단" tag="중단" tone=red
  light records
  show records "만료돼도 처리 중 유지" tag="만료" tone=orange
  shipping -> worker-b time=750ms
  worker-a -> records "이전 권한" time=750ms set="rejected=1"
  show worker-a "이전 권한 ACK 거부" tag="거부" tone=red
  worker-b -> api time=750ms
  worker-b -> records time=750ms
  wait 1400ms
scene "확정 전 취소" mode=loop
  transaction -> request time=750ms
`;
  const wide = await buildFigure(source, { layoutWidth: 1000, strict: true });
  const original = structuredClone(wide);
  for (const narrow of [await buildFigure(source, { layoutWidth: 390, strict: true }), await reflowFigure(wide, { layoutWidth: 390, strict: true })]) {
    assert.ok(narrow.scene.width <= 390);
    assert.deepEqual(narrow.warnings, []);
    assert.deepEqual(narrow.scene.items.map(item => item.size), wide.scene.items.map(item => item.size));
    assert.deepEqual(narrow.figure, wide.figure);
    assert.deepEqual(narrow.scene.edges.map(({ from, to, label }) => [from, to, label]), wide.scene.edges.map(({ from, to, label }) => [from, to, label]));
  }
  const reflowed = await reflowFigure(wide, { layoutWidth: 390, strict: true });
  assert.deepEqual(reflowed.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]), wide.timeline.segs.map(({ t0, t1, si }) => [t0, t1, si]));
  assert.deepEqual(wide, original);
  for (const layoutWidth of [1000, 1440]) {
    const desktop = await buildFigure(source, { layoutWidth, strict: true });
    const repeated = await buildFigure(source, { layoutWidth, strict: true });
    assert.deepEqual(desktop.scene, repeated.scene);
    assert.deepEqual(desktop.timeline, repeated.timeline);
  }
});

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
    assert.equal(result.scene.height, wide.scene.height);
    assert.equal(Math.max(...result.scene.edges.map(routeLength)), Math.max(...wide.scene.edges.map(routeLength)));
  }
});

// #390: 선택적 후보의 기하 해석 실패가 기존 유효 모바일 후보까지 버리는지 격리된 실제 배치 진입점으로 확인한다.
test('layoutOrFail_optional_candidate_failure_preserves_the_fitting_original', async () => {
  const wide = await buildFigure(SOURCE, { layoutWidth: 1000, strict: true });
  const fitting = await reflowFigure(wide, { layoutWidth: 390, strict: true });
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
    const scene = await layoutOrFail(figure, sizes, { width: 390, isSound: isSoundGraph });

    assert.equal(scene.width, fitting.scene.width, `${failure}: keep the original fitting candidate`);
    assert.equal(scene.height, 977, `${failure}: retain the original candidate before optional compaction`);
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

// #417: 무작위 구조 그림에서 찾은 원본의 최소화본. elkjs 교차 줄이기가 고른 층 안 순서에서 라벨 자리 고르기가 빈 자리를 찾지 못하거나 두 선이 붙고, 그룹 제목이 선만 비켜 먼저 놓인 라벨과 겹친다.
const SOUND_LAYOUT_SOURCES = [
  // 선 라벨이 바깥 그룹 제목과 겹침
  String.raw`diagramplay
box n0 "n0"
box n1 "n1"
group outer "바깥" direction=down {
group g0 "그룹0" {
  box n2 "n2"
  external n3 "n3"
  store n5 "n5"
}
}
n2 -> n1
n0 -> n3
n3 -> n0
n0 -> n5 "l7"
`,
  // 같은 도형에서 나가는 두 꼬리 라벨이 겹침
  String.raw`diagramplay
store n0 "n0"
group g0 "그룹0" {
  grid n1 "n1" {
    item c8 "A"
  }
  box n2 "n2"
  external n3 "n3"
}
person n5 "n5"
n5 -> n3
n0 -> n1.c8
n5 -> n2 "l3"
n5 -> n0 "l4"
`,
  // 같은 도형에서 나가는 두 꼬리 라벨이 겹침
  String.raw`diagramplay
box n0 "n0"
box n1 "n1"
group outer "바깥" {
group g0 "그룹0" {
  box n3 "n3"
}
}
group g1 "그룹1" direction=down {
  box n5 "n5"
  box n6 "n6"
  box n7 "n7"
}
n6 -> n7 "l0"
n7 -> n5 "l2"
n5 -> n3 "l4"
n5 -> n1 "l5" no=3
n3 -> n7 "l8"
`,
  // 두 선이 너무 붙음
  String.raw`diagramplay
box n0 "n0"
box n1 "n1"
box n2 "n2"
box n3 "n3"
box n5 "n5"
n3 -> n2 "l0"
n1 -> n2 "l1"
n0 -> n2 "l4"
n0 -> n5 "l6"
n3 -> n5 "l8"
`,
  // 선 라벨이 그룹 제목과 겹침
  String.raw`diagramplay
box n0 "n0"
group g0 "그룹0" direction=right {
  box n1 "n1"
  box n2 "n2"
  box n3 "n3"
}
group g1 "그룹1" direction=right {
  box n5 "n5"
  box n6 "n6"
}
box n8 "n8"
n0 -> n6 "l0"
n5 -> n0 "l1"
n1 -> n0 "l2"
n6 -> n3 "l5"
n2 -> n6 "l6"
n1 -> n8 "l7"
n3 -> n0 "l9"
n1 -> n2 "l10"
n8 -> n3 "l11"
n1 -> n3 "l13"
n2 -> n3 "l15"
`,
  // 같은 도형에서 나가는 두 꼬리 라벨이 겹침
  String.raw`diagramplay
box n0 "n0"
group g0 "그룹0" {
  box n1 "n1"
  box n2 "n2"
}
n1 -> n0 "l0"
n0 -> n2 "l2"
n0 -> n1 "l3"
`,
  // 선 라벨이 그룹 제목 줄 높이에 놓이고 제목이 선만 비켜 라벨과 겹침(seed 2)
  String.raw`diagramplay
box n0 "n0"
box n1 "n1"
group g0 "그룹0" direction=down {
  box n2 "n2"
  box n3 "n3"
  box n4 "n4"
}
n3 -> n2 "l0"
n0 -> n3 "l1"
n0 -> n4 "l2"
n3 -> n1 "l3"
n4 -> n2 "l4"
n3 -> n0 "l5"
n1 -> n0 "l6"
`,
  // 선 라벨이 그룹 제목 줄 높이에 놓이고 제목이 선만 비켜 라벨과 겹침(seed 2)
  String.raw`diagramplay
box n0 "n0"
box n1 "n1"
group outer "바깥" direction=down {
group g0 "그룹0" {
  box n3 "n3"
  box n4 "n4"
}
}
n1 -> n4 "l0"
n4 -> n1 "l2"
n1 -> n0 "l5"
n1 -> n3 "l6"
`,
];

test('buildFigure_fuzz_sources_from_417_pass_figure_check', async () => {
  for (const source of SOUND_LAYOUT_SOURCES.filter(source => !/\bgrid /.test(source))) {
    const built = await buildFigure(source, { strict: true });
    assert.ok(built.scene.edges.length > 0, source);
  }
});

test('relationship pills prefer the route center and move aside only for occupied space', async () => {
  const { settleLabels } = await import('../src/layout/labels.js');
  const edge = () => ({ label: 'request', no: 3, points: [{ x: 0, y: 100 }, { x: 400, y: 100 }], labelAt: { x: 40, y: 80 } });
  const clear = edge();
  settleLabels([clear], [], { width: 400, height: 250 });
  assert.equal(clear.labelAt.x, 200, 'the number and text share the route center');
  const blocked = edge();
  settleLabels([blocked], [{ x: 175, y: 60, w: 50, h: 80 }], { width: 400, height: 250 });
  assert.notEqual(blocked.labelAt.x, 200, 'occupied center cannot be used');
  assert.ok(Math.abs(blocked.labelAt.x - 200) < 160, 'the nearest clear position stays closer to the center than the old tail position');
});

test('centered_labels_keep_cookie_request_text_visible_through_safe_layout_fallbacks', async () => {
  const source = readFileSync(new URL('../examples/authentication/sessions.diagramplay', import.meta.url), 'utf8');
  const result = await buildFigure(source, { strict: true });
  assert.equal(result.warnings.filter(warning => warning.code === 'check-7').length, 0);
  assert.ok(result.scene.edges.some(edge => edge.label === '로그인'));
});

test('number_only_badges_stay_on_their_own_route_and_away_from_rounded_turns', async () => {
  const { settleLabels } = await import('../src/layout/labels.js');
  const edge = { index: 0, no: 2, points: [{ x: 40, y: 100 }, { x: 240, y: 100 }, { x: 240, y: 300 }], labelAt: { x: 220, y: 75 } };
  settleLabels([edge], [], { width: 400, height: 400 });
  const { x, y } = edge.labelAt;
  assert.ok((y === 100 && x >= 40 && x <= 240) || (x === 240 && y >= 100 && y <= 300), 'a number is attached to its own line');
  assert.ok(Math.hypot(x - 240, y - 100) > 20, 'a rounded turn has no floating badge');
});


test('sequence_labels_prefer_the_message_center_without_covering_intermediate_lifelines', async () => {
  const { sequenceLabelX } = await import('../src/layout/sequence-labels.js');
  assert.equal(sequenceLabelX(0, 400, [0, 400], 80), 200);
  assert.equal(sequenceLabelX(400, 0, [0, 400], 80), 200);
  const around = sequenceLabelX(0, 600, [0, 300, 600], 80);
  assert.ok(Math.abs(around - 300) >= 48, 'an intermediate lifeline is outside the pill and its clearance');
  assert.ok(Math.abs(around - 300) < Math.abs(48 - 300), 'the nearest safe center beats a sender-aligned label');
});

test('composite_fk_multiplicities_stay_beside_their_endpoint_route_without_crossing_parallel_relations', async () => {
  const { scene } = await buildFigure(COMPARISON_EXAMPLES.find(example => example.id === 'schema').source, { strict: true });
  const labels = scene.edges.flatMap(edge => edge.endpointLabels ?? []);
  assert.ok(labels.some(label => label.text === '0..*'));
  for (const label of labels) {
    const box = { left: label.x - label.w / 2, right: label.x + label.w / 2, top: label.y - label.h / 2, bottom: label.y + label.h / 2 };
    for (const edge of scene.edges) for (let index = 1; index < edge.points.length; index++) {
      const [a, b] = [edge.points[index - 1], edge.points[index]];
      const crosses = Math.min(a.x, b.x) < box.right && Math.max(a.x, b.x) > box.left && Math.min(a.y, b.y) < box.bottom && Math.max(a.y, b.y) > box.top;
      assert.equal(crosses, false, `${label.text}: ${edge.from} -> ${edge.to}`);
    }
  }
});

test('relational_layout_shortens_complex_class_and_schema_routes_without_dropping_content', async () => {
  const metrics = scene => {
    const routes = scene.edges.map(edge => edge.points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - edge.points[index].x) + Math.abs(point.y - edge.points[index].y), 0));
    return { area: scene.width * scene.height, length: routes.reduce((sum, length) => sum + length, 0), longest: Math.max(...routes) };
  };
  for (const id of ['class', 'schema']) {
    const source = COMPARISON_EXAMPLES.find(example => example.id === id).source;
    const original = await buildFigure(source, { strict: true, layoutWidth: Number.MAX_SAFE_INTEGER });
    const compact = await buildFigure(source, { strict: true });
    assert.deepEqual(compact.figure.nodes, original.figure.nodes, `${id}: keep every field and member`);
    assert.deepEqual(compact.figure.edges, original.figure.edges, `${id}: keep every relationship and endpoint`);
    assert.deepEqual(compact.timeline.steps, original.timeline.steps, `${id}: keep every playback scene`);
    assert.deepEqual(compact.scene.items.map(item => item.id).sort(), original.scene.items.map(item => item.id).sort());
    const before = metrics(original.scene), after = metrics(compact.scene);
    for (const key of ['area', 'length', 'longest']) assert.ok(after[key] < before[key], `${id}/${key}: ${after[key]} < ${before[key]}`);
  }
});
