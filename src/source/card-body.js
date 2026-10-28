// 카드 선언 안의 본문. 장면의 show와 같은 줄 모형이며 값은 문서의 값 선언을 쓴다.
import { readContent } from './content.js';
import { didYouMean } from './problems.js';
import { readValue } from './value.js';

// 카드 본문 줄의 첫 낱말
const BODY_WORDS = ['text', 'value'];

export function readCardBody(statement, ctx) {
  const { tokens, line } = statement;
  const { card } = ctx.block;
  if (tokens[0].type === 'close') {
    if (tokens.length > 1) ctx.problems.error(line, 'put "}" on its own line');
    ctx.block = undefined;
    return;
  }
  if (statement.hasLexError || card.isRejected) return;
  const word = tokens[0].value;
  if (word === 'value') {
    const value = readValue(statement, ctx, card.id);
    if (value) card.content.push({ valueId: value.id, line });
    return;
  }
  if (word !== 'text') {
    ctx.problems.error(line, `a card body takes text "...", value id "label".${tokens[0].type === 'word' ? didYouMean(word, BODY_WORDS) : ''}`, { column: tokens[0].column });
    return;
  }
  const row = readContent({ tokens: tokens.slice(1), line }, ctx);
  if (row) card.content.push({ ...row, line });
}
