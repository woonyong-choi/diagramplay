import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { chromium } from 'playwright-core';

import { COMPARISON_EXAMPLES } from '../../scripts/lib/comparison-examples.mjs';
import { buildFigure, toHtml } from '../../src/index.js';

test('structural_examples_keep_relations_visible_and_queue_slots_borderless_through_scene_changes', async () => {
  const examples = [...COMPARISON_EXAMPLES.filter(example => example.id !== 'sequence'), { id: 'queue', source: await readFile(new URL('../../examples/queue.diagramplay', import.meta.url), 'utf8') }];
  const documents = [];
  for (const example of examples) documents.push({ id: example.id, html: await toHtml(await buildFigure(example.source, { strict: true })) });
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const colorScheme of ['light', 'dark']) for (const { id, html } of documents) {
      const page = await browser.newPage({ colorScheme });
      try {
        await page.clock.install();
        await page.setContent(html);
        await page.evaluate(() => document.fonts.ready);
        const tabs = page.getByRole('tab');
        const count = await tabs.count();
        for (let scene = 0; scene < count; scene++) {
          await tabs.nth(scene).click();
          for (const elapsed of [220, 1400]) {
            await page.clock.runFor(elapsed);
            const hidden = await page.locator('.fl-edge .fl-path').evaluateAll(paths => paths.flatMap(path => {
              let opacity = 1;
              for (let element = path; element; element = element.parentElement) {
                const style = getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden') return [path.id];
                opacity *= Number(style.opacity);
              }
              return opacity === 0 || getComputedStyle(path).stroke === 'none' ? [path.id] : [];
            }));
            assert.deepEqual(hidden, [], `${id}/${colorScheme}/scene ${scene}: structural relations stay visible`);
            const slots = await page.locator('.fl-queue-slot').evaluateAll(elements => elements.map(element => ({ stroke: getComputedStyle(element).stroke, fill: getComputedStyle(element).fill })));
            for (const slot of slots) {
              assert.equal(slot.stroke, 'none', `${id}: queue slots use fill without outlines`);
              assert.notEqual(slot.fill, 'none');
            }
          }
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
