import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { chromium } from 'playwright-core';

import { COMPARISON_EXAMPLES } from '../../scripts/lib/comparison-examples.mjs';
import { toComparison } from '../../src/html/listing.js';
import { buildFigure, toHtml, toSvg } from '../../src/index.js';

test('comparison_gallery_surfaces_remain_visible_when_diagram_paper_is_white', async () => {
  const documents = new Map([['/index.html', toComparison(COMPARISON_EXAMPLES)]]);
  for (const example of COMPARISON_EXAMPLES) {
    const result = await buildFigure(example.source, { strict: true });
    documents.set(`/${example.id}.svg`, await toSvg(result, { isStatic: true, scene: example.scene }));
    documents.set(`/${example.id}.html`, await toHtml(result));
  }
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const body = documents.get(path);
    response.writeHead(body ? 200 : 404, { 'Content-Type': path.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8' });
    response.end(body ?? 'not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [1280, 390]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/index.html`);
        for (const [mode, label] of [['light', '라이트'], ['dark', '다크']]) {
          await page.getByRole('button', { name: label, exact: true }).click();
          await page.locator('.comparison-overview img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
          const surfaces = await page.evaluate(() => ({
            page: getComputedStyle(document.body).backgroundColor,
            cards: [...document.querySelectorAll('.comparison-card')].map(card => getComputedStyle(card).backgroundColor),
            details: [...document.querySelectorAll('.comparison-detail')].map(detail => getComputedStyle(detail).backgroundColor),
            overflow: document.documentElement.scrollWidth > innerWidth,
          }));
          assert.equal(surfaces.cards.length, 5);
          assert.equal(surfaces.details.length, 5);
          assert.equal(surfaces.overflow, false, `${width}/${mode}: no page overflow`);
          for (const face of [...surfaces.cards, ...surfaces.details]) {
            assert.notEqual(face, 'rgba(0, 0, 0, 0)');
            assert.notEqual(face, surfaces.page, `${width}/${mode}: the gallery card remains distinct from the page`);
            assert.equal(face, surfaces.cards[0], 'overview and detail use one gallery surface');
          }
          const player = await context.newPage();
          try {
            await player.goto(`${origin}/sequence.html`);
            await player.evaluate(() => document.fonts.ready);
            assert.equal(await player.locator('html').getAttribute('data-theme'), mode);
            const paper = await player.locator('.fl-canvas').evaluate(element => getComputedStyle(element).backgroundColor);
            if (mode === 'light') assert.notEqual(paper, surfaces.cards[0], 'white diagram paper does not replace the gallery surface');
          } finally { await player.close(); }
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
