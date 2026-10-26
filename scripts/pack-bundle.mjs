// 사용: node scripts/pack-bundle.mjs aside|restore   npm pack과 publish의 prepack, postpack이 부른다.
// 함께 묶는 디자인 패키지(bundleDependencies)는 자기 스타일 빌드(dist/ui/build/styles.mjs)용으로 esbuild를 dependencies에 적는다.
// DiagramPlay는 그 빌드를 부르지 않으므로, 플랫폼별 바이너리와 설치 스크립트가 배포물에 들어가지 않게 묶기 전에 치우고 묶은 뒤 되돌린다.
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
/** 배포물에 묶지 않는 디자인 패키지의 빌드 전용 의존성(node_modules 아래 이름). */
const BUILD_ONLY = ['esbuild', '@esbuild'];
const aside = join(root, '.local/pack-aside');

// cost: time O(k), heap O(1), stack O(1), io k
// vars: k = 빌드 전용 의존성 수
// basis: estimate
function move(from, to) {
  for (const name of BUILD_ONLY) {
    if (!existsSync(join(from, name))) continue;
    rmSync(join(to, name), { recursive: true, force: true });
    renameSync(join(from, name), join(to, name));
  }
}

const mode = process.argv[2];
if (mode === 'aside') {
  mkdirSync(aside, { recursive: true });
  move(join(root, 'node_modules'), aside);
} else if (mode === 'restore') {
  if (existsSync(aside)) move(aside, join(root, 'node_modules'));
} else {
  console.error('usage: node scripts/pack-bundle.mjs aside|restore');
  process.exitCode = 2;
}
