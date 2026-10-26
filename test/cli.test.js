// 명령줄: render, check, gallery의 결과 파일, 종료 코드, 표준 출력과 오류, 이름 겹침과 쓰기 실패 때의 원자성.
// 모두 새 프로세스로 돌려 파일과 출력으로만 본다. 시험 이름 첫 낱말(L1~L8)이 요구사항 번호이고, 대응은 docs/design/expression-coverage.md의 시험 번호 표에 있다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, readdirSync, realpathSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { cli, diagramplay, findAll, parseMarkup, read, snapshot, textContent, workspace } from './support.js';

const TWO_SCENES = diagramplay('box a "A"\nbox b "B"\na -> b\nscene "first" mode=static\n  a -> b\nscene "second" mode=once\n  b -> a\n');
const BAD = diagramplay('box a ""\n');
const files = (dir) => readdirSync(dir).sort();
const oneLine = (text) => text.trim().split('\n').length === 1;

test('L1 render writes {name}.svg next to the source and prints exactly the paths it wrote', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  const run = cli(['render', 'x.diagramplay'], { cwd: dir });
  assert.equal(run.status, 0);
  assert.equal(run.stderr, '');
  const printed = run.stdout.trim().split('\n');
  assert.equal(printed.length, 1);
  assert.equal(realpathSync(resolve(dir, printed[0])), realpathSync(join(dir, 'x.svg')));
  assert.deepEqual(files(dir), ['x.diagramplay', 'x.svg']);
  assert.match(read(dir, 'x.svg'), /^<svg /);
});

test('L1 --out puts the files elsewhere (creating the folder), --html adds the page, --static makes the picture still', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  const run = cli(['render', 'x.diagramplay', '--out', 'deep/out', '--html', '--static'], { cwd: dir });
  assert.equal(run.status, 0);
  assert.equal(run.stdout.trim().split('\n').length, 2);
  assert.deepEqual(files(join(dir, 'deep/out')), ['x.html', 'x.svg']);
  assert.equal(parseMarkup(read(dir, 'deep/out/x.svg')).attrs['data-mode'], 'static');
  assert.match(read(dir, 'deep/out/x.html'), /^<!doctype html>/);
  assert.deepEqual(files(dir), ['deep', 'x.diagramplay']);
});

test('L1 --scene picks a scene by number (from 1) or by name; a scene that does not exist is exit 1 with nothing written', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  const sceneOf = (selector, out) => {
    const run = cli(['render', 'x.diagramplay', '--scene', selector, '--out', out], { cwd: dir });
    return { run, scene: run.status === 0 ? parseMarkup(read(dir, out, 'x.svg')).attrs['data-scene'] : undefined };
  };
  assert.equal(sceneOf('1', 'o1').scene, '0');
  assert.equal(sceneOf('2', 'o2').scene, '1');
  assert.equal(sceneOf('second', 'o3').scene, '1');
  for (const bad of ['3', '0', 'nope']) {
    const { run } = sceneOf(bad, `bad-${bad}`);
    assert.equal(run.status, 1, bad);
    assert.match(run.stderr, new RegExp(`--scene: no scene "${bad}"\\. Scenes: 1 "first", 2 "second"`), 'the message names what the user typed, not an internal index');
    assert.ok(!files(dir).includes(`bad-${bad}`), 'nothing written');
  }
});

test('L1 a --scene that does not exist is reported once per source with its file name, as --json lines when asked, exit 1, nothing written', (t) => {
  const dir = workspace(t, { 'one.diagramplay': TWO_SCENES, 'two.diagramplay': diagramplay('box b "B"\n') });
  const before = snapshot(dir);
  const plain = cli(['render', 'one.diagramplay', 'two.diagramplay', '--scene', '9', '--out', 'o'], { cwd: dir });
  assert.equal(plain.status, 1);
  assert.equal(plain.stdout, '');
  assert.deepEqual(plain.stderr.trim().split('\n').map((line) => /^(\S+\.diagramplay): --scene: no scene "9"\./.exec(line)?.[1]), ['one.diagramplay', 'two.diagramplay']);
  const json = cli(['render', 'one.diagramplay', 'two.diagramplay', '--scene', '9', '--out', 'o', '--json'], { cwd: dir });
  assert.equal(json.status, 1);
  assert.equal(json.stderr, '');
  const lines = json.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((d) => [d.file, d.severity, d.code]), [['one.diagramplay', 'error', 'scene'], ['two.diagramplay', 'error', 'scene']]);
  assert.deepEqual(lines.map((d) => d.message), ['--scene: no scene "9". Scenes: 1 "first", 2 "second"', '--scene: no scene "9". This figure has no scenes']);
  const named = JSON.parse(cli(['render', 'one.diagramplay', '--scene', 'nope', '--out', 'o', '--json'], { cwd: dir }).stdout);
  assert.equal(named.message, '--scene: no scene "nope". Scenes: 1 "first", 2 "second"');
  assert.deepEqual(snapshot(dir), before);
});

