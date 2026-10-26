// 점 하나가 선마다 올라 있는 시각 구간. 선 켜짐과 고정 라벨 알약의 활성 색이 점이 선 위에 있는 동안만 켜지도록 시간표의 이동(hop)에서 읽는다.
// 계산은 hop-math.js 한 벌이고 재생기(player/sample.js)는 같은 함수 원문을 HTML 안에서 실행한다.
import { MOVE, timeAt } from '../easing.js';
import { hopMath } from '../hop-math.js';

const { hopLegs: legsOf } = hopMath(timeAt);

// cost: time O(l), heap O(l), stack O(1)
// vars: l = 이동이 지나는 선 수
// basis: estimate
/** 이동 하나가 각 선에 올라 있는 이동 시작 뒤 구간 { edge, from, to }(ms). 곡선은 점 이동 곡선(`easing.move`)이다. */
export const hopLegs = (hop) => legsOf(hop, MOVE);
