// 화살촉의 기하. 마커 좌표계와 선 끝이 차지하는 크기를 정한다. 그리기(draw/arrow.js)와 차트 배치(산점도, 덤벨)가 같은 값을 읽는다.
import { values } from '@woonyong-choi/design-tokens/tokens.js';

/** 마커 좌표계 한 변 */
export const VIEW = 5;
/** 삼각형의 꼭지 x(몸통 끝과 만나는 자리), 팔 끝 x, 팔 끝의 중심선 기준 반높이(마커 좌표) */
export const TIP_X = 4;
export const ARM_X = 1.1;
export const ARM_HALF = 2.25;

/** 마커 안 선의 마커 좌표 굵기. 몸통 굵기 w에서 실제 굵기가 w가 되게 하는 값이다. */
export const markStroke = (size) => VIEW / size;

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/**
 * 몸통 굵기 width의 선 끝에 붙은 화살촉이 실제로 차지하는 크기(px). 꼭지(몸통 끝)에서 뒤로 length, 중심선에서 양옆으로 half, 몸통 끝 너머로 둥근 끝이 cap만큼 나온다.
 */
export function headReach(width, size = values.spacing.figure.arrow.head) {
  const unit = (width * size) / VIEW;
  const cap = markStroke(size) / 2;
  return { length: (TIP_X + cap - (ARM_X - cap)) * unit, half: (ARM_HALF + cap) * unit, cap: cap * unit };
}