test('L2 an error exits 1, reports "file:line: message" on stderr, writes nothing, and prints nothing on stdout', (t) => {
  const dir = workspace(t, { 'bad.diagramplay': BAD });
  const run = cli(['render', 'bad.diagramplay', '--out', 'o'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^bad\.diagramplay:2: /m);
  assert.deepEqual(files(dir), ['bad.diagramplay']);
});

test('L2 #396 one failing source among several makes render write nothing for any of them', (t) => {
  const dir = workspace(t, { 'ok.diagramplay': diagramplay('box a "가"\n'), 'bad.diagramplay': 'diagramplay\nnope\n' });
  const before = snapshot(dir);
  const run = cli(['render', 'ok.diagramplay', 'bad.diagramplay'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^bad\.diagramplay:2: /m);
  assert.deepEqual(snapshot(dir), before, 'ok.svg is not written either');
});

test('L2 #397 importing the command module from a script whose path no longer exists does not throw and does not run the command', (t) => {
  const dir = workspace(t, {});
  const cliUrl = new URL('../src/cli.js', import.meta.url).href;
  // 진입 판정은 process.argv[1]을 실제 경로로 푼다. 지워진 스크립트 경로를 흉내 내려고 argv[1]을 없는 경로로 둔다.
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', `process.argv[1] = ${JSON.stringify(join(dir, 'gone.mjs'))}; await import(${JSON.stringify(cliUrl)}); process.stdout.write('loaded');`], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, 'loaded');
});

test('L2 --json prints one JSON line per diagnostic with exactly six fields', (t) => {
  const dir = workspace(t, { 'bad.diagramplay': diagramplay('box a ""\nbox b ""\n') });
  const run = cli(['render', 'bad.diagramplay', '--json'], { cwd: dir });
  assert.equal(run.status, 1);
  const lines = run.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.deepEqual(Object.keys(line).sort(), ['code', 'column', 'file', 'line', 'message', 'severity']);
    assert.equal(line.file, 'bad.diagramplay');
    assert.equal(line.severity, 'error');
    assert.equal(line.code, 'syntax');
  }
  assert.deepEqual(lines.map((l) => l.line), [2, 3]);
});

test('L2 a warning still writes (exit 0, "warning:" on stderr); --strict turns it into a failure that writes nothing', (t) => {
  const warned = diagramplay('box a "A"\nbox b "B"\na -> b "same"\nscene "s"\n  a -> b "same"\n');
  const dir = workspace(t, { 'w.diagramplay': warned });
  const lenient = cli(['render', 'w.diagramplay', '--out', 'lenient'], { cwd: dir });
  assert.equal(lenient.status, 0);
  assert.match(lenient.stderr, /^w\.diagramplay:\d+: warning: /m);
  assert.deepEqual(files(join(dir, 'lenient')), ['w.svg']);
  const strict = cli(['render', 'w.diagramplay', '--out', 'strict', '--strict'], { cwd: dir });
  assert.equal(strict.status, 1);
  assert.ok(!files(dir).includes('strict'));
});

test('L2 usage mistakes exit 2 and write nothing: no arguments, unknown command, unknown option, an option without its value, a bad budget', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  // #209: 문서 작성 정책 옵션은 모든 명령에서 알 수 없는 옵션이다.
  const policies = ['render', 'check', 'gallery', 'md'].flatMap((command) => ['--require-data', '--require-ci'].map((flag) => [command, 'x.diagramplay', flag]));
  for (const args of [[], ['frobnicate', 'x.diagramplay'], ['render', 'x.diagramplay', '--nope'], ['render', 'x.diagramplay', '--out'], ['render', 'x.diagramplay', '--budget', 'events'], ['render', 'x.diagramplay', '--budget', 'nothing=5'], ['render', 'x.diagramplay', '--budget', 'events=0'], ['render'], ...policies]) {
    const run = cli(args, { cwd: dir });
    assert.equal(run.status, 2, JSON.stringify(args));
    assert.match(run.stderr, /usage|unknown|needs|budget/i, JSON.stringify(args));
  }
  assert.deepEqual(files(dir), ['x.diagramplay']);
});

