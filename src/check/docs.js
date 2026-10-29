// 문서 품질 검사의 구조 판정(docs-1~13). 원본 모형과 배치가 끝난 장면을 읽는다(docs/design/figure-quality.md).
// 항목 목록과 기준 수치는 docs-items.js다. 요구 항목과 본문 단 읽힘(docs-15, docs-16)은 docs-text.js다.
import { INNER_MAX } from '../measure/card.js';
import { measure, wrap } from '../measure/fonts.js';
import { STYLE } from '../measure/texts.js';
import { ROOT } from '../layout/model.js';
import { LIMITS } from './docs-items.js';

const TAGGED = new Set(['box', 'external', 'store']);
const PLAIN = new Set(['person', 'box', 'external', 'store']);
const NAMED = new Set(['person', 'box', 'external', 'store', 'queue']);
// 같은 줄과 같은 칸으로 묶는 가운데 좌표 차이(px)
const ROW_SLACK = 12;

const isFocal = (it) => it.appearance === 'filled' || it.appearance === 'outline';
const say = (problems, n) => (line, message) => problems.warn(line, message, { code: `docs-${n}` });

// cost: time O(s + e), heap O(s + e), stack O(1)
// vars: s = 도형 수, e = 선 수
// basis: estimate
/** 그래프 보기마다 { view, items, edges }. items는 배치한 카드, edges는 그 보기의 원본 선이다. */
export function graphViews({ figure, scene }) {
  return figure.views.filter((view) => view.strategy === 'graph').map((view) => ({
    view,
    items: scene.items.filter((it) => it.view === view.id),
    edges: (view.edgeIds ?? []).map((index) => figure.edges[index]).filter(Boolean),
  }));
}

// cost: time O(e), heap O(e), stack O(1)
// vars: e = 선 수
// basis: estimate
/** 선이 갈래 없이 한 줄로 이어져 보기의 모든 카드를 지나면 그 카드 수, 아니면 0. */
export function chainLength({ items, edges }) {
  if (!edges.length) return 0;
  const outs = new Map();
  const ins = new Map();
  for (const { from, to } of edges) {
    outs.set(from, (outs.get(from) ?? 0) + 1);
    ins.set(to, (ins.get(to) ?? 0) + 1);
  }
  const nodes = new Set([...outs.keys(), ...ins.keys()]);
  if ([...outs.values(), ...ins.values()].some((n) => n > 1)) return 0;
  if (edges.length !== nodes.size - 1 || nodes.size !== items.length) return 0;
  return nodes.size;
}

// cost: time O(n log n), heap O(n), stack O(1)
// vars: n = 값 수
// basis: estimate
// 가까운 값끼리 묶은 묶음마다 개수
function clusters(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const sizes = [];
  let last;
  for (const n of sorted) {
    if (last === undefined || n - last > ROW_SLACK) sizes.push(0);
    sizes[sizes.length - 1] += 1;
    last = n;
  }
  return sizes;
}

// cost: time O(n log n), heap O(n), stack O(1)
// vars: n = 카드 수
// basis: estimate
/** 카드들이 가로줄 여러 개로 접혀 놓였으면 가장 많이 든 줄의 카드 수, 한 줄이거나 줄마다 카드 하나(세로 배치)면 undefined. */
export function widestRow(items) {
  const rows = clusters(items.map((it) => it.y + it.h / 2));
  const widest = Math.max(0, ...rows);
  return rows.length < 2 || widest < 2 ? undefined : widest;
}

// cost: time O(s), heap O(s), stack O(1)
// vars: s = 도형 수
// basis: estimate
// docs-1: 꼬리표가 일부 카드에만 있다.
function checkBadges(context, problems) {
  const warn = say(problems, 1);
  for (const { items } of context.views) {
    const taggable = items.filter((it) => TAGGED.has(it.shape));
    const bare = taggable.filter((it) => !it.badge);
    if (!bare.length || bare.length === taggable.length) continue;
    for (const it of bare) warn(it.line, `card "${it.id}" has no badge while ${taggable.length - bare.length} other cards do. Add badge="..." so the kind of every card reads the same way`);
  }
}

