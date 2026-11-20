// Measures the printed 26 mm instruction box for sample labels, as built and under candidate layout
// changes (CSS injected into the test browser only). Usage: node label-layout.e2e.mjs <baseUrl> <default|spec>
// Setup as in workstation.e2e.mjs.
import { chromium } from 'playwright-core';
const [base, mode] = [process.argv[2], process.argv[3]];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await ctx.addCookies([{ name: 'sb-access-token', value: 'test-token-pharmacist', domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
const btn = (n) => page.getByRole('button', { name: n, exact: true });
const open = async () => { await page.goto(`${base}/label`, { waitUntil: 'networkidle', timeout: 180000 }); await btn('Chewable').waitFor({ timeout: 120000 }); };
const mln = async () => { for (const r of ['MORNING', 'LUNCH', 'NIGHT']) await btn(`Increase ${r} dosage`).click(); };
const nab = async () => { await btn('Take medication').click(); await btn('After meals').click(); };
const stat = async () => {
  await btn('STAT').click(); await btn('Increase STAT quantity').click(); await page.getByRole('button', { name: /Done \(Next\)/ }).click();
  if (await page.getByText(/how is it given/).count()) { await btn('STAT TAKE').click(); await btn('Enter (ඉන්පසු)').click(); }
  await btn('8H').click();
};
const busy = async () => {
  await btn('Weekly').click(); await btn('Till Date').click(); await btn('And This Date').click();
  await btn('Reasons').click(); await btn('කැස්සට').click(); await btn('සෙමට').click(); await btn('Done').click();
  await btn('Select days of week').click(); await page.getByRole('button', { name: /MONDAY/ }).click(); await btn('ENTER').click();
};
const days = async () => { for (let i = 0; i < 5; i++) await btn('Increase days').click(); };
const reason = async () => { await btn('Reasons').click(); await btn('කැස්සට').click(); await btn('Done').click(); };

const VARIANTS = {
  'V0 current': '',
  'V1 spacing only (row gap 4→2 px, Sinhala line gap 2→0)': '[data-label-body]{gap:2px!important} [data-label-body]>div:has(>.sinhala-text){gap:0!important}',
  'V2 = V1 + Sinhala line-height 1.375→1.2': '[data-label-body]{gap:2px!important} [data-label-body]>div:has(>.sinhala-text){gap:0!important} [data-label-body] .sinhala-text{line-height:1.2!important}',
  'V3 = V1 + Sinhala 13.5→12 px': '[data-label-body]{gap:2px!important} [data-label-body]>div:has(>.sinhala-text){gap:0!important} [data-label-body] div.sinhala-text{font-size:12px!important}',
  'V4 = V1 + body +3.5 mm (footer 9.5→6 mm)': '[data-label-body]{gap:2px!important;height:29.5mm!important;max-height:29.5mm!important;min-height:29.5mm!important} [data-label-body]>div:has(>.sinhala-text){gap:0!important}',
};

async function measure() {
  return page.$eval('[data-label-body]', (e) => {
    const b = e.getBoundingClientRect(); const k = [...e.children].map((c) => c.getBoundingClientRect());
    return { content: Math.round(Math.max(...k.map((x) => x.bottom)) - Math.min(...k.map((x) => x.top))), box: Math.round(b.height),
      rows: [...e.children].map((c) => `${(c.textContent || '').trim().slice(0, 18)}:${Math.round(c.getBoundingClientRect().height)}`) };
  });
}

const scenarios = {
  'A typical: M/L/N 1/1/1 + TAKE AFTER + 5 days': [mln, nab, days],
  'B + reason': [mln, nab, days, reason],
  'C + STAT 1 (8H)': [mln, nab, days, stat],
  'D Morning 1 + TAKE AFTER + STAT': [async () => btn('Increase MORNING dosage').click(), nab, stat],
  'E busy (Weekly, Till Date, And This Date, 2 reasons, Monday, STAT)': [mln, nab, busy, stat],
};
const fonts = [];
for (const [name, steps] of Object.entries(scenarios)) {
  await open(); for (const s of steps) await s();
  await page.getByRole('button', { name: /Done — review and print labels/ }).click();
  await page.locator('[data-label-body]').first().waitFor(); await page.evaluate(() => document.fonts.ready);
  if (!fonts.length) fonts.push(await page.evaluate(() => ({ gemunu: document.fonts.check('bold 13.5px "Gemunu Libre"'), noto: document.fonts.check('bold 13.5px "Noto Sans Sinhala"') })));
  for (const [v, css] of Object.entries(VARIANTS)) {
    await page.evaluate((c) => { let s = document.getElementById('variant'); if (!s) { s = document.createElement('style'); s.id = 'variant'; document.head.appendChild(s); } s.textContent = c; }, css);
    const m = await measure();
    console.log(`[${mode}] ${name} | ${v} | ${m.content}/${m.box} ${m.content <= m.box + 1 ? 'FITS' : 'OVERFLOW'}${v.startsWith('V0') ? '  rows ' + m.rows.join(' · ') : ''}`);
  }
}
console.log(`[${mode}] fonts loaded: ${JSON.stringify(fonts[0])}`);
await browser.close();