test('L2 an empty or repeated option value, an empty file name and a second gallery folder are usage errors that write nothing', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES, 'g/a.diagramplay': diagramplay('box a "A"\n'), 'h/b.diagramplay': diagramplay('box b "B"\n') });
  const before = snapshot(dir);
  const mistakes = [
    [['render', 'x.diagramplay', '--out', ''], /--out needs a value/],
    [['render', 'x.diagramplay', '--out', 'a', '--out', 'b'], /--out is given twice/],
    [['render', 'x.diagramplay', '--scene', '1', '--scene', '2'], /--scene is given twice/],
    [['render', 'x.diagramplay', '--budget', ''], /--budget needs a value/],
    [['render', ''], /file name cannot be empty/],
    [['gallery', 'g', 'h'], /gallery takes one folder, not 2/],
  ];
  for (const [args, message] of mistakes) {
    const run = cli(args, { cwd: dir });
    assert.equal(run.status, 2, JSON.stringify(args));
    assert.match(run.stderr, message, JSON.stringify(args));
    assert.equal(run.stdout, '');
  }
  assert.deepEqual(snapshot(dir), before);
});

test('L2 -- ends the options: a source whose name starts with "-" renders, and without -- it is an unknown option', (t) => {
  const dir = workspace(t, { '-odd.diagramplay': TWO_SCENES });
  assert.equal(cli(['render', '-odd.diagramplay'], { cwd: dir }).status, 2);
  const run = cli(['render', '--out', 'o', '--', '-odd.diagramplay'], { cwd: dir });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(files(join(dir, 'o')), ['-odd.svg']);
  assert.equal(cli(['check', '--', '-odd.diagramplay', '--strict'], { cwd: dir }).status, 1, 'after -- every argument is a file name, so --strict is a missing source');
});

test('L2 only .diagramplay files are sources; any other extension or a missing file is a one-line error and nothing is written', (t) => {
  const dir = workspace(t, { 'x.txt': TWO_SCENES, 'x.muto': TWO_SCENES, 'x.torso': TWO_SCENES });
  for (const input of ['x.txt', 'x.muto', 'x.torso', 'absent.diagramplay']) {
    const run = cli(['render', input], { cwd: dir });
    assert.equal(run.status, 1, input);
    assert.ok(oneLine(run.stderr), `${input}: ${run.stderr}`);
  }
  assert.deepEqual(cli(['render', 'x.txt', '--json'], { cwd: dir }).stdout.trim().split('\n').map((l) => JSON.parse(l).code), ['unsupported-extension']);
  assert.deepEqual(files(dir), ['x.muto', 'x.torso', 'x.txt']);
});

test('L3 check validates like render and writes nothing', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES, 'bad.diagramplay': BAD });
  assert.deepEqual(cli(['check', 'x.diagramplay'], { cwd: dir }), { status: 0, stdout: '', stderr: '' });
  assert.equal(cli(['check', 'bad.diagramplay'], { cwd: dir }).status, 1);
  assert.deepEqual(files(dir), ['bad.diagramplay', 'x.diagramplay']);
});

test('L4 --budget raises a limit the figure would otherwise exceed; without it the figure is refused before anything is written', (t) => {
  const busy = diagramplay('box a "A"\nbox b "B"\nvalue n "n" on=b from=0\na -> b\nscene "s" mode=static for=4s\n  track a -> b at=0s every=100ms time=50ms wait="n>=0" set="n+1"\n');
  const dir = workspace(t, { 'busy.diagramplay': busy });
  const refused = cli(['render', 'busy.diagramplay', '--budget', 'events=20', '--out', 'o', '--json'], { cwd: dir });
  assert.equal(refused.status, 1);
  assert.deepEqual(refused.stdout.trim().split('\n').map((l) => JSON.parse(l).code), ['budget-exceeded']);
  assert.ok(!files(dir).includes('o'));
  assert.equal(cli(['render', 'busy.diagramplay', '--out', 'o'], { cwd: dir }).status, 0);
});

