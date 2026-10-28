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
            await page.waitForFunction(expected => !document.querySelector('.fl-edge.on') && getComputedStyle(document.querySelector('.fl-path')).stroke === expected, rest);
            await page.waitForFunction(() => document.querySelector('.fl-edge.on'));
            // 같은 프레임에서 비활성 상태와 실제 색을 함께 관측해 다음 루프와 경합하지 않는다.
            await page.waitForFunction(expected => !document.querySelector('.fl-edge.on') && getComputedStyle(document.querySelector('.fl-path')).stroke === expected, rest);
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

test('numbered_and_plain_pills_keep_filled_contrast_with_distinct_rest_emphasis', async () => {
  const result = await buildFigure(`diagramplay
box a "A"
box b "B"
box c "C"
a -> b "요청" no=1
b -> c "전달"
scene "rest"
scene "run" mode=loop
  a -> b time=1s
  b -> c time=1s
  wait 1s
`);
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const colorScheme of ['light', 'dark']) {
      for (const [kind, output] of [['svg', await toSvg(result, { scene: 1 })], ['html', await toHtml(result)]]) {
        const page = await browser.newPage({ colorScheme, reducedMotion: 'no-preference' });
        try {
          await page.setContent(output);
          if (kind === 'html') await page.getByRole('tab', { name: 'run', exact: true }).click();
          await page.waitForFunction(() => document.getAnimations().length > 0 || document.querySelector('.fl-edge.on'));
          for (const state of ['rest', 'active']) {
            if (kind === 'svg') await page.evaluate(time => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = time; }), state === 'active' ? 250 : 2900);
            else if (state === 'rest') await page.getByRole('tab', { name: 'rest', exact: true }).click();
            else {
              await page.getByRole('tab', { name: 'run', exact: true }).click();
              await page.waitForFunction(() => document.querySelector('#e-0.on'));
            }
            const pills = await page.locator('svg.fl:not(.fl-still) .fl-pill').evaluateAll(elements => elements.filter(element => !element.closest('.fl-still')).map(element => {
              const face = getComputedStyle(element.querySelector('.pill'));
              const text = getComputedStyle(element.querySelector('.edgelabel'));
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 1;
              const ctx = canvas.getContext('2d');
              const rgb = color => {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                return [...ctx.getImageData(0, 0, 1, 1).data];
              };
              const luminance = rgb => rgb.slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
              const fill = rgb(face.fill);
              const a = luminance(fill), b = luminance(rgb(text.fill));
              return { fill: face.fill, ink: text.fill, alpha: fill[3], ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), numbered: !!element.querySelector('.number-pill') };
            }));
            assert.equal(pills.length, 2);
            assert.deepEqual(pills.map(pill => pill.numbered), [true, false]);
            for (const pill of pills) {
              assert.equal(pill.alpha, 255, `${kind}/${colorScheme}/${state}: filled background`);
              assert.ok(pill.ratio >= 4.5, `${kind}/${colorScheme}/${state}: ${JSON.stringify(pill)}`);
            }
            if (state === 'rest') assert.notEqual(pills[0].fill, pills[1].fill, 'numbered steps have stronger rest emphasis than ordinary descriptions');
          }
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
});

test('example_theme_controls_preserve_scene_and_status_pills_use_filled_semantics', async () => {
  const result = await buildFigure(`diagramplay
box a "A"
box b "B"
a -> b "요청" no=1
scene "성공" mode=loop status="b=ok"
  a -> b time=1s
  wait 1s
scene "실패" mode=loop status="b=fail"
  a -> b time=1s
  wait 1s
`);
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(await toHtml(result));
    await page.getByRole('tab', { name: '실패', exact: true }).click();
    for (const theme of ['라이트', '다크']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      assert.equal(await page.getByRole('button', { name: theme, exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByRole('tab', { name: '실패', exact: true }).getAttribute('aria-selected'), 'true');
      const status = await page.locator('.fl-status-fail').first().evaluate(element => ({
        fill: getComputedStyle(element.querySelector('.status-pill')).fill,
        ink: getComputedStyle(element.querySelector('.status-text')).fill,
        expectedFill: getComputedStyle(element).getPropertyValue('--color-figure-status-fail-fill').trim(),
        expectedInk: getComputedStyle(element).getPropertyValue('--color-figure-status-fail-ink').trim(),
      }));
      assert.notEqual(status.fill, status.ink);
      assert.notEqual(status.expectedFill, '');
      assert.notEqual(status.expectedInk, '');
    }
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    await browser.close();
  }
});
