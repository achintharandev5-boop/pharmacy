// Local-only responsive and accessibility checks. Never visits an external application.
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.LANDING_PREVIEW_URL || 'http://127.0.0.1:3107';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local preview only');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'landing-preview');
const axePath = path.join(root, 'node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core/axe.min.js');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const report = { measurements: [], accessibility: [], navigation: [], errors: [], externalRequestsBlocked: [] };
  try {
    const anonymous = await browser.newContext();
    for (const route of ['/welcome', '/admin', '/label', '/pos', '/admin/inventory', '/admin/patients']) {
      const response = await anonymous.request.get(base + route, { maxRedirects: 0 });
      assert.equal(response.status(), 307, route);
      assert.equal(new URL(response.headers().location, base).pathname, '/login');
      report.navigation.push({ route, anonymousStatus: response.status(), destination: '/login' });
    }
    const login = await anonymous.request.get(base + '/login');
    assert.equal(login.status(), 200);
    await anonymous.close();
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    // Synthetic cookie tests navigation only. No backend credential or real session is used.
    await context.addCookies([{ name: 'sb-access-token', value: 'synthetic-marketing-preview', url: base }]);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) {
        report.externalRequestsBlocked.push(url.origin);
        return route.abort();
      }
      return route.continue();
    });
    for (const [width, height] of [[375, 812], [430, 932], [768, 1024], [1024, 900], [1440, 1000], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/welcome', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => ({
        overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        headings: document.querySelectorAll('h1').length,
        font: getComputedStyle(document.querySelector('h1')).fontFamily,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }));
      assert.equal(result.overflow, 0, `Horizontal overflow at ${width}`);
      assert.equal(result.headings, 1);
      assert.match(result.font, /LandingInter/);
      assert.match(result.robots, /noindex/);
      report.measurements.push({ width, height, ...result });
      await page.screenshot({ path: path.join(out, `welcome-${width}.png`), fullPage: true, animations: 'disabled' });
      if (width === 375) {
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to content');
        const toggle = page.getByRole('button', { name: 'Open navigation' });
        await toggle.click();
        const nav = page.getByRole('navigation', { name: 'Mobile landing page navigation' });
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Features');
        await page.keyboard.press('Escape');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await toggle.click();
        await nav.getByRole('link', { name: 'Features' }).click();
        await page.waitForFunction(() => location.hash === '#features');
        assert.equal(await nav.count(), 0);
        report.navigation.push({ mobileMenu: 'PASS', keyboard: 'PASS', anchor: '#features' });
        await page.goto(base + '/welcome', { waitUntil: 'networkidle' });
      }
      if (width === 375 || width === 1440) {
        await page.addScriptTag({ path: axePath });
        const result = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
        report.accessibility.push({ width, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
      }
    }
    assert.equal(report.errors.length, 0, 'Browser runtime errors');
    assert.equal(report.accessibility.flatMap(x => x.violations).length, 0, 'Accessibility violations');
  } finally {
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