test('L5 #176 two sources that would write the same file are refused before anything is written, whatever hides the clash', (t) => {
  const dir = workspace(t, { 'a/x.diagramplay': diagramplay('box first "FIRST"\n'), 'b/x.diagramplay': diagramplay('box second "SECOND"\n'), 'c/X.diagramplay': diagramplay('box third "THIRD"\n'), 'd/é.diagramplay': diagramplay('box d "D"\n'), 'e/é.diagramplay': diagramplay('box e "E"\n') });
  const clashes = [['a/x.diagramplay', 'b/x.diagramplay'], ['a/x.diagramplay', 'c/X.diagramplay'], ['d/é.diagramplay', 'e/é.diagramplay'], ['a/x.diagramplay', 'a/x.diagramplay']];
  for (const inputs of clashes) {
    const before = snapshot(dir);
    const run = cli(['render', ...inputs, '--out', 'out'], { cwd: dir });
    assert.equal(run.status, 1, inputs.join(' '));
    assert.match(run.stderr, /would be written twice/);
    assert.deepEqual(snapshot(dir), before, `${inputs.join(' ')}: nothing was written, not even the folder`);
    assert.equal(run.stdout, '');
  }
  const json = cli(['render', 'a/x.diagramplay', 'b/x.diagramplay', '--out', 'out', '--json'], { cwd: dir });
  assert.equal(JSON.parse(json.stdout.trim().split('\n')[0]).code, 'output-collision');
  // 각자 자기 폴더에 쓰면 겹치지 않는다
  assert.equal(cli(['render', 'a/x.diagramplay', 'b/x.diagramplay'], { cwd: dir }).status, 0);
  assert.match(read(dir, 'a/x.svg'), /FIRST/);
  assert.match(read(dir, 'b/x.svg'), /SECOND/);
  // --html도 같은 이름을 다투므로 .svg가 다른 이름이어도 .html이 겹치면 거절한다
  const withHtml = cli(['render', 'a/x.diagramplay', 'b/x.diagramplay', '--html', '--out', 'out2'], { cwd: dir });
  assert.equal(withHtml.status, 1);
});

test('L5 #176 two outputs that are existing symbolic links to one file are one output: refused before any write, both links and the target untouched', (t) => {
  const dir = workspace(t, { 'a.diagramplay': diagramplay('box a "A"\n'), 'b.diagramplay': diagramplay('box b "B"\n'), 'target.svg': 'the shared target' });
  mkdirSync(join(dir, 'out'));
  symlinkSync(join(dir, 'target.svg'), join(dir, 'out/a.svg'));
  symlinkSync(join(dir, 'target.svg'), join(dir, 'out/b.svg'));
  const before = snapshot(dir);
  const run = cli(['render', 'a.diagramplay', 'b.diagramplay', '--out', 'out'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /would be written twice/);
  assert.equal(run.stdout, '');
  assert.deepEqual(snapshot(dir), before, 'neither link was replaced and the target kept its text');
  const json = cli(['render', 'a.diagramplay', 'b.diagramplay', '--out', 'out', '--json'], { cwd: dir });
  assert.equal(JSON.parse(json.stdout.trim().split('\n')[0]).code, 'output-collision');
  assert.deepEqual(snapshot(dir), before);
  // 링크 하나만 쓰면 충돌이 아니다: 링크는 그대로 두고 가리키는 파일을 바꾼다
  assert.equal(cli(['render', 'a.diagramplay', '--out', 'out'], { cwd: dir }).status, 0);
  assert.equal(lstatSync(join(dir, 'out/a.svg')).isSymbolicLink(), true);
  assert.match(read(dir, 'target.svg'), /^<svg /);
});

test('L6 #177 an output that is a symbolic link to nothing is not silently replaced by a file: one io line, exit 1, the link stays', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  mkdirSync(join(dir, 'out'));
  symlinkSync(join(dir, 'missing.svg'), join(dir, 'out/x.svg'));
  const before = snapshot(dir);
  const run = cli(['render', 'x.diagramplay', '--out', 'out', '--json'], { cwd: dir });
  assert.equal(run.status, 1);
  const lines = run.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((l) => l.code), ['io']);
  assert.match(lines[0].message, /symbolic link/);
  assert.deepEqual(snapshot(dir), before);
  const plain = cli(['render', 'x.diagramplay', '--out', 'out'], { cwd: dir });
  assert.equal(plain.status, 1);
  assert.ok(oneLine(plain.stderr), plain.stderr);
  assert.deepEqual(snapshot(dir), before);
});

