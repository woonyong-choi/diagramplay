// 실제 배포물을 저장소 밖에 설치해 공개 진입점만으로 문서 그림을 만든다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const target = process.argv[2];
assert.ok(process.argv.length === 3 && isAbsolute(target ?? ''), '사용법: npm run check:package -- <저장소 밖 새 폴더의 절대 경로>');
const consumer = join(realpathSync(dirname(resolve(target))), basename(resolve(target)));
assert.ok(consumer !== root && !consumer.startsWith(root + sep), '검사 폴더는 저장소 밖에 둡니다.');

// 기존 경로는 손대지 않는다. 이 호출로 만든 소비 환경만 finally에서 정리한다.
mkdirSync(consumer);
try {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(npm_|node_options$|node_path$|node_auth_token$|gh_token$|github_token$)/i.test(key)));
  for (const config of ['user', 'global']) writeFileSync(join(consumer, `${config}.npmrc`), '');
  Object.assign(env, {
    npm_config_userconfig: join(consumer, 'user.npmrc'),
    npm_config_globalconfig: join(consumer, 'global.npmrc'),
    npm_config_cache: join(consumer, 'cache'),
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  });
  const run = (command, args, cwd = consumer) => execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  const [pack] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', consumer], root));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  // 디자인은 npm 레지스트리에 없으므로 배포물 안에 고정 commit 그대로 묶는다(bundleDependencies). 묶는 것은 디자인과 그 실행 의존성이고, 디자인의 빌드 전용 esbuild는 빠진다(scripts/pack-bundle.mjs).
  const bundledRoots = (pack.bundled ?? []).map((name) => `node_modules/${name}/`);
  assert.deepEqual(pkg.bundleDependencies, ['@woonyong-choi/design-tokens']);
  assert.ok(pack.bundled.includes('@woonyong-choi/design-tokens'), '디자인 패키지가 배포물에 묶여야 합니다.');
  assert.ok(pack.files.some(({ path }) => path === 'node_modules/@woonyong-choi/design-tokens/package.json'), '묶은 디자인의 package.json');
  assert.deepEqual(pack.bundled.filter((name) => /esbuild/.test(name)), [], '디자인의 빌드 전용 esbuild는 묶지 않습니다.');
  const allowed = /^(?:src\/|LICENSE$|NOTICE$|README(?:\.en)?\.md$|package\.json$)/;
  assert.deepEqual(pack.files.filter(({ path }) => !allowed.test(path) && !bundledRoots.some((prefix) => path.startsWith(prefix))), [], '배포 허용 목록 밖 파일');
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
  run('npm', ['install', '--ignore-scripts', '--omit=dev', '--package-lock=false', join(consumer, pack.filename)]);
  const installed = join(consumer, 'node_modules/diagramplay');
  assert.ok(!lstatSync(installed).isSymbolicLink(), '설치본은 저장소 링크가 아닌 tarball 사본이어야 합니다.');
  const design = join(installed, 'node_modules/@woonyong-choi/design-tokens/package.json');
  assert.ok(existsSync(design), '디자인은 배포물에 묶인 사본에서 설치됩니다.');
  for (const name of Object.keys(pkg.devDependencies ?? {})) assert.ok(!existsSync(join(consumer, 'node_modules', name)), `개발 의존성 ${name}이 소비 환경에 있습니다.`);
  for (const name of ['esbuild', '@esbuild']) assert.ok(!existsSync(join(consumer, 'node_modules', name)) && !existsSync(join(installed, 'node_modules', name)), `빌드 전용 ${name}이 소비 환경에 있습니다.`);
  copyFileSync(join(root, 'examples/flow.diagramplay'), join(consumer, 'flow.diagramplay'));
  const cli = join(consumer, 'node_modules/.bin/diagramplay');
  run(cli, ['check', 'flow.diagramplay', '--strict']);
  run(cli, ['render', 'flow.diagramplay', '--html', '--strict', '--out', 'render']);
  const source = readFileSync(join(consumer, 'flow.diagramplay'), 'utf8');
  writeFileSync(join(consumer, 'document.md'), '# 설치 검사\n\n```diagramplay name=flow\n' + source + '```\n');
  run(cli, ['md', 'document.md', '--strict']);
  run(cli, ['md', 'document.md', '--check', '--strict']);
  assert.match(readFileSync(join(consumer, 'document.md'), 'utf8'), /<!-- diagramplay -->/);
  writeFileSync(join(consumer, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { buildFigure, toSvg, toHtml } from 'diagramplay';
const require = createRequire(import.meta.resolve('diagramplay'));
assert.equal(require.resolve('@woonyong-choi/design-tokens/package.json'), process.argv[2]);
const { getIconCatalog, readIcon } = await import(require.resolve('@woonyong-choi/design-tokens/ui/build/icons.mjs'));
const designRoot = dirname(process.argv[2]);
const profile = JSON.parse(readFileSync(process.argv[2], 'utf8')).designTokensProfile;
assert.equal(profile?.name, 'diagram', 'the tested provider is the diagram distribution');
const catalog = getIconCatalog();
assert.deepEqual(Object.keys(catalog.icons).sort(), profile.icons);
assert.deepEqual(Object.keys(catalog.controls).sort(), profile.controls);
const retained = new Set(['user', 'user-settings', 'check', 'warning', 'close', 'ellipsis', ...Object.values(catalog.controls)]);
for (const [name, icon] of Object.entries(catalog.icons)) assert.ok(retained.has(name) || icon.category === 'brands', 'no general illustration ships: ' + name);
for (const group of ['articles', 'social', 'kinds']) assert.deepEqual(catalog[group], {});
for (const name of [...profile.icons, ...Object.keys(catalog.aliases)]) assert.match(readIcon(name), /<svg\\b/);
const svgFiles = readdirSync(designRoot, { recursive: true }).filter(name => name.endsWith('.svg')).sort();
assert.deepEqual(svgFiles, Object.values(catalog.icons).map(icon => join('dist', 'assets', 'icons', icon.file)).sort(), 'only catalog SVG files ship');
console.log('최소 아이콘 배포 ' + svgFiles.length + '개와 전체 카탈로그 미포함 확인');
const source = readFileSync('flow.diagramplay', 'utf8');
const result = await buildFigure(source, { strict: true, allowFileAccess: false });
const svg = await toSvg(result);
const html = await toHtml(result, 'flow');
assert.equal(svg, readFileSync('render/flow.svg', 'utf8'));
assert.equal(html, readFileSync('render/flow.html', 'utf8'));
for (const output of [svg, html]) assert.match(output, /data:font\\/woff2;base64,/);
assert.deepEqual(result.warnings, []);
assert.match(html, /role="tablist"/);
console.log('설치한 CLI·Markdown·공개 API와 내장 글꼴·디자인 확인');
`);
  process.stdout.write(run(process.execPath, ['consumer.mjs', realpathSync(design)]));
  copyFileSync(join(root, 'test/package-consumer.mts'), join(consumer, 'consumer.mts'));
  run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--module', 'nodenext', '--target', 'es2022', '--lib', 'es2022', '--strict', '--noEmitOnError', '--outDir', 'compiled', 'consumer.mts']);
  run(process.execPath, ['compiled/consumer.mjs']);
  console.log('설치한 TypeScript 선언·옵션·불투명 빌드 결과·진단 확인');
  console.log(`${pack.name}@${pack.version}: 배포 파일 ${pack.files.length}개 검사 완료`);
} finally {
  rmSync(consumer, { recursive: true });
}
