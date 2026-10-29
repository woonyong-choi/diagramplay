// 도형, 카드, 선 라벨 크기를 정한다. 여기서 정한 크기를 배치에 넘기고 그대로 그린다(docs/design/layout.md 도형 크기와 연결점).
import { plainText } from '../format/text.js';
import { tableDescription } from '../format/columns.js';
import { tableLayout } from './table.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { INNER_MAX, PAD, headerDecor, headerOf, placeHeader } from './card.js';
import { DECOR, STACK_STEP, groupDecor, nodeDecor } from './decor.js';
import { sizeClassifier } from './class.js';
import { CONTENT, contentMinWidth, sizeContent } from './content.js';
import { measure, wrap } from './fonts.js';
import { queueSlots, sizeQueue } from './queue.js';
import { STYLE, textAt, titleTexts } from './texts.js';

const SIZE = values.spacing.figure;

// cost: time O(k·r·n²), heap O(k·r), stack O(1)
// vars: k = 카드 내용 수, r = 카드 줄 수, n = 줄 글자 수
// basis: estimate
/**
 * 도형 하나의 크기와 글 자리. box는 배치에 넘기는 사각형, margin은 배치 바깥 여백(위, 아래)이다.
 * 도형의 모든 글은 texts(measure/texts.js)로 한 번 놓여 그리는 쪽과 충돌 검사가 같은 값을 읽는다.
 * @param node 그림 모형의 도형. shape: person, box, external, store, queue, decision, circle, table, api, classifier
 * @param contents 시간 흐름에서 이 도형에 보일 내용 목록. 내용은 줄 목록이다
 * @returns { w, h, marginTop, marginBottom, texts?, decor?, description?, content?: { w, h, layouts } }. description은 머리 말고 본문이 있는 표·API·클래스의 화면 읽기용 글이다
 */
