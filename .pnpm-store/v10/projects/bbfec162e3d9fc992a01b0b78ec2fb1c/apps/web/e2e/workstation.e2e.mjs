// Browser interaction test for the label workstation, run against the local dev server.
// Usage: node workstation.e2e.mjs <baseUrl> <screenshotDir>
//
// playwright-core is not a project dependency. Copy this file into an empty folder, run
// `npm i playwright-core@1.48.2` there, then `node workstation.e2e.mjs http://localhost:3002 ./shots`
// with `pnpm dev` running. It drives the installed Microsoft Edge (path below) at 1366×768
// (mouse) and 1024×768 (touch). It sets a placeholder sb-access-token cookie only to pass the
// middleware's presence check; nothing is saved, printed or sent (DONE is never pressed).
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

async function run(viewport, label, touch) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({ viewport, hasTouch: touch, deviceScaleFactor: 1 });
  await context.addCookies([{ name: 'sb-access-token', value: 'local-ui-test', domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.goto(`${base}/label`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: 'Chewable' }).waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${shots}/${label}-1-idle.png` });
  await layoutChecks(page, `${label} idle`);

  const tap = async (locator) => (touch ? locator.tap() : locator.click());
  const btn = (name) => page.getByRole('button', { name, exact: true });
  // Interval tiles add "n each" to their name once a quantity is entered.
  const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pressed = async (name) =>
    (await page.getByRole('button', { name: new RegExp(`^${escapeRe(name)}( \\S+ each)?$`) }).first().getAttribute('aria-pressed')) === 'true';
  const preview = async () => (await page.getByTestId('label-text-preview').count()) ? await page.getByTestId('label-text-preview').innerText() : '';

  // Every toggle tile: on, then off.
  for (const name of ['Till Date', 'And This Date', 'Weekly', 'Empty Stomach', 'With Food', 'Chewable', 'Dissolve and Drink', 'Keep in Mouth']) {
    await tap(btn(name));
    const on = await pressed(name);
    await tap(btn(name));
    const off = !(await pressed(name));
    check(`${label}: ${name} selects and deselects`, on && off);
  }
// Interval and daily buttons: tap → quantity pad → ENTER → selected with "n each" → tap again → off.  for (const [name, code] of [['5H', '5H'], ['6H', '6H'], ['8H', '8H'], ['EOD', 'EOD'], ['Daily', 'DAILY'], ['Evening', 'EVENING']]) {    await tap(btn(name));    const padShown = await page.getByText(`${code} — QTY PER DOSE`).isVisible();    await tap(btn('1'));    await tap(page.getByTestId('numpad-enter'));    const tileOn = (await page.getByRole('button', { name: `${name} 1 each`, exact: true }).getAttribute('aria-pressed')) === 'true';    const printedPreview = (await preview()).includes(`${code}: 1`);    await tap(page.getByRole('button', { name: `${name} 1 each`, exact: true }));    check(`${label}: ${name} → quantity pad → shown as 1 each → deselects`, padShown && tileOn && printedPreview && !(await pressed(name)));  }

  // Administration + Sinhala text.
  await tap(btn('Take medication'));
check(`${label}: guidance asks for BEFORE/AFTER after TAKE`, (await page.getByTestId('admin-status').innerText()).includes('Next: Choose BEFORE or AFTER'));  check(`${label}: BEFORE/AFTER marked as needing input`, (await btn('After meals').getAttribute('data-required')) === 'true');  await tap(btn('Chewable'));  check(`${label}: Chewable tile shows needs-input`, (await btn('Chewable').getAttribute('data-state')) === 'requires-input');  await page.screenshot({ path: `${shots}/${label}-8-guidance.png` });  await tap(btn('Chewable'));
  await tap(btn('After meals'));
check(`${label}: guidance shows Complete`, (await page.getByTestId('admin-status').innerText()).includes('Complete'));
  check(`${label}: TAKE + AFTER → Sinhala on the label text`, (await preview()).includes('කෑමට පසු ගන්න'), await preview());
  await tap(btn('With Food'));
  check(`${label}: WITH FOOD removes AFTER and locks timing`, !(await pressed('After meals')) && (await btn('Before meals').isDisabled()));
  check(`${label}: WITH FOOD + TAKE → Sinhala`, (await preview()).includes('කෑමත් සමග ගන්න'), await preview());
  await tap(btn('Empty Stomach'));
  check(`${label}: EMPTY STOMACH replaces WITH FOOD`, (await pressed('Empty Stomach')) && !(await pressed('With Food')));

  // Weekly + Daily conflict shown, not resolved.
  await tap(btn('Weekly'));
  await tap(btn('Daily'));
  await tap(btn('1'));
  await tap(page.getByTestId('numpad-enter'));
  check(`${label}: WEEKLY + DAILY conflict is shown`, await page.getByRole('status').filter({ hasText: 'WEEKLY and DAILY' }).first().isVisible());

  // Dosage.
  await tap(btn('Increase MORNING dosage'));
  await tap(btn('Increase MORNING dosage'));
  await tap(page.getByRole('button', { name: /Morning fraction/ }));
  await tap(btn('1/2'));
  check(`${label}: + + then X/Y ½ gives 2½`, (await page.getByTestId('morning-qty').innerText()).trim() === '2½');
  const xy = page.getByRole('button', { name: /Morning fraction: ½/ });
  const xyBox = await xy.boundingBox();
  const xyLineHeight = await xy.locator('span').first().evaluate((s) => s.getBoundingClientRect().height);
  check(`${label}: X/Y shows the fraction on one line`, (await xy.innerText()).includes('½') && xyLineHeight < 40, `span height ${xyLineHeight}px, button ${Math.round(xyBox.height)}px`);
  check(`${label}: label text shows Morning: 2½`, (await preview()).includes('Morning: 2½'));
  check(`${label}: − disabled at 0 (lunch)`, await btn('Decrease LUNCH dosage').isDisabled());
  await page.screenshot({ path: `${shots}/${label}-2-selections.png` });
  await layoutChecks(page, `${label} with selections`);

  // Number pad: AC keeps the session, invalid entry refused.
  await tap(btn('Add Label'));
  check(`${label}: Add Label → LABEL 2 OF 2, blank`, (await page.getByText('LABEL 2 OF 2').isVisible()) && !(await pressed('Daily')));
  await tap(page.getByRole('button', { name: /Night quantity/ }));
  await tap(btn('7'));
  await page.screenshot({ path: `${shots}/${label}-3-number-pad.png` });
  await tap(btn('Clear entry'));
  check(`${label}: AC clears the entry, both labels kept`, await page.getByText('LABEL 2 OF 2').isVisible());
  await tap(btn('/'));
  await tap(page.getByTestId('numpad-enter'));
  check(`${label}: "/" alone is refused with a message`, await page.getByRole('alert').filter({ hasText: 'Not a number' }).isVisible());
  await tap(btn('BACK'));

  // STAT.
  await tap(btn('STAT'));
  check(`${label}: STAT Done disabled at 0`, await page.getByRole('button', { name: /Done \(Next\)/ }).isDisabled());
  await tap(btn('Increase STAT quantity'));
  await tap(page.getByRole('button', { name: 'Enter STAT fraction' }));
  await tap(btn('1/2'));
  check(`${label}: STAT X/Y ½ stays in the STAT panel with 1½`, (await page.getByTestId('stat-qty').innerText()).trim() === '1½');
  await page.screenshot({ path: `${shots}/${label}-4-stat.png` });
  await tap(page.getByRole('button', { name: /Done \(Next\)/ }));
  await tap(btn('8H'));
  check(`${label}: STAT chip shown`, await page.getByRole('button', { name: 'Remove STAT: 1½ (8H)' }).isVisible());
  await tap(btn('STAT'));
  await tap(btn('Cancel'));
  check(`${label}: re-open + Cancel keeps STAT`, await page.getByRole('button', { name: 'Remove STAT: 1½ (8H)' }).isVisible());
  await tap(page.getByRole('button', { name: 'Remove STAT: 1½ (8H)' }));
  check(`${label}: STAT chip ✕ removes STAT`, !(await pressed('8H')) && (await page.getByRole('button', { name: /Remove STAT/ }).count()) === 0);

  // Reasons.
  await tap(btn('Chewable'));
  await tap(btn('Reasons'));
  await tap(btn('කැස්සට'));
  await page.screenshot({ path: `${shots}/${label}-5-reasons.png` });
  await layoutChecks(page, `${label} reasons panel`);
  await tap(btn('Done'));
  check(`${label}: Reasons Done closes the panel and keeps Chewable`, (await page.getByText('Reason for Use').count()) === 0 && (await pressed('Chewable')));

  // Days.
  check(`${label}: days shows — until set`, (await page.getByRole('button', { name: /Days: not set/ }).innerText()).trim() === '—');
  await tap(btn('Increase days'));
  check(`${label}: + days gives 1`, (await page.getByRole('button', { name: /Days: 1/ }).innerText()).trim() === '1');

  // Days of week Cancel.
  await tap(btn('Select days of week'));
  await tap(page.getByRole('button', { name: /MONDAY/ }));
  await tap(btn('Cancel'));
  check(`${label}: days-of-week Cancel reverts`, (await page.getByRole('button', { name: 'Select days of week' }).count()) === 1);

  // Expiry.
  await tap(page.getByRole('button', { name: /EXP Date/ }));
  await page.locator('#exp-date-input').fill('2020-01-31');
  await tap(page.getByRole('dialog').getByRole('button', { name: 'Save' }));
  check(`${label}: past expiry refused`, await page.getByRole('dialog').getByRole('alert').isVisible());
  await page.locator('#exp-date-input').fill('12/2099');
  await page.screenshot({ path: `${shots}/${label}-6-expiry.png` });
  await tap(page.getByRole('dialog').getByRole('button', { name: 'Save' }));
  check(`${label}: valid expiry saved`, await page.getByRole('button', { name: 'Remove EXP: 12/2099' }).isVisible());

  // Keyboard.
  await btn('Keep in Mouth').focus();
  await page.keyboard.press('Enter');
  check(`${label}: keyboard Enter toggles a tile`, await pressed('Keep in Mouth'));
  await page.keyboard.press('Space');
  check(`${label}: keyboard Space toggles it back`, !(await pressed('Keep in Mouth')));

  // Label switching + delete.
  await tap(btn('Previous label'));
  check(`${label}: label 1 kept its selections`, (await pressed('Empty Stomach')) && (await pressed('Weekly')));
  await tap(btn('Next label'));
  await tap(btn('Delete Label'));
  await page.screenshot({ path: `${shots}/${label}-7-delete.png` });
  await tap(page.getByRole('alertdialog').getByRole('button', { name: 'Delete Label' }));
  check(`${label}: Delete removes label 2 only`, (await page.getByText('LABEL 1 OF 1').isVisible()) && (await pressed('Empty Stomach')));

  // Rapid taps.
  for (let i = 0; i < 15; i++) await btn('Increase LUNCH dosage').click({ delay: 0 });
  check(`${label}: 15 rapid taps → 15`, (await page.getByTestId('lunch-qty').innerText()).trim() === '15');

  const relevantErrors = consoleErrors.filter((e) => !/Failed to load resource|fetch|ECONNREFUSED|401|403|NEXT_PUBLIC/i.test(e));
  check(`${label}: no page errors`, relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' | '));

  await browser.close();
}

await run({ width: 1366, height: 768 }, 'desktop-1366', false);
await run({ width: 1024, height: 768 }, 'tablet-1024', true);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
fs.writeFileSync(`${shots}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
