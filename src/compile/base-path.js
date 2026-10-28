// 원본이 읽는 파일(`icons 이름 "폴더"`)의 경로 경계. 경로는 기준 폴더(CLI는 원본 파일의 폴더, API는 `baseDir`) 안이어야 한다(docs/design/layout.md 아이콘).
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** 기준 폴더 밖 경로를 알리는 진단 글의 끝 */
export const OUTSIDE = 'the path is outside the source folder. Keep the file in the folder of the source, or below it';

// cost: time O(d), heap O(n), stack O(1), io 1
// vars: d = 경로 깊이, n = 경로 글자 수
// basis: estimate
// 실제 경로(심볼릭 링크를 끝까지 따라간 경로). 없으면 undefined다.
function real(path) {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

// cost: time O(n), heap O(n), stack O(1)
// vars: n = 경로 글자 수
// basis: estimate
const within = (base, path) => {
  const step = relative(base, path);
  return step === '' || (!step.startsWith('..') && !isAbsolute(step));
};

// cost: time O(d), heap O(n), stack O(1), io 2
// vars: d = 경로 깊이, n = 경로 글자 수
// basis: estimate
/**
 * 기준 폴더 기준의 경로. 적은 경로(절대 경로, `../`)와, 파일이 있으면 링크를 따라간 실제 경로가 모두 기준 폴더 안일 때만 돌려준다. 밖이면 undefined다.
 * 없는 파일은 적은 경로로만 판단한다(읽을 때 ENOENT로 알린다).
 */
export function insideBase(baseDir, path) {
  const base = resolve(baseDir);
  const target = resolve(base, path);
  if (!within(base, target)) return undefined;
  const realTarget = real(target);
  if (realTarget === undefined) return target;
  return within(real(base) ?? base, realTarget) ? target : undefined;
}
