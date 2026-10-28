import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

import { buildFigure, toHtml } from '../../src/index.js';

// 자연 배치를 표시 폭에 맞출 때 그림 전체가 같은 배율을 따른다. 본문 표시에서는 자연 글자 크기보다 커지지 않고 같은 배율을 지키며 페이지는 가로로 넘치지 않는다.
const EXAMPLES = new URL('../../examples/', import.meta.url);
// 글 크기 반올림 여유
const SLACK = 0.05;

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch (chromeError) {
    try {
      return await chromium.launch();
    } catch {
      throw chromeError;
    }
  }
}

// 그림 안 보이는 글마다 글 역할(SVG 글 크기)과 화면 크기. 화면 크기는 글 크기에 SVG 화면 변환 배율을 곱한 값이다.
function measureText() {
  const texts = [...document.querySelectorAll('.dp-panels svg.fl text')].filter(text => text.getBoundingClientRect().height > 0);
  return {
    texts: texts.map(text => {
      const role = Number.parseFloat(getComputedStyle(text).fontSize);
      const matrix = text.getScreenCTM();
      return { role, shown: role * Math.hypot(matrix.a, matrix.b) };
    }),
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

test('every example scales text uniformly within the natural figure and fits narrow viewports', async () => {
  const ids = (await readdir(EXAMPLES)).filter(name => name.endsWith('.diagramplay')).map(name => name.replace(/\.diagramplay$/, '')).sort();
  const documents = [];
  for (const id of ids) {
    const built = await buildFigure(await readFile(new URL(`${id}.diagramplay`, EXAMPLES), 'utf8'), { baseDir: fileURLToPath(EXAMPLES), strict: true });
    documents.push({ id, html: await toHtml(built, id) });
  }
  const browser = await launchBrowser();
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const problems = [];
      try {
        const page = await context.newPage();
        for (const { id, html } of documents) {
          await page.setContent(html);
          await page.evaluate(() => document.fonts.ready);
          const { texts, pageOverflow } = await page.evaluate(measureText);
          if (pageOverflow > 0) problems.push(`${id}: page overflows by ${pageOverflow}px`);
          const frame = await page.locator('.fl-figure').boundingBox();
          const panels = await page.locator('.dp-panels').evaluate(element => Number.parseFloat(getComputedStyle(element).getPropertyValue('--view-w')));
          if (frame.width > panels + SLACK) problems.push(`${id}: the frame exceeds the natural drawing width`);
          const scales = texts.map(({ role, shown }) => shown / role);
          if (Math.max(...scales) - Math.min(...scales) > SLACK) problems.push(`${id}: text roles use different scales`);
          for (const { role, shown } of texts) {
            if (shown > role + SLACK) problems.push(`${id}: ${role}px text exceeds its natural size`);
            if (shown <= 0) problems.push(`${id}: text has no display size`);

          }
        }
      } finally {
        await context.close();
      }
      assert.deepEqual(problems, [], `${width}px`);
    }
  } finally {
    await browser.close();
  }
});

test('sequence_ranges_share_group_typography_and_boundaries_without_button_surfaces', async () => {
  const graph = await buildFigure('diagramplay\ngroup domain "주문 도메인" {\n box a "A"\n box b "B"\n}\na -> b\nscene "구조"\n', { strict: true });
  const sequence = await buildFigure(await readFile(new URL('sequence.diagramplay', EXAMPLES), 'utf8'), { strict: true });
  const browser = await launchBrowser();
  const titleStyle = element => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, ink: style.fill };
  };
  try {
    for (const colorScheme of ['light', 'dark']) {
      let page = await browser.newPage({ colorScheme, reducedMotion: 'reduce' });
      try {
        await page.setContent(await toHtml(graph));
        await page.evaluate(() => document.fonts.ready);
        const groupTitle = await page.locator('.fl-group .frame').first().evaluate(titleStyle);
        const groupLine = await page.locator('.frame-box').first().evaluate(element => ({ stroke: getComputedStyle(element).stroke, width: getComputedStyle(element).strokeWidth }));
        await page.close();
        page = await browser.newPage({ colorScheme, reducedMotion: 'reduce' });
        await page.setContent(await toHtml(sequence));
        await page.evaluate(() => document.fonts.ready);
        for (const selector of ['.dp-theme button', '.fl-foot button']) {
          assert.equal(await page.locator(selector).first().evaluate(element => getComputedStyle(element).fontFamily), groupTitle.family, 'controls and diagram prose use the same embedded family');
        }
        assert.deepEqual(await page.locator('.fl-fragment-title .frame').first().evaluate(titleStyle), groupTitle);
        assert.deepEqual(await page.locator('.fl-fragment-border').first().evaluate(element => ({ stroke: getComputedStyle(element).stroke, width: getComputedStyle(element).strokeWidth })), groupLine);
        const surface = await page.locator('.fl-canvas').evaluate(element => getComputedStyle(element).backgroundColor);
        assert.equal(await page.locator('.fl-fragment-heading').first().evaluate(element => getComputedStyle(element).fill), surface, 'the title masks a lifeline with the canvas, without a white button face');
        const frames = sequence.scene.fragments.filter(frame => frame.si === 0 && frame.depth === 0).sort((a, b) => a.y - b.y);
        assert.ok(frames.length > 1);
        for (let index = 1; index < frames.length; index++) assert.ok(frames[index].y > frames[index - 1].y + frames[index - 1].h, 'independent control ranges have breathing room');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
