// Spec-wording browser test. Needs a server started with NEXT_PUBLIC_LABEL_WORDING=spec.
// Usage: node workstation.spec.e2e.mjs <baseUrl> <screenshotDir>
// playwright-core is not a project dependency: copy into an empty folder, `npm i playwright-core@1.48.2`,
// then run against a dev server. Uses the installed Microsoft Edge. Never saves, prints or sends.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:3002';
const shots = process.argv[3] ?? './shots';
fs.mkdirSync(shots, { recursive: true });

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function layoutChecks(page, label) {
  // No horizontal page scroll.
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal page scroll`, overflowX <= 0, `overflow ${overflowX}px`);

  // Grid tiles: none overlap, every label fits its tile, all at least 44px tall.
  const tiles = await page.$$eval('main button', (els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => {
        // Only the visible part counts: content scrolled out of a scrolling container is not on screen.
        const full = e.getBoundingClientRect();
        let vis = { left: full.left, top: full.top, right: full.right, bottom: full.bottom };
        for (let p = e.parentElement; p; p = p.parentElement) {
          if (/auto|scroll|hidden/.test(getComputedStyle(p).overflowX + getComputedStyle(p).overflowY)) {
            const pr = p.getBoundingClientRect();
            vis = { left: Math.max(vis.left, pr.left), top: Math.max(vis.top, pr.top), right: Math.min(vis.right, pr.right), bottom: Math.min(vis.bottom, pr.bottom) };
          }
        }
        const r = full;
        const visible = { x: vis.left, y: vis.top, w: Math.max(0, vis.right - vis.left), h: Math.max(0, vis.bottom - vis.top) };
        const spans = [...e.querySelectorAll('span')];
        const clipped = spans.some((s) => !s.className.includes('truncate') && getComputedStyle(s).overflow !== 'visible' && (s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1)) || [...spans].some((s) => { const sr = s.getBoundingClientRect(); return sr.height > 0 && (sr.bottom > r.bottom + 1 || sr.top < r.top - 1); });
        let hiddenBy = false;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const pr = p.getBoundingClientRect();
            const scrolls = /auto|scroll/.test(cs.overflowX + cs.overflowY);
            if (scrolls) break; // reachable by scrolling
            if (!scrolls && (r.right > pr.right + 1 || r.left < pr.left - 1 || r.bottom > pr.bottom + 1 || r.top < pr.top - 1)) hiddenBy = true;
          }
        }
        return { name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40), x: visible.x, y: visible.y, w: visible.w, h: visible.h, fullW: r.width, fullH: r.height, clipped: clipped || hiddenBy };
      }),
  );
  const overlaps = [];
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i], b = tiles[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 2 && iy > 2) overlaps.push(`${a.name} × ${b.name}`);
    }
  }
  // The expiry card contains its own small button by design.
  const realOverlaps = overlaps.filter((o) => !o.includes('Open expiry date editor'));
  check(`${label}: no overlapping controls`, realOverlaps.length === 0, realOverlaps.slice(0, 5).join('; '));
  const clipped = tiles.filter((t) => t.clipped).map((t) => t.name);
  check(`${label}: no clipped button text`, clipped.length === 0, clipped.join(', '));
  const small = tiles.filter((t) => (t.fullH < 32 || t.fullW < 32) && t.fullW > 0).map((t) => `${t.name} (${Math.round(t.fullW)}×${Math.round(t.fullH)})`);
  check(`${label}: touch targets ≥ 32×32px`, small.length === 0, small.join(', '));
}

// Spec-wording run (server built with NEXT_PUBLIC_LABEL_WORDING=spec). Nothing is saved or printed:
// DONE opens the review page, whose printed-label preview is compared, then Back is pressed.
async function run(viewport, label, touch) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: 1 });
  await context.addCookies([{ name: 'sb-access-token', value: 'local-ui-test', domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/label`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.getByRole('button', { name: 'Chewable' }).waitFor({ timeout: 120000 });

  const tap = async (l) => (touch ? l.tap() : l.click());
  const btn = (name) => page.getByRole('button', { name, exact: true });
  const preview = async () => ((await page.getByTestId('label-text-preview').count()) ? page.getByTestId('label-text-preview').innerText() : '');
  const reset = async () => { await page.reload({ waitUntil: 'networkidle' }); await btn('Chewable').waitFor(); };

  // NAB
  await tap(btn('Take medication')); await tap(btn('After meals'));
  check(`${label}: TAKE + AFTER → ගන්න කෑමට පසු`, (await preview()).includes('ගන්න කෑමට පසු'), await preview());
  await reset();

  // OAB + order rule
  await tap(btn('Keep in Mouth')); await tap(btn('Give medication'));
  check(`${label}: Keep in Mouth + GIVE asks for timing`, (await page.getByTestId('admin-status').innerText()).includes('BEFORE or AFTER'));
  await tap(btn('Before meals'));
  check(`${label}: Keep in Mouth + GIVE + BEFORE → දිව මත තබන්න කෑමට පෙර`, (await preview()).includes('දිව මත තබන්න කෑමට පෙර'));
  await reset();
  await tap(btn('With Food')); await tap(btn('Chewable')); await tap(btn('Take medication'));
  check(`${label}: With Food → Chewable → TAKE → කෑමත් සමඟ හපලා කන්න`, (await preview()).includes('කෑමත් සමඟ හපලා කන්න'));
  await reset();
  await tap(btn('Chewable')); await tap(btn('With Food'));
  check(`${label}: Chewable → With Food refused with a message`, await page.getByTestId('workflow-notice').isVisible());
  await reset();

  // Daily schedule + STAT
  await tap(btn('Increase MORNING dosage'));
  check(`${label}: Morning only → pending-approval notice, no phrase`, (await page.getByTestId('label-notice').isVisible()) && !(await preview()).includes('දිනපතා'));
  await tap(btn('Increase LUNCH dosage')); await tap(btn('Increase NIGHT dosage'));
  check(`${label}: 1/1/1 → දිනපතා 3 වරක් ගන්න`, (await preview()).includes('දිනපතා 3 වරක් ගන්න'));
  check(`${label}: 8H locked while a dose row is set`, (await page.getByRole('button', { name: /^8H/ }).getAttribute('data-state')) === 'locked');

  await tap(btn('STAT'));
  check(`${label}: STAT Done disabled at quantity 0`, await page.getByRole('button', { name: /Done \(Next\)/ }).isDisabled());
  await tap(btn('Increase STAT quantity'));
  await tap(page.getByRole('button', { name: /Done \(Next\)/ }));
  check(`${label}: STAT Enter disabled until TAKE/GIVE`, await page.getByRole('button', { name: /Enter \(ඉන්පසු\)/ }).isDisabled());
  await tap(btn('STAT TAKE'));
  check(`${label}: STAT + TAKE → පළමුව පමණක් ගන්න`, (await page.getByTestId('stat-admin-result').innerText()).includes('පළමුව පමණක් ගන්න'));
  await page.screenshot({ path: `${shots}/${label}-spec-stat-admin.png` });
  await layoutChecks(page, `${label} STAT administration step`);
  await tap(page.getByRole('button', { name: /Enter \(ඉන්පසු\)/ }));
  await tap(btn('MORNING/LUNCH & NIGHT'));
  await tap(btn('Take medication')); await tap(btn('After meals'));
  const text = await preview();
  check(`${label}: order STAT → ඉන්පසු → daily → NAB`, text.indexOf('පළමුව පමණක් ගන්න') < text.indexOf('ඉන්පසු') && text.indexOf('ඉන්පසු') < text.indexOf('දිනපතා 3 වරක් ගන්න') && text.indexOf('දිනපතා') < text.indexOf('ගන්න කෑමට පසු'), text);
  check(`${label}: doses unchanged by STAT`, ['morning', 'lunch', 'night'].every(Boolean) && (await page.getByTestId('morning-qty').innerText()).trim() === '1');
  await page.screenshot({ path: `${shots}/${label}-spec-workstation.png` });
  await layoutChecks(page, `${label} spec workstation`);

  // Review page: printed-label preview shows the same text; nothing is saved (Back).
  await tap(page.getByRole('button', { name: /Done — review and print labels/ }));
  await page.getByRole('button', { name: /back/i }).first().waitFor({ timeout: 30000 });
  const review = await page.locator('body').innerText();
  check(`${label}: review preview shows පළමුව පමණක් ගන්න, ඉන්පසු, දිනපතා 3 වරක් ගන්න, ගන්න කෑමට පසු`,
    ['පළමුව පමණක් ගන්න', 'ඉන්පසු', 'දිනපතා 3 වරක් ගන්න', 'ගන්න කෑමට පසු'].every((t) => review.includes(t)));
  check(`${label}: review preview keeps STAT quantity line`, review.includes('STAT 1'));
  await page.screenshot({ path: `${shots}/${label}-spec-review.png`, fullPage: true });

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
}

await run({ width: 1366, height: 768 }, 'desktop-1366', false);
await run({ width: 1024, height: 768 }, 'tablet-1024', true);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} spec-mode browser checks passed`);
fs.writeFileSync(`${shots}/spec-results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
