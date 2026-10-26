// 머리 줄(title, subtitle, pace, aspect, width, require) 하나를 읽는다. 값은 글, 시간, 숫자, 낱말 중 하나다.
import { valueNames } from './grammar.js';
import { isOverTimeLimit, overLimitMessage, parseTime, timeHint } from './values.js';
import { NUMBER_PATTERN } from './words.js';

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 머리 줄 하나를 문서 모형에 적는다. */
export function readHeader({ tokens, line }, { figure, problems }) {
  if (tokens[0].value === 'require') {
    readRequire(tokens, line, { figure, problems });
    return;
  }
  const [head, value, extra] = tokens;
  if (extra) problems.error(line, `"${head.value}" takes one value`);
  const key = head.value;
  if (key === 'title' || key === 'subtitle') {
    if (value?.type !== 'text') problems.error(line, `write ${key} as quoted text: ${key} "..."`);
    else figure[key] = value.value;
  } else if (key === 'pace') {
    const ms = parseTime(value?.value);
    if (value?.type === 'word' && ms === undefined && isOverTimeLimit(value.value)) problems.error(line, overLimitMessage('pace', value.value), { code: 'time-limit' });
    else if (value?.type !== 'word' || ms === undefined) problems.error(line, `write pace as a time such as 900ms or 2s.${value?.type === 'word' ? timeHint(value.value) : ''}`, { column: value?.column });
    else figure.paceMs = ms;
  } else if (key === 'aspect') {
    const ratio = Number(value?.value);
    if (value?.type !== 'word' || !NUMBER_PATTERN.test(value.value) || !Number.isFinite(ratio) || !(ratio > 0)) problems.error(line, 'write aspect as a positive number such as 1.6');
    else {
      figure.aspect = ratio;
      figure.aspectLine = line;
    }
  } else if (key === 'width') {
    if (!valueNames('width').includes(value?.value)) problems.error(line, `width is ${valueNames('width').map((v) => `"${v}"`).join(' or ')}`);
    else {
      figure.width = value.value;
      figure.widthLine = line;
    }
  }
}

// cost: time O(t + r·t), heap O(t), stack O(1)
// vars: t = 줄 낱말 수, r = 앞서 읽은 요구 항목 수
// basis: estimate
// `require "글" [or "글" ...]` 한 줄을 요구 항목 하나로 읽는다. 대안 가운데 하나만 그림에 있으면 된다.
function readRequire(tokens, line, { figure, problems }) {
  const alternatives = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const text = tokens[i];
    if (text?.type !== 'text' || !text.value.trim()) {
      problems.error(line, 'write require as quoted text: require "..." or "..."', { column: text?.column });
      return;
    }
    alternatives.push(text.value.trim());
    const joint = tokens[i + 1];
    if (joint && !(joint.type === 'word' && joint.value === 'or' && tokens[i + 2])) {
      problems.error(line, 'join alternatives with "or": require "..." or "..."', { column: joint.column });
      return;
    }
  }
  if (!alternatives.length) {
    problems.error(line, 'write require as quoted text: require "..." or "..."');
    return;
  }
  const key = [...alternatives].sort().join('\n');
  const same = figure.requires.find((item) => [...item.alternatives].sort().join('\n') === key);
  if (same) problems.warn(line, `this require is written twice (line ${same.line})`);
  else figure.requires.push({ alternatives, line });
}
