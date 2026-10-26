// 알약 크기. 선 라벨 알약과 번호 원, 장식 배지와 개수, 단계별 상태 알약, 카드 안 관계 그래프의 이름 알약을 한 곳에서 잰다. 그리는 쪽(draw/pill.js)은 이 크기를 그대로 그린다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';
import { measure } from './fonts.js';
import { STYLE } from './texts.js';

const SPACE = values.spacing;
/** 알약 높이. 선 라벨, 배지, 상태 알약, 관계 그래프 이름이 같은 높이다. */
export const PILL_H = values.spacing.figure.pill.height;

/** 알약 안 글. 배지는 흑백에서도 도형의 뜻을 글자로 남기는 자리라 본문 글보다 작지 않다. 크기는 작은 표시(text.figure-meta)이고 status.css와 figure.css의 `.badge`가 같은 토큰을 그린다. */
export const BADGE_STYLE = Object.freeze({ size: values.text["figure-meta"], face: 'semibold' });
/** 배지와 개수 알약의 좌우 안쪽 간격 합 */
const BADGE_PAD = SPACE["3-5"];

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 글자 수
// basis: estimate
/** 배지와 복제 개수 알약 크기. 글 폭에 좌우 안쪽 간격을 더한다. */
export function sizeBadge(text) {
  return { w: measure(text, BADGE_STYLE.size, BADGE_STYLE.face) + BADGE_PAD, h: PILL_H };
}

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 글자 수
// basis: estimate
/**
 * 선 라벨 알약 크기. 선 번호(no)가 있으면 왼쪽에 번호 원이 붙고, 라벨이 없으면 번호 원만 있다.
 * 번호 원은 알약 높이에서 위아래 안쪽 간격을 뺀 지름이고, 두 자리 이상 번호는 숫자 폭만큼 넓어진다.
 */
export function sizePill(label, no) {
  const h = PILL_H;
  const textW = label === undefined ? 0 : measure(label, STYLE.pill.size, STYLE.pill.face);
  if (no === undefined) return { w: textW + SPACE["3-5"], h };
  const numW = numberBadgeWidth(no);
  return { w: label === undefined ? numW + SPACE["0-5"] * 2 : SPACE["0-5"] + numW + SPACE["1"] + textW + SPACE["3-5"] / 2, h, numW, numH: h - SPACE["0-5"] * 2, textW };
}

/** 선 번호 원 너비. 한 자리는 지름과 같은 원이고 두 자리 이상은 숫자 폭에 좌우 간격을 더한다. */
function numberBadgeWidth(no) {
  return Math.max(PILL_H - SPACE["0-5"] * 2, measure(String(no), BADGE_STYLE.size, BADGE_STYLE.face) + SPACE["2"]);
}

/**
 * 번호만 있는 알약(라벨 없음)을 배치에 자리를 요구하지 않고 선 위에 얹는 선인가. 격자 칸에 이은 선은 끝 구간이 격자 안이라 얹을 자리를 고를 수 없어 배치가 자리를 준다.
 * quiet 선은 선 옆에 두는 자리(besideLabel)를 쓴다.
 */
export const isOnLinePill = (edge) => edge.no !== undefined && edge.label === undefined && !edge.quiet && !edge.fromCell && !edge.toCell;

/** 라벨이나 번호가 있어 알약을 그리는 선인가 */
export const hasPill = (edge) => edge.label !== undefined || edge.no !== undefined;

/** 상태 알약의 기호 칸. 알약 높이에서 위아래 안쪽 간격 `space.1`씩을 뺀 정사각이다. */
export const STATUS_ICON = PILL_H - SPACE["1"] * 2;
/** 상태 알약 안의 왼쪽 안쪽 간격, 기호와 글 사이 간격 */
export const STATUS_GAPS = Object.freeze({ pad: SPACE["1-5"], icon: SPACE["1"] });

/** 상태 종류마다 글자와 정본 기호 이름. 색은 status.css가 정한다. */
export const STATUS_KINDS = Object.freeze({
  ok: { text: 'OK', icon: 'check' },
  warn: { text: 'WARN', icon: 'warning' },
  fail: { text: 'FAIL', icon: 'close' },
  wait: { text: 'WAIT', icon: 'ellipsis' },
});

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 상태 알약 크기. 왼쪽 안쪽 간격, 기호, 간격, 글자, 오른쪽 안쪽 간격이다. 도형 모서리 알약과 타이밍 보기의 카드 줄 알약이 같은 크기다. */
export function sizeStatus(kind) {
  return { w: STATUS_GAPS.pad + STATUS_ICON + STATUS_GAPS.icon + measure(STATUS_KINDS[kind].text, BADGE_STYLE.size, BADGE_STYLE.face) + STATUS_GAPS.pad, h: PILL_H };
}

/** 관계 그래프 이름 알약의 좌우 안쪽 간격 합 */
const MINI_PAD = SPACE["5-5"];

// cost: time O(n), heap O(1), stack O(1)
// vars: n = 글자 수
// basis: estimate
/** 카드 안 관계 그래프의 이름 알약 폭. 글 폭에 좌우 안쪽을 더한다. 열 폭과 알약을 그리는 폭이 같다. */
export const miniPillWidth = (name) => measure(name, STYLE.mini.size, STYLE.mini.face) + MINI_PAD;
