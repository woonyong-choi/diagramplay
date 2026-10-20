import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chromium } from 'playwright-core';

import { buildFigure, toHtml, toSvg } from '../../src/index.js';

// #388: 실제 stroke와 화살촉의 합성 대비 및 사용자 cascade 보존 계약.
test('relation_defaults_and_overrides_survive_playback_and_loops', async () => {
  const result = await buildFigure(`diagramplay
box a "A"
box b "B"
a -> b dashed
scene "rest"
scene "loop" mode=loop
  a -> b time=500ms
  wait 1s
`);
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'no-preference' });
      try {
        for (const [kind, output] of [['svg', await toSvg(result, { scene: 1 })], ['html', await toHtml(result)]]) {
          const page = await context.newPage();
          await page.setContent(output);
          if (kind === 'svg') await page.evaluate(() => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 1000; }));
          const root = page.locator('svg.fl').first();
          const edge = root.locator('.fl-edge').first();
          const path = edge.locator('.fl-path');
          const stroke = () => path.evaluate(element => getComputedStyle(element).stroke);
          const rest = await stroke();
          const ratios = await path.evaluate(element => {
            const style = getComputedStyle(element);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d');
            let opacity = Number(style.strokeOpacity);
            for (let parent = element; parent; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
            const pixel = (background, foreground, alpha) => {
              ctx.clearRect(0, 0, 1, 1);
              ctx.globalAlpha = 1;
              ctx.fillStyle = background;
              ctx.fillRect(0, 0, 1, 1);
              ctx.globalAlpha = alpha;
              ctx.fillStyle = foreground;
              ctx.fillRect(0, 0, 1, 1);
              return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
            };
            const luminance = rgb => rgb.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
            return ['figure-canvas', 'ui-card'].map(role => {
              const background = style.getPropertyValue(`--color-${role}`).trim();
              const a = luminance(pixel(background, style.stroke, opacity));
              const b = luminance(pixel(background, background, 1));
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            });
          });
          assert(ratios.every(ratio => ratio >= 3), `${kind} ${colorScheme}: ${ratios}`);
          console.log(`${kind} ${colorScheme} canvas/card contrast: ${ratios.join(', ')}`);
          assert.notEqual(await path.evaluate(element => getComputedStyle(element).strokeDasharray), 'none');
          assert.equal(await edge.locator('.fl-arrowhead').first().evaluate(element => getComputedStyle(element).fill), rest);
          await root.evaluate(element => element.style.setProperty('--fx-line-rest', 'var(--color-ink)'));
          const rootOverride = await stroke();
          assert.notEqual(rootOverride, rest);
          await edge.evaluate(element => element.style.setProperty('--fx-line-rest', 'var(--color-line)'));
          assert.notEqual(await stroke(), rootOverride);
          await edge.evaluate(element => element.style.removeProperty('--fx-line-rest'));
          await root.evaluate(element => element.style.removeProperty('--fx-line-rest'));
          assert.equal(await stroke(), rest);
          await edge.evaluate(element => element.classList.add('mark'));
          assert.equal(await stroke(), rootOverride);
          await edge.evaluate(element => element.classList.remove('mark'));
          await root.evaluate(element => element.style.setProperty('--fx-edge', 'var(--color-ink)'));
          if (kind === 'html') {
            await page.getByRole('tab', { name: 'loop', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.fl-edge.on'));
            assert.equal(await stroke(), rootOverride, 'explicit active override');
            await page.waitForFunction(() => !document.querySelector('.fl-edge.on'));
            assert.equal(await stroke(), rest);
            await page.waitForFunction(() => document.querySelector('.fl-edge.on'));
            await page.waitForFunction(() => !document.querySelector('.fl-edge.on'));
            assert.equal(await stroke(), rest, 'second loop returns to default');
            await page.getByRole('tab', { name: 'rest', exact: true }).click();
            assert.equal(await stroke(), rest, 'scene switch restores rest');
          } else {
            for (const currentTime of [250, 1000, 1750, 2500]) {
              await page.evaluate(time => document.getAnimations().forEach(animation => { animation.currentTime = time; }), currentTime);
              assert.equal(await stroke(), currentTime % 1500 < 500 ? rootOverride : rest);
            }
          }
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});
