// 값 줄과 값 식이 받는 숫자의 공통 범위와 진단.
// 값의 절댓값 상한. 이보다 크면 십진 반올림이 12자리 정밀도를 넘어 값 글자를 정확히 쓸 수 없다.
export const MAX_VALUE = 1e15;
/** 값이 범위를 넘을 때의 오류 글. 시작 값과 증감 결과가 같은 글을 쓴다. */
export const RANGE_MESSAGE = `values must be under ${MAX_VALUE.toExponential(0).replace('+', '')} in absolute value`;
