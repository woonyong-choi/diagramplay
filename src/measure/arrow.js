// 화살촉의 기하. 마커 좌표계를 정한다. 그리기(draw/arrow.js)가 이 값을 읽는다.

/** 마커 좌표계 한 변 */
export const VIEW = 5;
/** 삼각형의 꼭지 x(몸통 끝과 만나는 자리), 팔 끝 x, 팔 끝의 중심선 기준 반높이(마커 좌표) */
export const TIP_X = 4;
export const ARM_X = 1.1;
export const ARM_HALF = 2.25;

/** 마커 안 선의 마커 좌표 굵기. 몸통 굵기 w에서 실제 굵기가 w가 되게 하는 값이다. */
export const markStroke = (size) => VIEW / size;
