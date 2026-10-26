// Mermaid 하위 그림 읽기(개체 관계, 상태, 클래스, 순서)가 함께 쓰는 줄 분기. 방향 낱말과 옮기지 않는 문장을 같은 규칙으로 다룬다.
import { skip } from './model.js';

/** Mermaid 방향 낱말 → DiagramPlay 방향. 거꾸로 가는 방향은 없어서 같은 축의 방향으로 바꾼다. */
export const DIRECTIONS = Object.freeze({ TB: 'down', TD: 'down', BT: 'down', LR: 'right', RL: 'right' });

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 줄 글자 수
// basis: estimate
/**
 * `direction 방향` 줄과 옮기지 않는 문장 줄을 다룬다. 다룬 줄이면 true다.
 * @param rules { ignored, why, direction? }. ignored는 옮기지 않는 첫 낱말 정규식, why(word)는 알림 글, direction(value, text)는 방향 줄을 받는 그림만 준다(value는 모르는 낱말이면 undefined)
 */
export function readCommonLine(text, line, model, { ignored, why, direction }) {
  const [word, arg] = text.split(/\s+/);
  if (direction && word === 'direction') {
    direction(DIRECTIONS[arg], text);
    return true;
  }
  if (!ignored.test(word)) return false;
  skip(model, line, why(word));
  return true;
}
