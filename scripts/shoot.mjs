/** 사용: node scripts/shoot.mjs <html|svg> <png> [대기 ms] [--dark] [--width 1400] [--click 선택자] */
import { resolve } from 'node:path';

import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [input, output, waitArg] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.match(/^--(width|click)$/));
const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const width = process.argv.includes('--width') ? Number(option('--width')) : 1400;

const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: process.argv.includes('--dark') ? 'dark' : 'light' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(/^https?:/.test(input) ? input : `file://${resolve(input)}`);
  await page.evaluate(() => document.fonts.ready);
  if (process.argv.includes('--click')) await page.click(option('--click'));
  await page.waitForTimeout(Number(waitArg ?? 800));
  const size = await page.evaluate(({ width, hasWidth }) => {
    const root = document.documentElement;
    if (!(root instanceof SVGSVGElement)) return { width, height: root.scrollHeight };
    const lengths = ['width', 'height'].map((name) => {
      const length = root[name].baseVal;
      const isAbsolute = length.unitType === SVGLength.SVG_LENGTHTYPE_NUMBER || length.unitType >= SVGLength.SVG_LENGTHTYPE_PX;
      return root.hasAttribute(name) && isAbsolute && length.value > 0 ? length.value : 0;
    });
    const viewBox = root.viewBox.baseVal;
    const hasViewBox = viewBox.width > 0 && viewBox.height > 0;
    const svgWidth = lengths[0] || (hasWidth ? width : viewBox.width) || width;
    const svgHeight = lengths[1] || (hasViewBox ? svgWidth * viewBox.height / viewBox.width : root.getBoundingClientRect().height);
    return { width: svgWidth, height: svgHeight };
  }, { width, hasWidth: process.argv.includes('--width') });
  await page.setViewportSize({ width: Math.ceil(size.width), height: Math.ceil(Math.max(200, Math.min(size.height, 4000))) });
  await page.screenshot({ path: output });
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
}
