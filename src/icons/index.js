// 공통 디자인의 아이콘 이름과 별칭을 읽는다. 사용자 세트의 파일 경계와 SVG 정리는 이 렌더러가 소유한다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { insideBase, OUTSIDE } from '../base-path.js';

import { sanitizeIcon } from './sanitize.js';
import { getIconCatalog, readIcon } from '@woonyong-choi/design-tokens/ui/build/icons.mjs';

const CATALOG = getIconCatalog();
export const DEFAULT_SET = 'builtin';
export const ICON_NAMES = Object.freeze(Object.fromEntries([
  ...Object.entries(CATALOG.icons).map(([name, icon]) => [name, icon.category === 'brands' ? 'brand' : 'concept']),
  ...Object.entries(CATALOG.aliases).map(([name, target]) => [name, CATALOG.icons[target].category === 'brands' ? 'brand' : 'concept']),
]));
/** 사용자 세트 안의 아이콘 이름 형식. 폴더 밖으로 나가는 경로를 막는다. */
export const USER_ICON_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// 읽은 파일의 정리 결과. 같은 파일을 그림마다 다시 읽지 않는다.
const cache = new Map();

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** `user`나 `nhn:lb`를 { set, name }으로 가른다. 세트를 적지 않으면 기본 세트다. */
export function splitIconRef(ref) {
  const [set, name] = ref.includes(':') ? ref.split(/:(.*)/s) : [DEFAULT_SET, ref];
  return { set, name };
}

// cost: time O(n·f), heap O(n), stack O(1), io n
// vars: n = 도형과 그룹 수, f = 아이콘 파일 글자 수
// basis: estimate
/**
 * 도형과 그룹의 `icon=`을 읽어 iconData로 붙인다. 파일을 못 읽거나 SVG를 정리할 수 없으면 그 줄의 오류다.
 * 그린 아이콘이 없는 도형은 범주색과 글자 배지가 대신한다(docs/design/layout.md 아이콘).
 */
export function attachIcons(figure, baseDir, problems) {
  // 기준 폴더 밖의 세트는 등록 줄에 한 번 알리고, 그 세트를 쓰는 아이콘은 같은 원인이라 다시 알리지 않는다.
  const folders = new Map();
  for (const set of figure.iconSets) {
    const folder = insideBase(baseDir, set.path);
    if (folder === undefined) problems.error(set.line, `cannot use the icon set "${set.name}": ${OUTSIDE}`);
    else folders.set(set.name, folder);
  }
  for (const item of [...figure.nodes, ...figure.groups]) {
    if (item.icon === undefined) continue;
    const ref = splitIconRef(item.icon);
    // 이름이 틀린 참조는 원본 읽기(source/icons.js checkIcons)가 그 줄에 이미 알렸다. 같은 원인을 두 번 알리지 않는다.
    if (!isNamed(ref, figure.iconSets) || (ref.set !== DEFAULT_SET && !folders.has(ref.set))) continue;
    try {
      item.iconData = loadIcon(ref, { folders, baseDir });
    } catch (error) {
      problems.error(item.line, `cannot use icon "${item.icon}": ${error.code === 'ENOENT' ? 'the file does not exist' : error.message}`);
    }
  }
}

// cost: time O(s), heap O(1), stack O(1)
// vars: s = 등록한 세트 수
// basis: estimate
// 기본 세트의 아는 이름이거나, 등록한 세트의 파일 이름 모양이면 true. checkIcons가 받아들이는 참조와 같다.
function isNamed({ set, name }, sets) {
  if (set === DEFAULT_SET) return Object.hasOwn(ICON_NAMES, name);
  return sets.some((s) => s.name === set) && USER_ICON_PATTERN.test(name);
}

// cost: time O(n), heap O(n), stack O(1), io 1
// vars: n = 파일 글자 수
// basis: estimate
/**
 * 내장 아이콘은 공통 SVG 원본, 사용자 아이콘은 검증한 body를 역할과 함께 돌려준다.
 * @param ref { set, name }
 * @param folders 기준 폴더 안으로 확인한 사용자 세트 폴더 Map<세트 이름, 경로>
 * @param baseDir 기준 폴더. 아이콘 파일이 링크로 그 밖을 가리키면 읽지 않는다
 * @throws Error 파일이 없거나, 기준 폴더 밖이거나, SVG를 정리할 수 없을 때
 */
function loadIcon(ref, { folders, baseDir }) {
  if (ref.set === DEFAULT_SET) return { svg: readIcon(ref.name), role: ICON_NAMES[ref.name] };
  const file = insideBase(baseDir, join(folders.get(ref.set), `${ref.name}.svg`));
  if (file === undefined) throw new Error(OUTSIDE);
  return { ...readSvg(file), role: 'custom' };
}

// cost: time O(n), heap O(n), stack O(1), io 1
// vars: n = 파일 글자 수
// basis: estimate
// 파일 하나를 정리해 읽는다. 같은 파일은 한 번만 읽는다.
function readSvg(file) {
  if (!cache.has(file)) cache.set(file, sanitizeIcon(readFileSync(file, 'utf8')));
  return cache.get(file);
}
