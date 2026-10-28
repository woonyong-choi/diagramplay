import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

import { buildFigure, toHtml } from '../../src/index.js';
import { bindDiagramHost } from '@woonyong-choi/design-tokens/ui/runtime/diagram-host.js';

// 가장 작은 글 토큰과, 그림의 가장 작은 글 역할이 그 크기가 되는 배율(design-tokens player.css의 하한)

// 설치된 Chrome을 먼저 쓰고, 없으면 Playwright가 내려받은 Chromium으로 같은 검사를 돈다. 둘 다 없으면 첫 오류를 알린다.
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

// #272, #394: 실제 CSS·SVG와 홈페이지가 쓰는 iframe 호스트 계약을 함께 확인한다. 판은 자연 크기를 상한으로 가용 폭에 맞춰 줄고 가로로 넘치지 않는다.
test('HTML figures fit available width in standalone and embedded views without horizontal scrolling', async () => {
  const documents = new Map();
  for (const id of ['architecture', 'sequence', 'authentication/commerce-system']) {
    const source = new URL(`../../examples/${id}.diagramplay`, import.meta.url);
    const built = await buildFigure(await readFile(source, 'utf8'), { baseDir: fileURLToPath(new URL('.', source)) });
    documents.set(`/${id}`, await toHtml(built, id));
    documents.set(`/embed-${id}`, `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{display:block;width:100%;border:0}</style></head><body><iframe data-diagram src="/${id}" title="그림" allow="fullscreen" allowfullscreen></iframe><script>(${bindDiagramHost.toString()})();</script></body></html>`);
  }
  const server = createServer((request, response) => {
    const body = documents.get(request.url);
    response.writeHead(body ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(body ?? 'not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await launchBrowser();
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [320, 390, 430, 1440]) for (const embedded of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        for (const id of ['architecture', 'sequence', 'authentication/commerce-system']) {
          await page.goto(`${origin}/${embedded ? 'embed-' : ''}${id}`);
          const frame = embedded ? page.frames().find(frame => frame !== page.mainFrame()) : page.mainFrame();
          await frame.evaluate(() => document.fonts.ready);
          if (id === 'architecture') {
            const initial = await frame.evaluate(() => {
              const canvas = document.querySelector('.fl-canvas').getBoundingClientRect();
              const first = document.querySelector('.fl-canvas .fl-node[data-id="user"]').getBoundingClientRect();
              return { startVisible: first.left >= canvas.left && first.right <= canvas.right };
            });
            assert(initial.startVisible, 'the first architecture card is complete inside the frame');
          }
          const tabs = frame.getByRole('tab');
          for (let scene = 0; scene < await tabs.count(); scene++) {
            await tabs.nth(scene).click();
            const current = await frame.evaluate(measure);
            assert(current.scale <= 1 + 1e-3, `${id}: figure grows beyond its natural size`);
            assert(current.scale > 0, `${id}: figure has a positive display scale`);
            assert.equal(current.overflow, false, `${id}: normal view must not scroll horizontally`);
            assert.equal(current.canvasHeight, current.contentHeight, `${id}: canvas clips vertically`);
            assert(current.pageWidth <= width, `${id}: document overflows horizontally`);
          }
          await tabs.first().focus();
          await tabs.first().press('ArrowRight');
          assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true', 'arrows on tabs still select scenes');
          if (embedded) await checkEmbedHeight(page, frame);
          if (width === 390) await checkFullscreen(frame);
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('administrator illustrations accompany visible role labels in the shipped examples', async () => {
  const documents = [];
  for (const [path, label] of [
    ['examples/queue.diagramplay', '운영자'],
    ['test/browser/fixtures/cloud-architecture-ko.diagramplay', '운영자'],
    ['test/browser/fixtures/cloud-architecture-en.diagramplay', 'Operator'],
  ]) {
    const source = new URL(`../../${path}`, import.meta.url);
    const built = await buildFigure(await readFile(source, 'utf8'), { baseDir: fileURLToPath(new URL('.', source)), strict: true });
    documents.push({ path, label, html: await toHtml(built, path) });
  }
  const browser = await launchBrowser();
  try {
    for (const colorScheme of ['light', 'dark']) for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      try {
        const errors = [];
        for (const document of documents) {
          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          await page.setContent(document.html);
          await page.evaluate(() => window.document.fonts.ready);
          const label = page.locator('.fl-canvas .fl-node[data-id="admin"] text.label').first();
          assert.equal(await label.textContent(), document.label, `${document.path}: role is explicit`);
          assert(await label.isVisible(), `${document.path}: role label is visible at ${width}px in ${colorScheme}`);
          await page.close();
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
});

function measure() {
  const canvas = document.querySelector('.fl-canvas');
  const panels = canvas.querySelector('.dp-panels');
  const texts = [...panels.querySelectorAll('text')].filter(text => text.getBoundingClientRect().height > 0);
  const sizes = texts.map(text => {
    const matrix = text.getScreenCTM();
    return parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b);
  });
  const svgs = [...panels.querySelectorAll('svg.fl')];
  const widest = svgs.reduce((a, b) => (b.viewBox.baseVal.width > a.viewBox.baseVal.width ? b : a));
  return {
    minTextSize: Math.min(...sizes),
    naturalWidth: widest.viewBox.baseVal.width,
    scale: widest.getBoundingClientRect().width / widest.viewBox.baseVal.width,
    panelWidth: panels.getBoundingClientRect().width,
    canvasWidth: canvas.clientWidth,
    canvasHeight: canvas.clientHeight,
    contentHeight: canvas.scrollHeight,
    pageWidth: document.documentElement.scrollWidth,
    overflow: canvas.scrollWidth > canvas.clientWidth,
    scene: document.querySelector('[role=tab][aria-selected=true]')?.textContent,
  };
}

async function checkEmbedHeight(page, frame) {
  await page.waitForFunction(() => {
    const iframe = document.querySelector('iframe');
    return Math.abs(iframe.height - iframe.contentDocument.body.getBoundingClientRect().height) <= 1;
  });
  const before = await frame.evaluate(measure);
  await page.locator('iframe').evaluate(node => { node.style.width = '260px'; });
  await frame.waitForFunction(() => document.querySelector('.fl-figure').clientWidth === 260);
  const after = await frame.evaluate(measure);
  assert.equal(after.scene, before.scene);
  assert.equal(after.overflow, false, 'a narrowed embed fits the complete graph');
  assert(after.pageWidth <= 260, 'a narrowed embed scrolls inside the figure, not the page');
  await page.locator('iframe').evaluate(node => { node.style.width = ''; });
}

async function checkFullscreen(frame) {
  const before = await frame.evaluate(measure);
  const trigger = frame.getByRole('button', { name: '전체화면', exact: true });
  await trigger.click();
  await frame.waitForFunction(() => document.querySelector('.fl-figure.full'));
  const fit = await frame.evaluate(measure);
  for (let index = 0; index < 16; index++) await frame.getByRole('button', { name: '확대', exact: true }).click();
  const zoomed = await frame.evaluate(measure);
  assert(zoomed.panelWidth > fit.panelWidth, 'fullscreen zoom changes the rendered width');
  assert(zoomed.panelWidth > before.panelWidth, 'the embedded width does not cap fullscreen zoom');
  assert.equal(zoomed.scene, before.scene);
  await frame.getByRole('button', { name: '전체 보기', exact: true }).click();
  await frame.getByRole('button', { name: '전체화면 종료', exact: true }).click();
  await frame.waitForFunction(() => !document.querySelector('.fl-figure.full'));
  const restored = await frame.evaluate(measure);
  assert.equal(restored.minTextSize, before.minTextSize);
  assert.equal(restored.scene, before.scene);
  assert(await trigger.evaluate(node => node === document.activeElement));
}