// cost: time O(s + e), heap O(s + e), stack O(1)
// vars: s = 도형 수, e = 선 수
// basis: estimate
// docs-2: 카드가 모두 같은 모양이다. docs-3: 강조한 카드가 많다.
function checkLook(context, problems) {
  for (const entry of context.views) {
    // 내용 줄(값, 글 줄)이 있는 카드는 내용이 카드를 구별하므로 세지 않는다.
    const plain = entry.items.filter((it) => PLAIN.has(it.shape) && !it.content);
    const isFlowchart = entry.items.some((it) => it.shape === 'decision');
    if (plain.length < LIMITS.flat || isFlowchart || chainLength(entry)) continue;
    if (plain.some((it) => it.badge || isFocal(it))) continue;
    say(problems, 2)(entry.view.line ?? context.figure.line, `all ${plain.length} cards look the same. Add badge="..." for the kind of each card and tone= with appearance=filled on the one or two cards the text is about`);
  }
  const focal = context.scene.items.filter(isFocal);
  if (focal.length > LIMITS.focal) say(problems, 3)(focal[LIMITS.focal].line, `${focal.length} cards are highlighted (${focal.map((it) => it.id).join(', ')}). Keep appearance=filled or outline on at most ${LIMITS.focal} cards`);
}

// cost: time O(s·n), heap O(n), stack O(1)
// vars: s = 도형 수, n = 이름 글자 수
// basis: estimate
// docs-4: 이름이나 부제가 접힌다.
function checkNames(context, problems) {
  const warn = say(problems, 4);
  for (const { items } of context.views) {
    for (const it of items.filter((card) => NAMED.has(card.shape) && !card.tile)) {
      if (wrap(it.label, INNER_MAX, STYLE.label).length > 1) warn(it.line, `the name of card "${it.id}" wraps to more than one line. Shorten it and move the explanation to the subtitle or a text line`);
      else if (it.sub && wrap(it.sub, INNER_MAX, STYLE.sub).length > 1) warn(it.line, `the subtitle of card "${it.id}" wraps to more than one line. Shorten it and move the explanation to the document text`);
    }
  }
}

// cost: time O(e·n), heap O(1), stack O(1)
// vars: e = 선 수, n = 라벨 글자 수
// basis: estimate
// docs-5: 선 글이 길다.
function checkLabels({ scene }, problems) {
  const warn = say(problems, 5);
  for (const edge of scene.edges) {
    if (typeof edge.label !== 'string' || measure(edge.label, STYLE.pill.size, STYLE.pill.face) <= LIMITS.edgeLabel) continue;
    warn(edge.line, `the line text "${edge.label}" is longer than 10 Korean characters. Shorten it and explain in the document text`);
  }
}

// cost: time O(v), heap O(1), stack O(1)
// vars: v = 보기 수
// basis: estimate
// docs-6: 카드나 선이 많다. docs-8: 갈래 있는 그림에 aspect. docs-9: width wide.
function checkSize(context, problems) {
  const { figure } = context;
  for (const { view, items, edges } of context.views) {
    if (items.length > LIMITS.cards) say(problems, 6)(view.line ?? figure.line, `${items.length} cards in one figure. Keep ${LIMITS.cards} or fewer by grouping, or split it into an overview and a detail figure`);
    else if (edges.length > LIMITS.edges) say(problems, 6)(view.line ?? figure.line, `${edges.length} lines in one figure. Keep ${LIMITS.edges} or fewer, or split the figure`);
  }
  if (figure.aspect !== undefined && context.views.some((entry) => !chainLength(entry))) say(problems, 8)(figure.aspectLine ?? figure.line, 'aspect folds a branching figure and tangles its lines. Remove it, and use aspect only for a chain without branches');
  if (figure.width === 'wide') say(problems, 9)(figure.widthLine ?? figure.line, 'width wide lets the figure grow to 1440px, so it and its text shrink in a document column. Remove it');
}

