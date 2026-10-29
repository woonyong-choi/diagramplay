// 결과 파일에 넣을 스타일과 SVG defs. 값은 모두 토큰(tokens.css, tokens.js)에서 온다.
import { pruneTokens } from '@woonyong-choi/design-tokens/ui/build/prune-tokens.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import postcss from 'postcss';

// cost: time O(n), heap O(n), stack O(1), io 1
// vars: n = CSS 파일 글자 수
// basis: estimate
// 디자인은 호스트 앱이 설치한 @woonyong-choi/design-tokens 하나를 peer 의존성으로 읽는다.
const require = createRequire(import.meta.url);
function readStyle(name) {
  return readFileSync(require.resolve(name), 'utf8');
}

/** 결과 파일 안 `<style>`에 넣을 CSS. tokens.css는 생성물이다. */
export const STYLES = Object.freeze({
  tokens: readStyle('@woonyong-choi/design-tokens/tokens.css'),
  figure: figureRoles(readStyle('@woonyong-choi/design-tokens/styles/diagram/figure.css')),
  control: readStyle('@woonyong-choi/design-tokens/styles/tabs.css') + readStyle('@woonyong-choi/design-tokens/styles/toolbar.css'),
  player: readStyle('@woonyong-choi/design-tokens/styles/diagram/player.css'),
  gallery: readStyle('@woonyong-choi/design-tokens/styles/diagram-embed.css') + readStyle('@woonyong-choi/design-tokens/styles/diagram/gallery.css'),
  document: readStyle('@woonyong-choi/design-tokens/styles/diagram/document.css'),
  status: readStyle('@woonyong-choi/design-tokens/styles/diagram/status.css'),
});

/** 의미 관계선의 기본 역할만 고른다. 정본의 상태 규칙과 cascade는 그대로 둔다.
 * @throws {Error} 설치된 정본의 기본 선언 계약이 달라졌을 때
 */
export function figureRoles(css) {
  const root = postcss.parse(css);
  const defaults = [];
  root.walkDecls('--fx-line-rest', declaration => {
    if (declaration.parent.type === 'rule' && declaration.parent.selector === '.fl') defaults.push(declaration);
  });
  if (defaults.length !== 1 || defaults[0].value !== 'var(--color-line)' || defaults[0].important || defaults[0].parent.parent.type !== 'root') {
    throw new Error('shared figure CSS must define one unqualified .fl --fx-line-rest: var(--color-line) default');
  }
  defaults[0].value = 'var(--color-outline)';
  return root.toString();
}

export const tokensFor = usage => pruneTokens(STYLES.tokens, usage);