export function sizeNode(node, contents = []) {
  if (node.shape === 'classifier') return sizeClassifier(node);
  if (node.shape === 'table' || node.shape === 'api') return sizeTable(node, contents);
  if (node.shape === 'circle') return sizeCircle(node);
  if (node.shape === 'queue') return sizeQueue(node);
  if (isHeaded(node)) return sizeHeaded(node, contents);
  const labelLines = wrap(node.label, INNER_MAX, STYLE.label);
  const subLines = node.sub ? wrap(node.sub, INNER_MAX, STYLE.sub) : [];
  const textW = Math.max(...labelLines.map((l) => measure(l, STYLE.label.size, STYLE.label.face)), ...subLines.map((l) => measure(l, STYLE.sub.size)));
  const decor = nodeDecor(node);
  const padX = node.tile ? SIZE.node['tile-pad'] : PAD.x;
  let w = Math.min(SIZE.node['max-width'], Math.max(node.tile ? SIZE.node['tile-width'] : SIZE.node['min-width'], textW + padX * 2, (decor?.w ?? 0) + padX * 2));
  w = Math.max(w, contentMinWidth(contents));
  const textH = labelLines.length * STYLE.label.line + subLines.length * STYLE.sub.line;
  if (node.shape === 'decision') {
    // 마름모 안에 글 사각형이 들어가려면 가로세로가 글의 두 배쯤 필요하다(마름모 내접 사각형 비율).
    const [diamondW, diamondH] = [Math.max(w, (textW + PAD.x) * 2), (textH + PAD.y) * 2];
    return { w: diamondW, h: diamondH, marginTop: 0, marginBottom: 0, texts: titleTexts({ labelLines, subLines }, { x: diamondW / 2, top: (diamondH - textH) / 2 }) };
  }
  const content = contents.length ? sizeContent(contents, w - CONTENT.margin * 2) : undefined;
  const cap = node.shape === 'store' ? SIZE.node['store-cap'] : 0;
  // 윗줄(아이콘, 배지, 개수)은 이름 위에 놓는다. 원통은 뚜껑 곡선 아래에서 시작한다.
  const room = decor ? cap + decor.h + (node.tile ? SIZE.icon['tile-gap'] : DECOR.rowGap) : 0;
  const head = decor ? { ...decor, x: (w - decor.w) / 2, y: PAD.y + cap } : undefined;
  const h = Math.max(SIZE.node['min-height'], PAD.y * 2 + room + textH + (content ? content.h + CONTENT.margin : 0));
  // 이름은 윗줄이나 내용이 있으면 위 안쪽 여백 아래에서 시작하고 아니면 세로 가운데다.
  const top = decor ? PAD.y + room : content ? PAD.y : (h - textH) / 2;
  // 개수 요약 상자는 뒤 윤곽 두 겹이 오른쪽 아래로 비쳐 보이도록 그만큼 크고, 이름과 내용은 앞 상자(몸통) 안에 놓인다.
  const stack = node.count === undefined ? 0 : STACK_STEP * 2;
  return { w: w + stack, h: h + stack, stack, marginTop: cap, marginBottom: cap, content, decor: head, texts: titleTexts({ labelLines, subLines }, { x: w / 2, top }) };
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 아이콘이나 배지가 있는 상자, 외부, 사람(타일, 개수 상자 제외)은 머리를 한 줄로 놓는다: 아이콘, 제목, 배지가 나란하고 아이콘 가운데가 제목 첫 줄 가운데다. 원통, 갈림길, 원은 모양이 뜻이라 따로 둔다.
function isHeaded(node) {
  return (node.shape === 'box' || node.shape === 'external' || node.shape === 'person') && !node.tile && node.count === undefined && Boolean(nodeDecor(node));
}

// cost: time O(n²), heap O(n), stack O(1)
// vars: n = 이름 글자 수
// basis: estimate
/**
 * 머리 한 줄이 있는 카드의 크기. 아이콘과 배지가 쓰고 남은 폭이 제목 열이고, 제목 줄과 부제 줄은 이 열 가운데에 놓인다. 머리 묶음은 카드 가운데에 놓고 내용은 그 아래다.
 * 카드가 비어 있어도 머리 자리는 움직이지 않는다.
 */
function sizeHeaded(node, contents) {
  const titleH = STYLE.label.line;
  const room = INNER_MAX - headerDecor(node, { titleW: 0, titleH }).w;
  const labelLines = wrap(node.label, room, STYLE.label);
  const subLines = node.sub ? wrap(node.sub, room, STYLE.sub) : [];
  const column = Math.max(...labelLines.map((l) => measure(l, STYLE.label.size, STYLE.label.face)), ...subLines.map((l) => measure(l, STYLE.sub.size)));
  const decor = headerDecor(node, { titleW: column, titleH });
  const w = Math.max(contentMinWidth(contents), Math.min(SIZE.node['max-width'], Math.max(SIZE.node['min-width'], decor.w + PAD.x * 2)));
  const first = (decor.h - titleH) / 2;
  const headH = Math.max(decor.h, first + labelLines.length * STYLE.label.line + subLines.length * STYLE.sub.line);
  const content = contents.length ? sizeContent(contents, w - CONTENT.margin * 2) : undefined;
  const h = Math.max(SIZE.node['min-height'], PAD.y * 2 + headH + (content ? content.h + CONTENT.margin : 0));
  const x = (w - decor.w) / 2;
  const title = decor.items.find((item) => item.kind === 'title');
  return { w, h, marginTop: 0, marginBottom: 0, content, decor: { ...decor, x, y: PAD.y }, texts: titleTexts({ labelLines, subLines }, { x: x + title.x + column / 2, top: PAD.y + first }) };
}

// cost: time O(n²), heap O(n), stack O(1)
// vars: n = 이름 글자 수
// basis: estimate
// 원: 이름 한 줄을 담는 지름. 이름이 길면 줄을 나누지 않고 지름이 커진다(합류 연산 기호처럼 짧은 글을 쓴다).
function sizeCircle(node) {
  const textW = measure(node.label, STYLE.label.size, STYLE.label.face);
  const d = Math.max(SIZE.node.circle, textW + PAD.x, STYLE.label.line + PAD.y);
  return { w: d, h: d, marginTop: 0, marginBottom: 0, texts: titleTexts({ labelLines: [node.label] }, { x: d / 2, top: (d - STYLE.label.line) / 2 }) };
}

// cost: time O(c + r·n²), heap O(r·n), stack O(1)
// vars: c = 열 수, r = 카드 줄 수, n = 글자 수
// basis: estimate
// 테이블과 API: 머리 띠, 열 줄, 내용이 모두 배치 사각형 안이다. 카드 폭은 내용이 있으면 내용 폭 이상이고 열의 글은 그 폭에서 놓인다.
function sizeTable(node, contents) {
  const layout = tableLayout(node, { minWidth: contentMinWidth(contents) });
  const { w } = layout;
  const content = contents.length ? sizeContent(contents, w - CONTENT.margin * 2) : undefined;
  const h = layout.height + (content ? content.h + CONTENT.margin * 2 : 0);
  const description = tableDescription({ ...node, label: plainText(node.label) });
  return { w, h, marginTop: 0, marginBottom: 0, content, decor: layout.header.decor, texts: layout.header.texts, dividers: layout.dividers, tableRows: layout.rows, description };
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 이름 글자 수
// basis: estimate
/**
 * 순서 보기 참여자의 크기. 표, API, 클래스는 칸과 멤버를 그리지 않고 같은 카드 머리(measure/card.js: 위 표시, 아이콘과 제목, 아래 표시)만 보이고 칸과 멤버는 같은 카드를 담은 그래프 보기가 보인다. 나머지 도형은 내용 없이 평소 크기다.
 * «interface» 표시가 클래스와 인터페이스를 가르는 뜻이라 머리만 보이는 참여자에서도 빠지지 않는다.
 */
export function sizeParticipant(node) {
  if (!SEQUENCE_HEADERS.includes(node.shape)) return fitContentWidth(sizeNode(node, []), node);
  const header = headerOf(node);
  const w = Math.max(SIZE.node['min-width'], header.w + PAD.x * 2);
  const { decor, texts } = placeHeader(header, w);
  return { w, h: header.h, marginTop: 0, marginBottom: 0, decor, texts };
}
const SEQUENCE_HEADERS = ['table', 'api', 'classifier'];

// cost: time O(t·n + q), heap O(t), stack O(1)
// vars: t = 글 줄 수, n = 글자 수, q = 큐 칸 수
// basis: estimate
/**
 * 순서 보기 참여자 머리는 도형 최소 폭 없이 내용 폭(가장 긴 글 줄, 윗줄 장식, 큐 칸 줄)에 안쪽 여백을 더한 폭이다. 참여자가 많아도 본문 단 폭 안에 생명선이 들게 하기 위해서다.
 * 글과 장식은 가운데 정렬이라 줄어든 폭의 반만큼 왼쪽으로 옮긴다. 복제 개수 상자는 뒤 윤곽이 폭에 들어 있어 줄이지 않는다.
 */
function fitContentWidth(size, node) {
  if (size.stack || !size.texts) return size;
  const lines = size.texts.map((t) => measure(t.text, t.style.size, t.style.face));
  const slots = node.shape === 'queue' ? queueSlots({ x: 0, y: 0, w: size.w, h: size.h, slots: node.slots }) : [];
  const slotW = slots.length ? Math.max(...slots.map((b) => b.x + b.w)) - Math.min(...slots.map((b) => b.x)) : 0;
  const need = Math.max(...lines, size.decor?.w ?? 0, slotW) + PAD.x * 2;
  const d = (size.w - need) / 2;
  if (d <= 0) return size;
  return { ...size, w: need, texts: size.texts.map((t) => ({ ...t, x: t.x - d })), decor: size.decor && { ...size.decor, x: size.decor.x - d } };
}

// cost: time O(t), heap O(t), stack O(1)
// vars: t = 글 줄 수
// basis: estimate
/**
 * 잰 도형을 더 큰 높이 h로 늘린다. 글과 윗줄 장식은 늘어난 만큼의 반을 내려 세로 가운데를 지킨다. 순서 보기 참여자 머리를 같은 높이로 맞출 때 쓴다.
 * 큐의 칸은 도형 아래 안쪽 여백에 붙어 그려지므로(measure/queue.js queueSlots) 따로 옮기지 않는다.
 */
export function stretchHeight(size, h) {
  const d = (h - size.h) / 2;
  if (d <= 0) return size;
  return { ...size, h, texts: size.texts?.map((t) => ({ ...t, center: t.center + d })), decor: size.decor && { ...size.decor, y: size.decor.y + d } };
}

// cost: time O(g·n), heap O(1), stack O(1)
// vars: g = 그룹 제목 글자 수, n = 1
// basis: estimate
/** 그룹 제목 줄 너비. 그룹이 제목보다 좁아지지 않게 배치에 넘긴다. */
export function groupTitleWidth(group) {
  const head = groupHead(group);
  return head.lead + head.w + PAD.x * 2;
}

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 그룹 제목 글자 수
// basis: estimate
/**
 * 그룹 제목 줄의 한 덩어리: 아이콘, 제목 글, 배지, 개수 알약. 덩어리 왼쪽 끝이 제목 글 기본 자리(titleDx)이고 선이 가리면 덩어리째 비킨다.
 * 아이콘도 공통 장식 간격으로 같은 줄에 놓으며 별도 탭 너비를 예약하지 않는다.
 * @returns { w, textDx, decor, lead }. textDx는 덩어리 왼쪽에서 제목 글까지 거리, decor는 장식 자리(없으면 undefined), lead는 별도 탭 여백이며 현재 0이다
 */
export function groupHead(group) {
  const titleW = measure(group.label, STYLE.group.size, STYLE.group.face);
  const decor = groupDecor(group, titleW);
  return { w: decor?.w ?? titleW, textDx: decor?.items.find((i) => i.kind === 'title').x ?? 0, decor, lead: 0 };
}

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 그룹 제목 글자 수
// basis: estimate
/**
 * 배치가 정한 제목 거리(titleDx)에서 그룹 제목 줄의 글과 장식을 놓는다. 그룹 왼쪽 위가 원점이다. 그리는 쪽과 이동 글 상자가 피할 사각형이 같은 값을 읽는다.
 * @returns { text, decor? }. text는 제목 글(카드 안 글과 같은 text), decor는 배지와 개수 알약의 자리다
 */
export function placeGroupHead(group) {
  const head = groupHead(group);
  const text = textAt('frame', group.label, STYLE.group, { x: group.titleDx + head.textDx, center: SIZE.group.title / 2 });
  return { text, decor: head.decor && { ...head.decor, x: group.titleDx, y: (SIZE.group.title - head.decor.h) / 2 } };
}