// cost: time O(d), heap O(1), stack O(1)
// vars: d = 그룹 깊이
// basis: estimate
// 그룹 id의 맨 바깥 그룹 id. 그룹 밖이면 ROOT다.
function outermost(parentOf, id) {
  let at = id;
  while (at !== ROOT && parentOf.has(at) && parentOf.get(at) !== ROOT) at = parentOf.get(at);
  return at;
}

// cost: time O(s + e + g·d), heap O(g), stack O(1)
// vars: s = 도형 수, e = 선 수, g = 그룹 수, d = 그룹 깊이
// basis: estimate
// docs-10: 맨 바깥 그룹 셋 이상을 갈래 없이 차례로 잇는다. 안쪽 그룹은 바깥 그룹의 방향을 따라 놓여 계단이 되지 않는다.
function checkStaircase({ scene, figure }, problems) {
  const parentOf = new Map(scene.groups.map((g) => [g.id, g.parent ?? ROOT]));
  const owner = new Map(scene.items.map((it) => [it.id, outermost(parentOf, it.parent ?? ROOT)]));
  const links = new Map();
  for (const { from, to } of figure.edges) {
    const [a, b] = [owner.get(from), owner.get(to)];
    if (a && b && a !== ROOT && b !== ROOT && a !== b) links.set(`${a}\n${b}`, [a, b]);
  }
  if (!links.size) return;
  const outs = new Map();
  const ins = new Map();
  for (const [a, b] of links.values()) {
    outs.set(a, (outs.get(a) ?? 0) + 1);
    ins.set(b, (ins.get(b) ?? 0) + 1);
  }
  const groups = new Set([...outs.keys(), ...ins.keys()]);
  const isPath = links.size === groups.size - 1 && [...outs.values(), ...ins.values()].every((n) => n === 1);
  if (isPath && groups.size >= LIMITS.staircase) say(problems, 10)(figure.line, `lines chain ${groups.size} groups one after another, so they step down diagonally. Branch the groups from one start, or turn the steps into text lines of one card`);
}

// cost: time O(s + e), heap O(s), stack O(1)
// vars: s = 도형 수, e = 선 수
// basis: estimate
// docs-11: 선 없는 카드가 있다.
function checkLoose(context, problems) {
  for (const { items, edges } of context.views) {
    if (!edges.length) continue;
    const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
    const loose = items.filter((it) => !linked.has(it.id));
    if (loose.length >= LIMITS.loose) say(problems, 11)(loose[0].line, `cards ${loose.map((it) => it.id).join(', ')} have no lines and stack apart from the declared order. Merge them into one card with text lines, or connect them`);
  }
}

// cost: time O(m + b), heap O(b), stack O(1)
// vars: m = 메시지 수, b = 박자 수
// basis: estimate
// docs-12: 순서 그림 장면의 메시지가 많다. docs-13: 순서 그림에 장면이 여럿이다.
function checkSequences({ figure }, problems) {
  const stepOf = new Map();
  figure.steps.forEach((step, index) => step.beats.forEach((beat) => stepOf.set(beat, index)));
  for (const view of figure.views.filter((v) => v.strategy === 'sequence')) {
    const counts = new Map();
    for (const { beat } of view.messages ?? []) counts.set(stepOf.get(beat), (counts.get(stepOf.get(beat)) ?? 0) + 1);
    const limit = 2 * view.members.length - 2;
    const most = Math.max(0, ...counts.values());
    if (most > limit) say(problems, 12)(view.line, `a scene has ${most} messages for ${view.members.length} participants, so the figure grows tall. Keep ${limit} or fewer per scene, or split the figure`);
    if (counts.size > 1) say(problems, 13)(view.line, `messages are split over ${counts.size} scenes, and a static SVG shows only the first. Put them in one scene with fragments to show them all at once`);
  }
}

/** 장면을 읽는 구조 판정. 순서대로 돈다. docs-7은 다시 배치가 필요해 compile/docs-check.js가 따로 부른다. */
export const STRUCTURE_JUDGES = [checkBadges, checkLook, checkNames, checkLabels, checkSize, checkStaircase, checkLoose, checkSequences];
