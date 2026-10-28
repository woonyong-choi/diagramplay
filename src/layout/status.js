// 단계별 도형 상태 알약의 자리(docs/design/figure-syntax.md 단계별 도형 상태). 알약은 도형 오른쪽 위 모서리에 걸치고 도형 크기와 배치는 바꾸지 않는다.
// 그리기(draw/status.js), 그림 검사, 이동 글 상자가 피할 사각형, HTML 보이는 범위가 같은 사각형을 읽는다.
import { bodyOf } from '../measure/decor.js';
import { STATUS_KINDS, sizeStatus } from '../measure/pills.js';
import { values } from '@woonyong-choi/design-tokens/tokens.js';

const SPACE = values.spacing;
// 알약이 모서리 바깥으로 나가는 거리(오른쪽, 위쪽 반대로 모서리 아래로 들어오는 거리)
const OVERHANG = SPACE["1-5"];
const INSET = SPACE["1"];


// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 알약이 걸치는 모서리. 카드 몸통의 오른쪽 위 모서리다.
function cornerOf(it) {
  const body = bodyOf(it);
  return { x: body.x + body.w, y: body.y };
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 도형 it의 상태 알약 사각형. 오른쪽 위 모서리에서 OVERHANG만큼 바깥으로 나가고, 아래 가장자리는 모서리 INSET 안쪽이다. */
export function statusBox(it, kind) {
  const { w, h } = sizeStatus(kind);
  const corner = cornerOf(it);
  return { x: corner.x + OVERHANG - w, y: corner.y + INSET - h, w, h };
}

// cost: time O(b), heap O(1), stack O(1)
// vars: b = 구간 수
// basis: estimate
/** 시간표가 단계별 도형 상태를 쓰는지. 쓰는 그림에만 알약 글자 스타일과 재생기 코드가 따라붙는다. */
export const hasStatus = (timeline) => timeline.segs.some((seg) => seg.status);

// cost: time O(b·s), heap O(s), stack O(1)
// vars: b = 구간 수, s = 상태 수
// basis: estimate
/** 시간표가 쓰는 알약마다 { node, kind, spans }. spans는 그 알약이 보이는 시각 구간 [시작, 끝](그림 전체 ms)이고 처음 나온 순서로 모은다. */
export function statusPills(timeline) {
  const pills = new Map();
  for (const seg of timeline.segs) {
    for (const { node, kind } of seg.status ?? []) {
      const key = `${node}\u0000${kind}`;
      if (!pills.has(key)) pills.set(key, { node, kind, spans: [] });
      pills.get(key).spans.push([seg.t0, seg.t1]);
    }
  }
  return [...pills.values()];
}

// cost: time O(i), heap O(k), stack O(1)
// vars: i = 도형 수, k = 같은 논리 카드를 그린 도형 수
// basis: estimate
/** 논리 카드 id가 그려진 도형 번호들. 카드가 여러 보기에 있으면 보기마다 하나이고 모두 같은 논리 상태를 보인다. */
export const instancesOf = (scene, node) => scene.items.flatMap((it, index) => (it.id === node ? [index] : []));

// cost: time O(p·i), heap O(p·k), stack O(1)
// vars: p = 알약 수, i = 도형 수, k = 같은 논리 카드를 그린 도형 수
// basis: estimate
/**
 * 상태 알약의 사각형 목록(그림 검사와 글 상자 자리 계산이 피할 대상). 시간표에 쓰인 알약마다, 그 논리 카드가 그려진 모든 도형(보기마다 하나)에 하나씩이다.
 * @returns { x, y, w, h, name, node, kind, item }[]. name은 알약 글자, item은 도형 번호(scene.items 안)
 */
export function statusBoxes(scene, timeline) {
  return statusPills(timeline).flatMap(({ node, kind }) => instancesOf(scene, node).map((item) => ({ ...statusBox(scene.items[item], kind), name: STATUS_KINDS[kind].text, node, kind, item })));
}
