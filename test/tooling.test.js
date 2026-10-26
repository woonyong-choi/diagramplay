// 저장소 관문 도구의 계약: 하드코딩 검사(design-tokens의 check-tokens.mjs)와 디자인 의존성 선언. 검사는 새 프로세스로 돌려 종료 코드와 출력으로만 본다.
// 배포하는 명령이 아니라 이 저장소의 `npm run check`가 쓰는 도구라서 시험 이름 첫 낱말(G1~G3)은 요구사항 번호표에 없다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, workspace } from './support.js';

const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
const DESIGN = join(ROOT, 'node_modules/@woonyong-choi/design-tokens/dist');
const checkTokens = (dir) => node([join(DESIGN, 'ui/build/check-tokens.mjs'), dir, '--tokens', join(DESIGN, 'tokens.json')], ROOT);
const hits = (run) => run.stdout.trim().split('\n').filter((line) => !line.startsWith('total')).map((line) => line.replace(/^.*[\\/]/, ''));

test('G1 a hard-coded color in JavaScript is found where the language puts it: after a regex or string that contains <!--, and not inside comments or regex literals', (t) => {
  const dir = workspace(t, {
    'markup.js': ['const OPEN = /<!--/;', "const RED = '#ff0000';", 'const CLOSE = /-->/;', "const NOTE = '<!--';", "const BLUE = '#0000ff';", "const END = '-->';", ''].join('\n'),
    'quiet.js': ["// const GONE = '#ff0000';", "/* const GONE = '#ff0000'; */", 'const PATTERN = /#00ff00/;', 'const QUOTES = /[\'"`]/;', 'const HALF = 3 / 2;', "const OK = 'text';", ''].join('\n'),
    'template.js': ['const html = `<p>${`<!--`}</p> ${1 / 2}`;', "const GREEN = '#00ff00';", ''].join('\n'),
  });
  const run = checkTokens(dir);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(hits(run), ['markup.js:2: hex color: #ff0000', 'markup.js:5: hex color: #0000ff', 'template.js:2: hex color: #00ff00']);
  assert.match(run.stdout, /total 3\n$/);
});

test('G2 a CSS /* */ comment hides its values and the declaration after it is still checked', (t) => {
  const dir = workspace(t, { 'a.css': '/* color: #ff0000; */\n.a { color: #00ff00; }\n' });
  assert.deepEqual(hits(checkTokens(dir)), ['a.css:2: hex color: #00ff00']);
});

test('G3 the design is the peer package the host installs, pinned to a commit for this repository, with no copy in src', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.peerDependencies['@woonyong-choi/design-tokens'], /^\^\d+\.\d+\.\d+$/);
  assert.match(pkg.devDependencies['@woonyong-choi/design-tokens'], /^https:\/\/raw\.githubusercontent\.com\/woonyong-choi\/design-tokens\/[0-9a-f]{40}\/artifacts\/diagram\.tgz$/);
  assert.equal(pkg.dependencies['@woonyong-choi/design-tokens'], undefined);
  assert.equal(existsSync(join(ROOT, 'src/vendor/theme')), false);
  const resolved = createRequire(join(ROOT, 'src/styles.js')).resolve('@woonyong-choi/design-tokens/tokens.css');
  assert.equal(resolved, join(DESIGN, 'tokens.css'));
});

// 워크플로 파일을 YAML 해석기 없이 줄로 읽는다. 작업(job) 하나의 줄들과, 그 작업이 돌리는 명령(`run:` 한 줄 값)과 조건을 순서대로 모은다.
const workflow = (name) => readFileSync(join(ROOT, name), 'utf8').replace(/\r\n/g, '\n');
const jobLines = (text, job) => {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `job ${job}`);
  const end = lines.findIndex((line, i) => i > start && /^ {2}\S/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
};
const checks = (lines) => lines.map((line) => /^\s+(?:- )?(run|if): (.+)$/.exec(line)).filter(Boolean).map(([, key, value]) => `${key}: ${value}`);

test('G4 #398 release runs the same checks as ci before it publishes, and only the release job may write', () => {
  const ci = workflow('.github/workflows/ci.yml');
  const release = workflow('.github/workflows/release.yml');
  assert.deepEqual(checks(jobLines(release, 'check')), checks(jobLines(ci, 'test')));
  assert.deepEqual(jobLines(release, 'check').filter((line) => /node: \[/.test(line)), jobLines(ci, 'test').filter((line) => /node: \[/.test(line)));
  assert.ok(jobLines(release, 'release').includes('    needs: check'));
  for (const text of [ci, release]) assert.match(text, /^permissions:\n {2}contents: read\n/m);
  assert.deepEqual(release.split('\n').filter((line) => /: write\b/.test(line)).map((line) => line.trim().split(' #')[0]), ['contents: write', 'id-token: write']);
  assert.ok(jobLines(release, 'release').some((line) => line.trim().startsWith('contents: write')), 'write is granted in the release job only');
  for (const text of [ci, release]) assert.ok(!/npm ci(?! --ignore-scripts)/.test(text), 'npm ci runs without install scripts');
});

test('G5 #398 the Action keeps a Node 20 or newer that the job has, and installs only what the command needs plus the pinned design', () => {
  const action = readFileSync(join(ROOT, 'action.yml'), 'utf8');
  assert.match(action, /if: steps\.node\.outputs\.install == 'true'\n\s+uses: actions\/setup-node@/);
  assert.match(action, /npm ci --omit=dev --ignore-scripts/);
  assert.match(action, /devDependencies\['@woonyong-choi\/design-tokens'\]/, 'the design version is read from package.json, not written twice');
  assert.match(action, /npm install --no-save --save-prod --omit=dev --ignore-scripts .*"@woonyong-choi\/design-tokens@\$design"/);
  // 잠금 파일을 읽지 않으면 이미 설치한 의존성이 새 판으로 바뀌어 그림이 저장소 결과와 달라진다
  assert.doesNotMatch(action, /--no-package-lock/);
});