test('L1 a file with no scenes is refused for --scene in render, whatever the value; without --scene it renders one still picture', (t) => {
  const dir = workspace(t, { 'plain.diagramplay': diagramplay('box a "A"\n') });
  for (const value of ['1', 'first']) {
    const run = cli(['render', 'plain.diagramplay', '--scene', value, '--out', 'o'], { cwd: dir });
    assert.equal(run.status, 1, value);
    assert.match(run.stderr, /--scene: no scene .*no scenes/);
    assert.deepEqual(files(dir), ['plain.diagramplay']);
  }
  assert.equal(cli(['render', 'plain.diagramplay', '--out', 'o'], { cwd: dir }).status, 0);
});

test('L3 check refuses every option that only writes output, as a usage error that touches nothing', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  const before = snapshot(dir);
  for (const args of [['--html'], ['--static'], ['--out', 'o'], ['--scene', '1'], ['--title', 'T']]) {
    const run = cli(['check', 'x.diagramplay', ...args], { cwd: dir });
    assert.equal(run.status, 2, args.join(' '));
    assert.match(run.stderr, new RegExp(`${args[0]} is not for check`));
    assert.equal(run.stdout, '');
  }
  assert.equal(cli(['render', 'x.diagramplay', '--title', 'T'], { cwd: dir }).status, 2);
  assert.deepEqual(snapshot(dir), before);
});

test('L6 #177 a write that cannot happen is one stderr line and exit 1, leaving every existing file as it was', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES, 'blocker': 'i am a file', 'o/x.svg': 'old picture', 'o/x.html/keep.txt': 'inside a folder' });
  const scenarios = [
    ['render', 'x.diagramplay', '--out', 'blocker'],
    ['render', 'x.diagramplay', '--out', 'blocker/inner'],
    ['render', 'x.diagramplay', '--out', 'o', '--html'],
  ];
  for (const args of scenarios) {
    const before = snapshot(dir);
    const run = cli(args, { cwd: dir });
    assert.equal(run.status, 1, args.join(' '));
    assert.ok(oneLine(run.stderr), `${args.join(' ')}: ${JSON.stringify(run.stderr)}`);
    assert.doesNotMatch(run.stderr, /\n\s+at |node:internal|Error:/);
    assert.equal(run.stdout, '');
    assert.deepEqual(snapshot(dir), before, args.join(' '));
  }
});

test('L6 a successful render replaces an old output completely and leaves no temporary files', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES, 'o/x.svg': 'old picture', 'o/x.html': 'old page' });
  assert.equal(cli(['render', 'x.diagramplay', '--out', 'o', '--html'], { cwd: dir }).status, 0);
  assert.deepEqual(files(join(dir, 'o')), ['x.html', 'x.svg']);
  assert.match(read(dir, 'o/x.svg'), /^<svg /);
  assert.match(read(dir, 'o/x.html'), /^<!doctype html>/);
});

// ---- gallery ----

test('L7 gallery writes every figure as SVG and page plus the list page and the document preview', (t) => {
  const dir = workspace(t, { 'g/a.diagramplay': diagramplay('box a "A"\n'), 'g/b c.diagramplay': diagramplay('title "Second"\nbox b "B"\n'), 'g/notes.txt': 'not a source' });
  const run = cli(['gallery', 'g', '--title', 'Mine'], { cwd: dir });
  assert.equal(run.status, 0);
  assert.deepEqual(files(join(dir, 'g/out')), ['a.html', 'a.svg', 'b c.html', 'b c.svg', 'document.html', 'index.html']);
  const index = parseMarkup(read(dir, 'g/out/index.html'), { html: true });
  const frames = findAll(index, (n) => n.tag === 'iframe').map((n) => n.attrs.src);
  assert.deepEqual(frames.sort(), ['./a.html', './b%20c.html']);
  assert.ok(findAll(index, (n) => n.tag === 'title').some((n) => textContent(n).includes('Mine')));
});

