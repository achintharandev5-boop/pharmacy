/* Local UI-test mode only. Never signs in to an API or loads patient data. */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const stage = process.argv[2] || 'baseline';
const base = process.argv[3] || 'http://localhost:3002';
const out = path.resolve('docs/ui-modernization', stage);
const routes = ['/login', '/', '/admin', '/label', '/pos', '/admin/patients', '/admin/prescriptions', '/admin/products', '/admin/inventory', '/admin/analytics', '/admin/settings', '/admin/audit-log'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const context = await browser.newContext();
    // Existing explicitly isolated development mechanism; no production auth bypass.
    await context.addCookies([{ name: 'pharmacy-ui-test', value: 'local-ui-only-v1', url: base }]);
    const page = await context.newPage();
    await page.goto(base + '/login');
    assert.ok(await page.locator('[data-ui-test-banner]').count(), 'Refusing browser audit outside database-free UI-test mode');
    const results = [];
    for (const theme of stage === 'baseline' ? ['light'] : ['light', 'dark']) {
      await page.addInitScript((value) => localStorage.setItem('pharmacy-theme', value), theme);
      for (const [width, height] of stage === 'baseline' ? [[1440, 900]] : [[390,844],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]) {
        await page.setViewportSize({ width, height });
        for (const route of routes) {
          await page.goto(base + route, { waitUntil: 'networkidle', timeout: 120000 });
          const name = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
          await page.screenshot({ path: path.join(out, `${name}-${theme}-${width}.png`), fullPage: true });
          results.push({ route, theme, width, height, ...await page.evaluate(() => ({
            overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            headings: [...document.querySelectorAll('h1')].map(e => e.textContent),
            resolvedTheme: document.documentElement.dataset.theme || 'light',
          })) });
        }
      }
    }
    fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ screenshots: results.length, overflow: results.filter(r => r.overflow > 0) }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
