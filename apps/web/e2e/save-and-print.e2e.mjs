// Setup: start a throwaway local Postgres (port 54331) and the API test harness on :3001
// (apps/api/test/db/serve-local.ts), and a web dev server with NEXT_PUBLIC_API_URL=http://localhost:3001.
// Never point this at a real API: it creates prescriptions.
// End to end against the LOCAL API (test harness on :3001, throwaway Postgres). Saves and prints
// prescriptions; the browser's print call is intercepted and the printed document is rendered to
// PDF by Edge's print engine. No physical printer, no Supabase.
// Usage: node persist.mjs <webBaseUrl>
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const base = process.argv[2];
const PSQL = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const sql = (q) =>
  execFileSync(PSQL, ['-h', 'localhost', '-p', '54331', '-U', 'postgres', '-d', 'label_print_e2e', '-t', '-A', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0;
let fail = 0;
const check = (n, ok, d = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await ctx.addCookies([{ name: 'sb-access-token', value: 'test-token-pharmacist', domain: 'localhost', path: '/' }]);
await ctx.addInitScript(() => {
  window.__prints = [];
  window.print = () => {
    window.__prints.push(document.documentElement.outerHTML);
  };
});
const page = await ctx.newPage();
const btn = (n) => page.getByRole('button', { name: n, exact: true });
const open = async () => {
  await page.goto(`${base}/label`, { waitUntil: 'networkidle', timeout: 180000 });
  await btn('Chewable').waitFor({ timeout: 120000 });
};
const alt = async (name) => page.getByLabel('Alternative product name').fill(name);
const nab = async (a, t) => {
  await btn(a).click();
  await btn(t).click();
};
const review = async () => {
  await page.getByRole('button', { name: /Done — review and print labels/ }).click();
  await page.locator('[data-label-body]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
};
const backAtWorkstation = async () => {
  await btn('Chewable').waitFor({ timeout: 30000 });
  return (await page.getByText('LABEL 1 OF 1').count()) === 1;
};
const count = (t) => Number(sql(`select count(*) from ${t}`));
const prints = () => page.evaluate(() => window.__prints.length);

// 1. Save without printing, two labels
await open();
await alt('E2E Medicine A');
for (const r of ['MORNING', 'LUNCH', 'NIGHT']) await btn(`Increase ${r} dosage`).click();
await nab('Take medication', 'After meals');
await btn('Add Label').click();
await alt('E2E Medicine B');
await btn('Increase MORNING dosage').click();
await nab('Give medication', 'Before meals');
await btn('STAT').click();
await btn('Increase STAT quantity').click();
await btn('Increase STAT quantity').click();
await page.getByRole('button', { name: /Done \(Next\)/ }).click();
await btn('8H').click();
const before = count('prescriptions');
await review();
await page.getByRole('button', { name: /Save without printing/ }).click();
check('Save without printing returns to an empty workstation', await backAtWorkstation());
check('one prescription saved', count('prescriptions') === before + 1);
const items = sql(
  `select alternative_product_name, morning_qty, lunch_qty, night_qty, stat_qty, stat_follow_up, final_instruction_text from prescription_items where prescription_id = (select id from prescriptions order by created_at desc limit 1) order by alternative_product_name`,
).split('\n');
check(
  'two items; quantities and STAT stored as entered',
  items.length === 2 && items[0].startsWith('E2E Medicine A|1|1|1|') && items[1].startsWith('E2E Medicine B|1|0|0|2|8H'),
  items.join(' ;; '),
);
check('generated Sinhala text stored with each item', items[0].includes('කෑමට පසු ගන්න') && items[1].includes('කෑමට පෙර දෙන්න'));
check('Save without printing did not print', (await prints()) === 0);

// 2. Print & Save, three labels
await open();
await alt('E2E Print 1');
await btn('Increase MORNING dosage').click();
await nab('Take medication', 'After meals');
await btn('Add Label').click();
await alt('E2E Print 2');
await btn('Increase NIGHT dosage').click();
await nab('Take medication', 'Before meals');
await btn('Add Label').click();
await alt('E2E Print 3');
await btn('Increase LUNCH dosage').click();
await nab('Give medication', 'After meals');
const p0 = count('prescriptions');
await review();
check(
  'three label previews shown, all fit',
  (await page.locator('[data-label-body]').count()) === 3 && !(await page.getByRole('button', { name: /Print & Save/ }).isDisabled()),
);
await page.getByRole('button', { name: /Print & Save/ }).click();
await backAtWorkstation();
const printed = await page.evaluate(() => window.__prints);
check('print requested exactly once, after saving', printed.length === 1 && count('prescriptions') === p0 + 1);
const events = sql(`select coalesce(string_agg(event_type, ','), '') from prescription_events where prescription_id = (select id from prescriptions order by created_at desc limit 1)`);
check('print recorded against the saved prescription', /print/i.test(events), events);

// Render exactly what was sent to print, with the browser's print engine.
const html = printed[0].replace(/<script[\s\S]*?<\/script>/gi, '').replace('<head>', `<head><base href="${base}/">`);
const pdfPage = await ctx.newPage();
await pdfPage.setContent(html, { waitUntil: 'networkidle' });
await pdfPage.evaluate(() => document.fonts.ready);
await pdfPage.emulateMedia({ media: 'print' });
const pdf = await pdfPage.pdf({ preferCSSPageSize: true, printBackground: true });
fs.writeFileSync('shots/print-3-labels.pdf', pdf);
const text = pdf.toString('latin1');
const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
const box = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
const mm = box ? [Number(box[1]), Number(box[2])].map((v) => Math.round((v / 72) * 25.4 * 10) / 10) : null;
check('PDF of the print has exactly 3 pages (no extra blank label)', pages === 3, `pages ${pages}`);
check('page size is 70 × 50 mm', Boolean(mm) && Math.abs(mm[0] - 70) < 0.6 && Math.abs(mm[1] - 50) < 0.6, JSON.stringify(mm));
const printedText = await pdfPage.locator('.print-only').innerText();
const fitted = [...printed[0].matchAll(/data-fit="([a-z]+)"/g)].map((m) => m[1]);
check('names in the printed document were fitted before printing (none unmeasured or cut)', fitted.length >= 6 && fitted.every((f) => f === 'ok'), fitted.join(','));
check('printed document carries all three labels and their Sinhala', ['E2E PRINT 1', 'E2E PRINT 2', 'E2E PRINT 3'].every((t) => printedText.toUpperCase().includes(t)) && printedText.includes('කෑමට පසු දෙන්න'));

// 3. One overflowing label in a batch: printing refused, Save without printing allowed
await open();
await alt('E2E Fits');
await btn('Increase MORNING dosage').click();
await nab('Take medication', 'After meals');
await btn('Add Label').click();
await alt('E2E Overflows');
for (const r of ['MORNING', 'LUNCH', 'NIGHT']) await btn(`Increase ${r} dosage`).click();
await nab('Take medication', 'After meals');
await btn('Weekly').click();
await btn('Till Date').click();
await btn('And This Date').click();
// Five reasons and every weekday: too long even for the 30.5 mm instruction area (layout P3)
await btn('Reasons').click();
for (const r of ['කැස්සට', 'සෙමට', 'වේදනාව ඇති විට පමණක් ගන්න', 'නොනවත්වා බඩ යන විට', 'සෙම්ප්‍රතිශ්‍යාවට']) await btn(r).click();
await btn('Done').click();
await btn('Select days of week').click();
await btn('Select All').click();
await btn('ENTER').click();
await btn('STAT').click();
await btn('Increase STAT quantity').click();
await page.getByRole('button', { name: /Done \(Next\)/ }).click();
await btn('8H').click();
const p1 = count('prescriptions');
const printsBefore = await prints();
await review();
check('overflowing label 2 flagged; label 1 not', (await page.getByTestId('label-overflow-1').isVisible()) && (await page.getByTestId('label-overflow-0').count()) === 0);
check('Print & Save disabled for the whole batch', await page.getByRole('button', { name: /Print & Save/ }).isDisabled());
await page.getByRole('button', { name: /Print & Save/ }).click({ force: true, timeout: 3000 }).catch(() => {});
await page.waitForTimeout(800);
check('forcing the click prints and saves nothing', (await prints()) === printsBefore && count('prescriptions') === p1);
await page.getByRole('button', { name: /Save without printing/ }).click();
await backAtWorkstation();
check('Save without printing still saves the overflowing batch', count('prescriptions') === p1 + 1);

// 4. A brand name too long to print in full, even on two lines: blocked and named (B7)
await open();
await alt('E2E VERY LONG ALTERNATIVE BRAND NAME THAT CANNOT FIT ON TWO LINES OF THE BRAND CELL 250MG');
await btn('Increase MORNING dosage').click();
await nab('Take medication', 'After meals');
await review();
const reason = (await page.getByTestId('print-blocked').count()) ? await page.getByTestId('print-blocked').innerText() : '';
check('long brand name: Print & Save blocked, reason names the brand', (await page.getByRole('button', { name: /Print & Save/ }).isDisabled()) && reason.includes('alternative brand name too long to print in full'), reason);
check('long brand name: shown in full on the preview (no "…")', (await page.locator('[data-fit-field="alternative brand name"]').first().innerText()).replace(/\s+/g, ' ').includes('250MG'));
await page.getByRole('button', { name: /Back to Edit/ }).click();

console.log(`\n${pass}/${pass + fail} end-to-end checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
