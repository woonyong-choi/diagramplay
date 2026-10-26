// 소스 import 그래프의 계약: 순환 없음과 층 방향(docs/architecture.md 부품 호출 지도의 호출 방향). 파일을 읽어 상대 import만 따라간다.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './support.js';

const SRC = join(ROOT, 'src');

// cost: time O(f·n), heap O(f + e), stack O(d)
// vars: f = 소스 파일 수, n = 파일 글자 수, e = import 수, d = 폴더 깊이
// basis: estimate
function importGraph() {
  const files = [];
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).forEach((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : entry.name.endsWith('.js') && files.push(join(dir, entry.name))));
  walk(SRC);
  const pattern = /(?:import|export)\s*(?:[\w*{}\s,]*?\s*from\s*)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  return new Map(files.map((file) => [relative(SRC, file), [...readFileSync(file, 'utf8').matchAll(pattern)].map((m) => relative(SRC, resolve(dirname(file), m[1] ?? m[2])))]));
}

const layerOf = (file) => (file.includes('/') ? file.split('/')[0] : undefined);
// 층마다 부르지 않는 층. 측정은 배치·그리기·검사를, 배치는 그리기·검사를, 검사는 그리기를 부르지 않는다.
const FORBIDDEN = { measure: ['layout', 'draw', 'check'], layout: ['draw', 'check'], check: ['draw'] };

// cost: time O(f + e), heap O(f), stack O(f)
// vars: f = 소스 파일 수, e = import 수
// basis: estimate
function reachable(graph, start) {
  const seen = new Set();
  const visit = (file) => (graph.get(file) ?? []).forEach((next) => !seen.has(next) && seen.add(next) && visit(next));
  visit(start);
  return seen;
}

test('import graph of src has no cycles', () => {
  const graph = importGraph();
  const cyclic = [...graph.keys()].filter((file) => reachable(graph, file).has(file));
  assert.deepEqual(cyclic, []);
});

test('import graph of src follows the measure, layout, draw direction and check does not draw', () => {
  const graph = importGraph();
  const violations = [...graph.keys()].flatMap((file) => [...reachable(graph, file)].filter((to) => FORBIDDEN[layerOf(file)]?.includes(layerOf(to))).map((to) => `${file} -> ${to}`));
  assert.deepEqual(violations, []);
});
