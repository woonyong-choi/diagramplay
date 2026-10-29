// `{`로 여는 블록(테이블, API, 클래스, 보기)의 여는 줄과 안쪽 줄을 맡을 읽기 함수를 고른다.
// 열린 블록은 ctx.block = { kind, card, line }이고, 안쪽 줄은 `}`가 닫을 때까지 kind의 읽기 함수가 읽는다.
import { readCardBody } from './card-body.js';
import { readClassifier, readMember } from './class.js';
import { readApi, readColumn, readTable } from './declare.js';
import { readViewLine } from './view.js';

/** 블록 종류 → 안쪽 줄을 읽는 함수 (statement, ctx) */
export const BLOCK_READERS = {
  card: readCardBody,
  table: readColumn,
  api: readColumn,
  class: readMember,
  view: readViewLine,
};

const OPENERS = { table: readTable, api: readApi, class: readClassifier, interface: readClassifier };

// cost: time O(t), heap O(t), stack O(1)
// vars: t = 문장 낱말 수
// basis: estimate
/** 블록을 여는 줄 하나를 읽는다. word는 줄 첫 낱말이다. */
export function openBlock(word, statement, ctx) {
  OPENERS[word](statement, ctx);
}
