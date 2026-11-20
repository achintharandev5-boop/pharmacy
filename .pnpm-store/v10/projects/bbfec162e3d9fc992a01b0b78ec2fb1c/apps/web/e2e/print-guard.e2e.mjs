// Print guard: labels with text that would be cut off (30.5 mm instruction area, layout P3) block Print & Save.
// Usage: node print-guard.e2e.mjs <baseUrl> <default|spec>
// playwright-core is not a project dependency: copy into an empty folder, `npm i playwright-core@1.48.2`,
// then run against a dev server. Uses the installed Microsoft Edge. Never saves, prints or sends.
import { chromium } from 'playwright-core';
const base = process.argv[2], mode = process.argv[3];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await ctx.addCookies([{ name: 'sb-access-token', value: 'x', domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
const btn = (n) => page.getByRole('button', { name: n, exact: true });
let pass = 0, fail = 0;
const check = (n, ok) => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  [${mode}] ${n}`); };
const open = async () => { await page.goto(`${base}/label`, { waitUntil: 'networkidle', timeout: 180000 }); await btn('Chewable').waitFor({ timeout: 120000 }); };
const review = async () => { await page.getByRole('button', { name: /Done — review and print labels/ }).click(); await page.locator('[data-label-body]').first().waitFor(); await page.waitForTimeout(800); };
const mln = async () => { for (const r of ['MORNING', 'LUNCH', 'NIGHT']) await btn(`Increase ${r} dosage`).click(); };
const nab = async () => { await btn('Take medication').click(); await btn('After meals').click(); };
const stat = async () => {
  await btn('STAT').click(); await btn('Increase STAT quantity').click(); await page.getByRole('button', { name: /Done \(Next\)/ }).click();
  if (await page.getByText(/how is it given/).count()) { await btn('STAT TAKE').click(); await btn('Enter (ඉන්පසු)').click(); }
  await btn('8H').click();
};
const printBtn = () => page.getByRole('button', { name: /Print & Save/ });

await open(); await mln(); await nab(); await review();
check('M/L/N + TAKE AFTER fits: Print & Save enabled', !(await printBtn().isDisabled()) && (await page.getByTestId('print-blocked').count()) === 0);

await open(); await mln(); await nab(); await stat(); await review();
check('M/L/N + TAKE AFTER + STAT: fits (P3; spec wording too)', !(await printBtn().isDisabled()));

const REASONS = ['කැස්සට', 'සෙමට', 'වේදනාව ඇති විට පමණක් ගන්න', 'නොනවත්වා බඩ යන විට', 'සෙම්ප්‍රතිශ්‍යාවට'];
const busy = async (reasons) => {
  await open(); await mln(); await nab();
  await btn('Weekly').click(); await btn('Till Date').click(); await btn('And This Date').click();
  await btn('Reasons').click(); for (const r of reasons) await btn(r).click(); await btn('Done').click();
  await btn('Select days of week').click(); await page.getByRole('button', { name: /MONDAY/ }).click(); await btn('ENTER').click();
  await stat(); await review();
};

// The busy label of the previous layout (125 px of 98) fits the 30.5 mm area in today's wording.
await busy(REASONS.slice(0, 2));
check(`busy label (doses, TAKE AFTER, Weekly, Till Date, And This Date, 2 reasons, Monday, STAT): ${mode === 'spec' ? 'blocked (about 124 px of 115 with STAT Option B)' : 'prints (P3)'}`,
  mode === 'spec' ? await printBtn().isDisabled() : !(await printBtn().isDisabled()));

// A label that does not fit even in P3: the same with five reasons and every day of the week.
await open(); await mln(); await nab();
await btn('Weekly').click(); await btn('Till Date').click(); await btn('And This Date').click();
await btn('Reasons').click(); for (const r of REASONS) await btn(r).click(); await btn('Done').click();
await btn('Select days of week').click(); await btn('Select All').click();
await btn('ENTER').click();
await stat(); await review();
const blockedText = (await page.getByTestId('print-blocked').count()) ? await page.getByTestId('print-blocked').innerText() : '';
check('overflowing label: Print & Save blocked, with the reason named', (await printBtn().isDisabled()) && /instructions \(dose rows and Sinhala lines\)/.test(blockedText) && (await page.getByTestId('label-overflow-0').isVisible()));
check('overflowing label: Save without printing still available', !(await page.getByRole('button', { name: /Save without printing/ }).isDisabled()));
if (mode === 'default') await page.screenshot({ path: 'shots/default-print-blocked.png', fullPage: true });
await page.getByRole('button', { name: /Back to Edit/ }).click();
await btn('Weekly').click(); await btn('Till Date').click(); await btn('And This Date').click();
await page.getByRole('button', { name: /^Remove DAYS/ }).click();
for (const r of REASONS) await page.getByRole('button', { name: `Remove ${r}` }).click();
await review();
check('after removing instructions: Print & Save enabled again', !(await printBtn().isDisabled()));
console.log(`${pass}/${pass + fail} print-guard checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
