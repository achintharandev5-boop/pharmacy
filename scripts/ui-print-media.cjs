const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = 'http://localhost:3002';
const output = path.resolve('docs/ui-modernization/print');
fs.mkdirSync(output, { recursive: true });
const sizes = { width: 70 * 96 / 25.4, height: 50 * 96 / 25.4 };

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const results = [];
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'pharmacy-ui-test', value: 'local-ui-only-v1', url: base }]);
    const page = await context.newPage();
    for (const theme of ['light', 'dark']) {
      await page.goto(`${base}/label/print-check?print=current`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.evaluate(async mode => {
        document.documentElement.dataset.themePreference = mode;
        document.documentElement.dataset.theme = mode;
        localStorage.setItem('pharmacy-theme', mode);
        await document.fonts.ready;
      }, theme);
      await page.waitForFunction(() => Boolean(window.__labelCheck?.results?.length), { timeout: 30000 });
      await page.emulateMedia({ media: 'print' });
      const measured = await page.locator('.print-only .print-label-page').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return { width: rect.width, height: rect.height, background: style.backgroundColor, color: style.color, pageBreakAfter: style.pageBreakAfter };
      }));
      assert.ok(measured.length > 0, 'print labels are present');
      for (const label of measured) {
        assert.ok(Math.abs(label.width - 70 * 96 / 25.4) < 1, `70 mm width: ${label.width}`);
        assert.ok(Math.abs(label.height - 50 * 96 / 25.4) < 1, `50 mm height: ${label.height}`);
        assert.equal(label.background, 'rgb(255, 255, 255)');
        assert.equal(label.color, 'rgb(0, 0, 0)');
      }
      const check = await page.evaluate(() => ({ ...window.__labelCheck, page: { size: getComputedStyle(document.querySelector('.print-label-page')).width } }));
      const file = path.join(output, `label-${theme}-70x50mm.png`);
      await page.locator('.print-only').screenshot({ path: file, animations: 'disabled' });
      results.push({ theme, count: measured.length, allWhiteWithBlackText: true, dimensionsMm: [70, 50], fonts: check.fonts, screenshot: path.relative(process.cwd(), file) });
      await page.emulateMedia({ media: 'screen' });
    }
    fs.writeFileSync(path.join(output, 'print-media-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
