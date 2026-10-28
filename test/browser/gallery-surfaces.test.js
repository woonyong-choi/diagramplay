import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { chromium } from 'playwright-core';

import { COMPARISON_EXAMPLES } from '../../scripts/lib/comparison-examples.mjs';
import { toComparison } from '../../src/html/listing.js';
import { buildFigure, toHtml, toSvg } from '../../src/index.js';

test('comparison_gallery_and_diagram_surfaces_keep_white_content_cards_distinct', async () => {
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
          await page.locator('.comparison-detail img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
          for (const size of await page.locator('.comparison-detail img').evaluateAll(images => images.map(image => ({ shown: image.getBoundingClientRect().width, natural: image.naturalWidth })))) assert.ok(size.shown <= size.natural + 1, 'detail never magnifies a small diagram');
          for (const face of [...surfaces.cards, ...surfaces.details]) {
            assert.notEqual(face, 'rgba(0, 0, 0, 0)');
            assert.notEqual(face, surfaces.page, `${width}/${mode}: the gallery card remains distinct from the page`);
            assert.equal(face, surfaces.cards[0], 'overview and detail use one gallery surface');
          }
          for (const example of COMPARISON_EXAMPLES) {
            const player = await context.newPage();
            try {
              await player.goto(`${origin}/${example.id}.html`);
              await player.evaluate(() => document.fonts.ready);
              assert.equal(await player.locator('html').getAttribute('data-theme'), mode);
              const paper = await player.locator('.fl-canvas').evaluate(element => getComputedStyle(element).backgroundColor);
              const card = await player.locator('.fl-node > .fl-stroke').first().evaluate(element => getComputedStyle(element).fill);
              assert.equal(paper, surfaces.cards[0], `${example.id}: diagram and gallery backgrounds share the neutral surface`);
              assert.notEqual(paper, card, `${example.id}: content cards stay distinct from the diagram background`);
              const roles = await player.evaluate(() => {
                const style = selector => getComputedStyle(document.querySelector(selector));
                const paths = [...document.querySelectorAll('.fl-path')].map(path => getComputedStyle(path).fill);
                const foot = document.querySelector('.fl-foot').getBoundingClientRect();
                const surface = document.querySelector('.fl-surface').getBoundingClientRect();
                return { paths, before: foot.bottom <= surface.top + 1, toolbar: style('.app-toolbar').opacity, title: style('.fl-node .label').fontWeight, border: style('.fl-node > .fl-stroke').stroke, edge: style('.fl-path').stroke, group: document.querySelector('.frame-box') ? style('.frame-box').stroke : undefined };
              });
              assert.ok(roles.paths.every(fill => fill === 'none'), 'relationship paths never gain a closed fill');
              assert.equal(roles.before, true, 'scene selection precedes the drawing');
              assert.equal(roles.toolbar, '1', 'zoom entry remains discoverable without hover');
              assert.equal(roles.title, '600');
              if (roles.group) assert.notEqual(roles.group, roles.border, 'large boundaries recede behind cards');
              if (mode === 'light') assert.notEqual(roles.border, roles.edge, 'card and relationship have separate roles');
              if (width === 1280 && example.id === 'architecture') {
                const [download] = await Promise.all([player.waitForEvent('download'), player.getByRole('button', { name: 'HTML 다운로드', exact: true }).click()]);
                const saved = await readFile(await download.path(), 'utf8');
                assert.ok(saved.includes('fl-source') && saved.toLowerCase().includes('<!doctype html>'), 'download preserves the working source document');
                await player.getByRole('button', { name: '전체화면', exact: true }).click();
                await player.waitForFunction(() => document.querySelector('.fl-figure.full'));
                const scale = await player.locator('svg.fl').first().evaluate(svg => svg.getScreenCTM().a);
                assert.ok(scale >= 0.99, 'reading opens at the natural text size without repeated zoom clicks');
                await player.setViewportSize({ width: 1024, height: 768 });
                await player.waitForFunction(() => Math.abs(document.querySelector('svg.fl').getScreenCTM().a - 1) < 0.01);
                await player.setViewportSize({ width: 1280, height: 900 });
                await player.waitForFunction(() => Math.abs(document.querySelector('svg.fl').getScreenCTM().a - 1) < 0.01);
                await player.getByRole('button', { name: '전체 보기', exact: true }).click();
                const fitted = await player.locator('svg.fl').first().evaluate(svg => svg.getScreenCTM().a);
                assert.ok(fitted < scale, 'the existing fit action still shows the whole structure');
                await player.getByRole('button', { name: '전체화면 종료', exact: true }).click();
              }
            } finally { await player.close(); }
          }
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
