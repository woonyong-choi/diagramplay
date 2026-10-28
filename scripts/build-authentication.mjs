// 인증 설명 예제를 제품의 공개 빌드 API와 공통 갤러리로 만든다.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildFigure, toHtml, toSvg } from '../src/index.js';
import { toDocument, toGallery } from '../src/html/listing.js';
import { supportFiles } from './lib/catalog-support.mjs';

const SOURCE = 'examples/authentication';
const OUTPUT = '.local/authentication';
const EXAMPLES = ['commerce-system', 'login-question', 'identity-access', 'sessions', 'session-scale', 'jwt-structure', 'jwt-flow', 'refresh-tokens', 'stolen-token', 'sso', 'oauth', 'oauth-key', 'oidc', 'auth-system'];

async function main() {
  mkdirSync(OUTPUT, { recursive: true });
  const entries = [];
  for (const name of EXAMPLES) {
    const source = readFileSync(resolve(SOURCE, `${name}.diagramplay`), 'utf8');
    const result = await buildFigure(source, { baseDir: SOURCE, strict: true });
    writeFileSync(resolve(OUTPUT, `${name}.diagramplay`), source);
    writeFileSync(resolve(OUTPUT, `${name}.svg`), await toSvg(result, { name }));
    writeFileSync(resolve(OUTPUT, `${name}.html`), await toHtml(result, name));
    for (const file of supportFiles(source, SOURCE)) {
      mkdirSync(dirname(resolve(OUTPUT, file)), { recursive: true });
      copyFileSync(resolve(SOURCE, file), resolve(OUTPUT, file));
    }
    entries.push({ name, href: name, title: result.figure.title, kind: result.figure.subtitle });
    console.log(`${name}: ${result.timeline.steps.length} scenes`);
  }
  const heading = 'DiagramPlay · 인증 흐름 실험';
  writeFileSync(resolve(OUTPUT, 'index.html'), toGallery(entries, heading));
  writeFileSync(resolve(OUTPUT, 'document.html'), toDocument(entries, heading));
  console.log(`${entries.length} figures → ${OUTPUT}/index.html`);
}

await main();