test('L7 gallery reserves index.html and document.html; a source with such a name gets a "-player" page and the list stays the list', (t) => {
  const dir = workspace(t, { 'g/index.diagramplay': diagramplay('box i "I"\n'), 'g/Document.diagramplay': diagramplay('box d "D"\n') });
  assert.equal(cli(['gallery', 'g'], { cwd: dir }).status, 0);
  assert.deepEqual(files(join(dir, 'g/out')), ['Document-player.html', 'Document.svg', 'document.html', 'index-player.html', 'index.html', 'index.svg']);
  assert.match(read(dir, 'g/out/index.html'), /index-player\.html/);
});

test('L7 gallery is all or nothing: a source with an error, no source at all, or a name clash writes nothing', (t) => {
  const dir = workspace(t, { 'bad/ok.diagramplay': diagramplay('box a "A"\n'), 'bad/bad.diagramplay': BAD, 'empty/readme.txt': 'x', 'clash/Same.diagramplay': diagramplay('box a "A"\n'), 'clash/same.diagramplay': diagramplay('box b "B"\n') });
  for (const folder of ['bad', 'empty']) {
    const before = snapshot(dir);
    const run = cli(['gallery', folder], { cwd: dir });
    assert.equal(run.status, 1, folder);
    assert.deepEqual(snapshot(dir), before, folder);
  }
  // 대소문자만 다른 두 원본은 같은 폴더에 둘 다 만들 수 있는 파일 시스템에서만 시험할 수 있다
  if (files(join(dir, 'clash')).length !== 2) return t.skip('this filesystem folds case: two sources that differ only by case cannot coexist');
  const run = cli(['gallery', 'clash'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /would be written twice/);
  assert.ok(!files(join(dir, 'clash')).includes('out'));
});

test('L7 gallery refuses render-only options, and a write that cannot happen leaves the output folder as it was', (t) => {
  const dir = workspace(t, { 'g/a.diagramplay': diagramplay('box a "A"\n'), 'g/b.diagramplay': diagramplay('box b "B"\n'), 'g/out/b.html/keep.txt': 'folder in the way' });
  for (const option of ['--static', '--json']) assert.equal(cli(['gallery', 'g', option], { cwd: dir }).status, 2, option);
  const before = snapshot(dir);
  const run = cli(['gallery', 'g'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.ok(oneLine(run.stderr), JSON.stringify(run.stderr));
  assert.deepEqual(snapshot(dir), before);
});

test('L7 gallery links are plain relative paths: odd names are percent-encoded so a name can never become a URL scheme', (t) => {
  const dir = workspace(t, { 'g/javascript:alert(1).diagramplay': diagramplay('box a "A"\n'), 'g/a#b?c.diagramplay': diagramplay('box b "B"\n') });
  assert.equal(cli(['gallery', 'g'], { cwd: dir }).status, 0);
  const index = parseMarkup(read(dir, 'g/out/index.html'), { html: true });
  const urls = findAll(index, (n) => n.attrs.src !== undefined || n.attrs.href !== undefined).flatMap((n) => [n.attrs.src, n.attrs.href]).filter((u) => u && !u.startsWith('data:') && u !== '#');
  for (const url of urls) assert.doesNotMatch(url, /^[a-z][a-z0-9+.-]*:/i, url);
  assert.ok(urls.some((u) => u.startsWith('./a%23b%3Fc')));
});

test('L8 rendering twice, in two processes, gives the same bytes', (t) => {
  const dir = workspace(t, { 'x.diagramplay': TWO_SCENES });
  cli(['render', 'x.diagramplay', '--out', 'one', '--html'], { cwd: dir });
  cli(['render', 'x.diagramplay', '--out', 'two', '--html'], { cwd: dir });
  assert.equal(read(dir, 'one/x.svg'), read(dir, 'two/x.svg'));
  assert.equal(read(dir, 'one/x.html'), read(dir, 'two/x.html'));
});
