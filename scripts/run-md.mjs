// 사용: node scripts/run-md.mjs [md 명령 옵션 ...]   예: node scripts/run-md.mjs --check --strict
import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iterFiles } from '@woonyong-choi/design-tokens/ui/build/lib/walk-files.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));
// 설치한 패키지, 버전 관리 내부, 만든 결과(.local, out)는 걸어 들어가지 않는다.
const DOCUMENTS = { wants: (name) => name.endsWith('.md'), skipDirs: new Set(['node_modules', '.git', '.local', 'out']) };

const documents = [...iterFiles([ROOT], DOCUMENTS)].filter((path) => !lstatSync(path).isSymbolicLink()).map((path) => relative(ROOT, path));
const run = spawnSync(process.execPath, [CLI, 'md', ...process.argv.slice(2), '--', ...documents], { cwd: ROOT, stdio: 'inherit' });
process.exitCode = run.status ?? 1;
