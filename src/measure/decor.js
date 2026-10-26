import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { PILL_H, sizeBadge } from './pills.js';

const SPACE = values.spacing;
const SIZE = values.spacing.figure;

if (!Number.isFinite(SIZE.icon.brand) || SIZE.icon.brand <= 0) {
  throw new Error('@woonyong-choi/design-tokens >=0.2.0이 필요합니다. spacing.figure.icon.brand는 유한한 양수여야 합니다');
}

/** 장식 사이 간격과 알약 높이, 도형 윗줄과 이름 사이 간격 */
export const DECOR = Object.freeze({ gap: SPACE["1"], pillH: PILL_H, rowGap: SPACE["1"] });
/** 복제 개수(count)를 가진 상자의 뒤 윤곽 한 겹 간격 */
export const STACK_STEP = SPACE["1"];

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 장식 목록. 아이콘, 배지, 개수 순서다. 알약은 { kind, text, w, h }, 아이콘은 { kind: 'icon', w, h }다.
function itemsOf(item, iconSize) {
  const size = item.iconData?.role === 'brand' ? SIZE.icon.brand : iconSize;
  const pills = [item.badge && { kind: 'badge', text: item.badge }, item.count !== undefined && { kind: 'count', text: `×${item.count}` }].filter(Boolean);
  return [...(item.iconData ? [{ kind: 'icon', w: size, h: size }] : []), ...pills.map((p) => ({ ...p, ...sizeBadge(p.text) }))];
}

// cost: time O(k), heap O(k), stack O(1)
// vars: k = 장식 수
// basis: estimate
/**
 * 장식 한 줄의 자리. 왼쪽에서 오른쪽으로 놓고 세로는 가운데 맞춘다. 좌표는 줄 왼쪽 위가 원점이다.
 * @param item 도형 또는 그룹(iconData, badge, count)
 * @param options { iconSize, titleW, titleH, iconGap }. titleW가 있으면 아이콘 뒤에 제목 글(너비 titleW, 높이 titleH)을 놓는다. iconGap은 아이콘 뒤 간격이다(그룹 제목 줄은 기본, 카드 머리는 HEADER.iconGap)
 * @returns undefined(장식 없음) 또는 { items: { kind, x, y, w, h, text? }[], w, h }. 제목 글은 kind 'title'이다
 */
export function layoutDecor(item, { iconSize, titleW, titleH = DECOR.pillH, iconGap = DECOR.gap }) {
  const parts = itemsOf(item, iconSize);
  if (!parts.length) return undefined;
  if (titleW !== undefined) parts.splice(parts[0]?.kind === 'icon' ? 1 : 0, 0, { kind: 'title', w: titleW, h: titleH });
  const h = Math.max(...parts.map((p) => p.h));
  let x = 0;
  const items = parts.map((p) => {
    const placed = { ...p, x, y: (h - p.h) / 2 };
    x += p.w + (p.kind === 'icon' ? iconGap : DECOR.gap);
    return placed;
  });
  const last = parts.at(-1).kind === 'icon' ? iconGap : DECOR.gap;
  return { items, w: x - last, h };
}

/** 도형 윗줄의 장식. 너비가 도형 안쪽에 들어가야 하므로 도형 크기를 정하는 쪽이 이 너비를 쓴다. */
export const nodeDecor = (node) => layoutDecor(node, { iconSize: node.tile ? SIZE.icon.tile : SIZE.icon.node });

/** 그룹의 아이콘·제목·배지는 같은 줄에서 공통 간격으로 배치한다. */
export const groupDecor = (group, titleW) => layoutDecor(group, { iconSize: SIZE.group.title - SPACE["2"], titleW });

/** 복제 개수(count) 상자의 앞 상자(몸통) 사각형. 뒤 윤곽 두 겹이 비치는 만큼 도형 사각형보다 작다. 그 밖의 도형은 도형 사각형 그대로다. */
export const bodyOf = (it) => ({ x: it.x, y: it.y, w: it.w - (it.stack ?? 0), h: it.h - (it.stack ?? 0) });
