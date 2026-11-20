// Checks the real printed label on /label/print-check (development server) for 14 sample prescriptions in
// both wordings: every label prints in full or is blocked by the guard (never clipped silently), no "…",
// 70 × 50 mm, 30.5 mm instruction area, STAT shown once, and the print engine gives one page per label.
// Read-only: nothing is saved or sent to the API.
// Usage: node print-check.e2e.mjs <baseUrl> <outDir>   (setup as in workstation.e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [base, out] = [process.argv[2], process.argv[3]];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); };

async function openPage(query = '', viewport = { width: 1366, height: 900 }, scale = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  await ctx.addCookies([{ name: 'sb-access-token', value: 'test-token-pharmacist', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/label/print-check${query}`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction(() => window.__labelCheck, null, { timeout: 120000 });
  return { ctx, page, errors };
}

// 1. Every label: prints in full, or is blocked with a reason
const { ctx, page, errors } = await openPage();
const { fonts, results } = await page.evaluate(() => window.__labelCheck);
fs.writeFileSync(path.join(out, 'label-check-results.json'), JSON.stringify({ fonts, results }, null, 2));
check(fonts.gemunu && fonts.noto, `Sinhala fonts loaded before measuring ${JSON.stringify(fonts)}`);
check(errors.length === 0, `no page errors ${errors.join(' ')}`);

for (const r of results) {
  const k = `${r.scenario}|${r.wording}`;
  console.log(`  ${k}: ${r.content}/${r.box} ${r.guard.length ? 'BLOCKED ' + r.guard.join('; ') : 'prints'} ${JSON.stringify(r.fitSizes)}`);
  check(r.clipped.length === 0 || r.guard.length > 0, `${k}: nothing is cut off silently${r.clipped.length ? ` (cut: ${r.clipped.join(' | ')}; guard: ${r.guard.join('; ')})` : ''}`);
  check(r.ellipsis.length === 0, `${k}: no text shortened with "…"`);
  check(Math.abs(r.box - 30.5 * 96 / 25.4) < 0.6, `${k}: instruction area 30.5 mm (${r.box} px)`);
  check(r.statPills + r.statPhraseBadges <= 1, `${k}: STAT quantity printed at most once (pill ${r.statPills}, phrase ${r.statPhraseBadges})`);
  if (r.wording === 'current') check(r.statPhraseBadges === 0, `${k}: default wording never uses STAT Option B`);
}
const by = (s, w) => results.find((r) => r.scenario === s && r.wording === w);
// Expected outcomes measured on the P3 prototype (docs/PRINT_LAYOUT_AND_STAT_OPTIONS.md §2)
for (const [s, w, prints] of [['S4', 'spec', true], ['S5', 'spec', true], ['S7', 'current', true], ['S10', 'current', true], ['S11', 'current', false], ['S14', 'current', true], ['S13', 'current', false], ['S7', 'spec', false], ['S12', 'current', false], ['S12', 'spec', false]]) {
  check((by(s, w).guard.length === 0) === prints, `${s}|${w}: ${prints ? 'prints' : 'blocked'} as expected (${by(s, w).guard.join('; ') || 'prints'})`);
}
for (const s of ['S4', 'S5', 'S6']) check(by(s, 'spec').statPhraseBadges === 1 && by(s, 'spec').statPills === 0, `${s}|spec: Option B: quantity in the phrase, no pill`);
check(by('S11', 'current').fitSizes['alternative brand name']?.startsWith('ok'), `S11: long brand name printed in full (${by('S11', 'current').fitSizes['alternative brand name']})`);
const s13 = by('S13', 'current');
check(s13.fitSizes['medicine name']?.startsWith('ok') ? s13.guard.length === 0 : s13.guard.some((g) => g.startsWith('medicine name')), `S13: very long medicine name is in full or blocked with "medicine name" (${s13.fitSizes['medicine name']}; ${s13.guard.join('; ') || 'prints'})`);

const sizes = await page.$$eval('[data-card] .print-label-page', (els) => [...new Set(els.map((e) => `${Math.round(e.getBoundingClientRect().width * 10) / 10}x${Math.round(e.getBoundingClientRect().height * 10) / 10}`))]);
check(sizes.length === 1 && sizes[0] === '264.6x189', `every label is 70 × 50 mm (${sizes})`);
await page.locator('[data-results]').screenshot({ path: path.join(out, 'label-check-table.png') });
await ctx.close();

// 2. Zoomed renders (3×) to read the Sinhala and the names by eye
const zoom = await openPage('', { width: 1400, height: 900 }, 3);
for (const s of ['S4', 'S5', 'S6', 'S7', 'S10', 'S11', 'S13', 'S14']) {
  await zoom.page.locator(`[data-scenario="${s}"]`).screenshot({ path: path.join(out, `after-${s}.png`) });
}
await zoom.ctx.close();

// 3. Print engine: the hidden print copy is fitted like the preview; one page per label
for (const wording of ['current', 'spec']) {
  const p = await openPage(`?print=${wording}`);
  await p.page.waitForSelector('.print-only [data-label]', { state: 'attached' });
  await p.page.evaluate(() => document.fonts.ready);
  await p.page.waitForTimeout(300);
  const fit = await p.page.evaluate((w) => {
    const sig = (root) => [...root.querySelectorAll('[data-fit-field]')].map((e) => `${e.getAttribute('data-fit-field')}=${e.getAttribute('data-fit')} ${e.getAttribute('data-fit-size')}`);
    const printed = [...document.querySelectorAll('.print-only [data-label]')].flatMap(sig);
    const preview = [...document.querySelectorAll(`[data-card$="|${w}"] [data-label]`)].flatMap(sig);
    return { same: JSON.stringify(printed) === JSON.stringify(preview), printed: printed.length, unmeasured: printed.filter((x) => x.includes('unmeasured')).length };
  }, wording);
  check(fit.same && fit.unmeasured === 0 && fit.printed > 0, `${wording}: print copy names fitted exactly as the preview (${fit.printed} names, ${fit.unmeasured} unmeasured)`);
  const file = path.join(out, `print-${wording}.pdf`);
  await p.page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  const pdf = fs.readFileSync(file, 'latin1');
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const boxes = [...new Set((pdf.match(/\/MediaBox\s*\[[^\]]*\]/g) || []).map((m) => m.replace(/\s+/g, ' ')))];
  // Chromium writes the page size in whole points (70 mm → 198 pt = 69.85 mm).
  const mm = boxes.map((b) => b.match(/[\d.]+/g).slice(2).map((n) => (Number(n) * 25.4 / 72).toFixed(1)).join(' × '));
  check(pages === 14, `${wording}: 14 labels print as ${pages} pages (no blank page)`);
  check(mm.length === 1 && /^(69\.8|69\.9|70\.0) × (49\.9|50\.0|50\.1)$/.test(mm[0]), `${wording}: page size ${mm.join(', ')} mm (${boxes.join(' ')})`);
  await p.ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
