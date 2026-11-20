const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const base = 'http://localhost:3002';
const viewports = [[390, 844], [768, 1024], [1024, 768], [1366, 768], [1440, 900], [1920, 1080]];

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const results = [];
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'pharmacy-ui-test', value: 'local-ui-only-v1', url: base }]);
    const page = await context.newPage();
    await page.goto(`${base}/label`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      const controls = await page.locator('button[aria-label^="Increase "], button[aria-label^="Decrease "], button[aria-label*="fraction:"]').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { label: node.getAttribute('aria-label'), width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 };
      }).filter(node => node.height > 0));
      assert.ok(controls.length >= 6, `Dosage controls rendered at ${width}x${height}`);
      for (const control of controls) {
        assert.ok(control.width >= 44, `${control.label} width ${control.width}px at ${width}x${height}`);
        assert.ok(control.height >= 44, `${control.label} height ${control.height}px at ${width}x${height}`);
      }
      results.push({ width, height, controls: controls.length, minTargetPx: Math.min(...controls.map(c => Math.min(c.width, c.height))), maxTargetPx: Math.max(...controls.map(c => Math.max(c.width, c.height))) });
    }
    const output = path.resolve('docs/ui-modernization/label/workstation-control-sizes.json');
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
