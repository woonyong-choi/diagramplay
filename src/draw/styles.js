// 결과 파일에 넣을 스타일과 SVG defs. 값은 모두 토큰(tokens.css, tokens.js)에서 온다.
import { pruneTokens } from '@woonyong-choi/design-tokens/ui/build/prune-tokens.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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
  figure: readStyle('@woonyong-choi/design-tokens/styles/diagram/figure.css'),
  control: readStyle('@woonyong-choi/design-tokens/styles/tabs.css') + readStyle('@woonyong-choi/design-tokens/styles/toolbar.css'),
  player: readStyle('@woonyong-choi/design-tokens/styles/diagram/player.css'),
  gallery: readStyle('@woonyong-choi/design-tokens/styles/diagram-embed.css') + readStyle('@woonyong-choi/design-tokens/styles/diagram/gallery.css'),
  document: readStyle('@woonyong-choi/design-tokens/styles/diagram/document.css'),
  status: readStyle('@woonyong-choi/design-tokens/styles/diagram/status.css'),
});

export const tokensFor = usage => pruneTokens(STYLES.tokens, usage);
