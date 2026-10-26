import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { acquireLocks } from '../src/md-lock.js';
import { cli, read, snapshot, workspace } from './support.js';

const document = '# Doc\n\n```diagramplay\ndiagramplay\nbox a "A"\n```\n';
const lockText = (pid) => JSON.stringify({ pid, host: hostname(), created: new Date().toISOString(), nonce: 'old-lock' });

test('M10 stale cleanup serializes a second contender before it can replace the lock', (t) => {
  const dir = workspace(t, { 'doc.md': document });
  const path = join(fs.realpathSync(dir), '.diagramplay-md.lock');
  const dead = spawnSync(process.execPath, ['-e', '']);
  assert.equal(dead.status, 0);
  fs.writeFileSync(path, lockText(dead.pid));
  const rename = fs.renameSync;
  let contender;
  let first;
  let entered = false;
  fs.renameSync = function (from, to, ...args) {
    if (from === path && !entered) {
      entered = true;
      contender = acquireLocks([dir]);
    }
    return rename(from, to, ...args);
  };
  syncBuiltinESMExports();
  try {
    first = acquireLocks([dir]);
    assert.ok(entered, 'the first process reached stale cleanup');
    assert.ok(contender.busy, 'the contender must not acquire during stale cleanup');
    assert.ok(first.release, 'the first process replaces the stale lock');
    const owner = read(dir, '.diagramplay-md.lock');
    assert.equal(JSON.parse(owner).pid, process.pid);
    assert.ok(acquireLocks([dir]).busy, 'a third contender cannot enter the protected write');
    assert.equal(read(dir, '.diagramplay-md.lock'), owner, 'contenders leave the held lock in place');
  } finally {
    fs.renameSync = rename;
    syncBuiltinESMExports();
    first?.release?.();
    contender?.release?.();
  }
});

test('M10 #397 a guard left by a process that is gone is cleared like a stale lock; a live, unreadable or foreign guard still refuses', (t) => {
  const dir = workspace(t, { 'doc.md': document });
  const guard = join(dir, '.diagramplay-md.lock.guard');
  const owner = (pid, host = hostname()) => `${JSON.stringify({ pid, host, created: new Date().toISOString(), nonce: 'guard' })}\n`;
  const dead = spawnSync(process.execPath, ['-e', '']);
  fs.mkdirSync(guard);
  fs.writeFileSync(join(guard, 'owner.json'), owner(dead.pid));
  const cleared = cli(['md', 'doc.md'], { cwd: dir });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.ok(!fs.existsSync(guard), 'the dead guard is gone');
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.startsWith('.')), []);
  for (const [why, write] of [['alive', owner(process.pid)], ['another host', owner(dead.pid, 'some-other-host')], ['unreadable', 'not json'], ['empty', undefined]]) {
    fs.rmSync(guard, { recursive: true, force: true });
    fs.mkdirSync(guard);
    if (write !== undefined) fs.writeFileSync(join(guard, 'owner.json'), write);
    const before = snapshot(dir);
    const run = cli(['md', 'doc.md', '--json'], { cwd: dir });
    assert.equal(run.status, 1, why);
    const problem = JSON.parse(run.stdout.trim());
    assert.equal(problem.code, 'md-locked', why);
    assert.match(problem.message, /guard directory by hand/, why);
    assert.deepEqual(snapshot(dir), before, why);
  }
});

test('M10 a held document folder also blocks writes to a different SVG output folder', (t) => {
  const dir = workspace(t, { 'doc.md': document, '.diagramplay-md.lock': lockText(process.pid) });
  const before = snapshot(dir);
  const run = cli(['md', 'doc.md', '--out-dir', 'figures', '--json'], { cwd: dir });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout.trim()).code, 'md-locked');
  assert.deepEqual(snapshot(dir), before);
});
