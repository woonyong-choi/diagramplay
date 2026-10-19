import { QUEUE_SLOTS_MAX } from './source/grammar.js';
import { NUMBER_PATTERN } from './source/words.js';

export function readIndicator(options, { line, problems }) {
  if (options.display === undefined && options.max === undefined) return undefined;
  if (options.display === undefined || options.max === undefined) {
    problems.error(line, 'display= and max= must be written together');
    return undefined;
  }
  const { display: kind } = options;
  if (!['bar', 'slots'].includes(kind)) {
    problems.error(line, `display is bar or slots. Found "${kind}"`);
    return undefined;
  }
  const max = Number(options.max);
  if (!NUMBER_PATTERN.test(options.max) || !Number.isFinite(max) || max <= 0) {
    problems.error(line, `max is a finite positive number. Found "${options.max}"`);
    return undefined;
  }
  if (kind === 'slots' && (!isIntegerLiteral(options.max) || max > QUEUE_SLOTS_MAX)) {
    problems.error(line, `display=slots needs a whole max from 1 to ${QUEUE_SLOTS_MAX}. Found "${options.max}"`);
    return undefined;
  }
  return { kind, max };
}

export function indicatorText(indicator, text) {
  return indicator ? `${text} / ${indicator.max}` : text;
}

export function indicatorTypeProblem(value, text) {
  const type = value.numericType;
  if (!type) return undefined;
  const isNumber = NUMBER_PATTERN.test(text) && Number.isFinite(Number(text));
  if (isNumber && (type !== 'integer' || isIntegerLiteral(text))) return undefined;
  return `value "${value.id}" supplies display=${type === 'integer' ? 'slots' : 'bar'} and needs ${type === 'integer' ? 'a whole number' : 'a number'}. Found "${text}"`;
}

function isIntegerLiteral(text) {
  return /^-?\d+(?:\.0+)?$/.test(text);
}
