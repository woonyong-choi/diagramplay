import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';
import { values } from '@woonyong-choi/design-tokens/tokens.js';

import { buildFigure, toHtml } from '../../src/index.js';

// #394: 같은 글 역할은 그림 크기와 관계없이 같은 화면 크기다. 넓은 화면에서는 모든 그림이 자연 크기이고, 좁은 화면에서도 가장 작은 글 토큰 밑으로 줄지 않으며 페이지는 가로로 넘치지 않는다.
const EXAMPLES = new URL('../../examples/', import.meta.url);
const SMALLEST = Math.min(...Object.values(values.text.figure));
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

test('every example shows each text role at one size on desktop and stays readable on mobile', async () => {
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
      const sizes = new Map();
      const problems = [];
      try {
        const page = await context.newPage();
        for (const { id, html } of documents) {
          await page.setContent(html);
          await page.evaluate(() => document.fonts.ready);
          const { texts, pageOverflow } = await page.evaluate(measureText);
          if (pageOverflow > 0) problems.push(`${id}: page overflows by ${pageOverflow}px`);
          for (const { role, shown } of texts) {
            if (shown < SMALLEST - SLACK) problems.push(`${id}: ${role}px text shows at ${shown.toFixed(2)}px`);
            if (!sizes.has(role)) sizes.set(role, new Map());
            const shownSizes = sizes.get(role);
            const key = shown.toFixed(1);
            if (!shownSizes.has(key)) shownSizes.set(key, id);
          }
        }
      } finally {
        await context.close();
      }
      if (width === 1280) {
        for (const [role, shownSizes] of sizes) {
          const shown = [...shownSizes.keys()].map(Number);
          if (Math.max(...shown) - Math.min(...shown) > SLACK * 2) problems.push(`${role}px role shows at ${[...shownSizes].map(([size, id]) => `${size}px (${id})`).join(', ')}`);
        }
      }
      assert.deepEqual(problems, [], `${width}px`);
    }
  } finally {
    await browser.close();
  }
});
