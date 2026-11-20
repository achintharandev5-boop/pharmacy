// Current-UI workflow verification against a UI-test-mode dev server. Never saves: every API call
// is short-circuited by UI test mode, and window.print is stubbed to a counter.
const { chromium } = require('C:/Users/Achintha/node_modules/playwright-core');
const fs = require('fs');
const base = process.argv[2];
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (area, name, ok, detail = '') => {
  results.push({ area, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${detail ? '  — ' + detail : ''}`);
};
const attempt = async (area, name, fn) => {
  try { const r = await fn(); check(area, name, r === undefined ? true : r.ok ?? r, r && r.detail); }
  catch (e) { check(area, name, false, e.message.split('\n')[0].slice(0, 160)); }
};
const hydrated = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('button')].filter((e) => e.offsetParent !== null);
  const live = els.filter((e) => Object.keys(e).some((k) => k.startsWith('__reactProps')));
  return { ok: els.length > 0 && live.length === els.length, detail: `${live.length}/${els.length} visible buttons have React handlers` };
});

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const newPage = async (viewport = { width: 1366, height: 768 }, touch = false) => {
    const ctx = await browser.newContext({ viewport, hasTouch: touch });
    await ctx.addCookies([{ name: 'pharmacy-ui-test', value: 'local-ui-only-v1', url: base }]);
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message.slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text().slice(0, 200)));
    await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
    return page;
  };
  const go = async (page, path) => {
    await page.goto(base + path, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((e) => Object.keys(e).some((k) => k.startsWith('__reactProps'))), null, { timeout: 60000 });
    await page.waitForTimeout(800);
  };

  // ---- Shell (admin) ----
  {
    const page = await newPage();
    await go(page, '/admin');
    await attempt('shell', 'dashboard hydrated', () => hydrated(page));
    await attempt('shell', 'theme selector switches dark → light and persists', async () => {
      await page.selectOption('select[aria-label="Color theme"]', 'dark');
      const d = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('pharmacy-theme')]);
      await page.selectOption('select[aria-label="Color theme"]', 'light');
      const l = await page.evaluate(() => document.documentElement.dataset.theme);
      return { ok: d[0] === 'dark' && d[1] === 'dark' && l === 'light', detail: `dark=${d} light=${l}` };
    });
    await attempt('shell', 'theme preference survives reload (no flash: set before hydration)', async () => {
      await page.selectOption('select[aria-label="Color theme"]', 'dark');
      await page.reload({ waitUntil: 'domcontentloaded' });
      const t = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.waitForFunction(() => [...document.querySelectorAll('select')].some((e) => Object.keys(e).some((k) => k.startsWith('__reactProps'))), null, { timeout: 60000 });
      await page.selectOption('select[aria-label="Color theme"]', 'light');
      return { ok: t === 'dark', detail: `data-theme at DOMContentLoaded=${t}` };
    });
    await attempt('shell', 'account menu opens on click and closes on Escape', async () => {
      const btn = page.getByRole('button', { name: /Account menu/ });
      await btn.click();
      await page.waitForTimeout(300);
      const expanded = await btn.getAttribute('aria-expanded');
      const menuVisible = await page.getByRole('menu').or(page.getByRole('dialog')).first().isVisible().catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const after = await btn.getAttribute('aria-expanded');
      return { ok: (expanded === 'true' || menuVisible) && after !== 'true', detail: `aria-expanded ${expanded} → ${after}, popup visible=${menuVisible}` };
    });
    await attempt('shell', 'collapse sidebar toggles', async () => {
      const nav = page.locator('aside').first();
      const w0 = (await nav.boundingBox()).width;
      const cb = page.getByRole('button', { name: /Collapse sidebar/ });
      const box = await cb.boundingBox();
      const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + ' ' + String(e.className).slice(0, 60) + ' in-button=' + !!e.closest('button[aria-label*="ollapse"],button') : 'none'; }, [box.x + box.width / 2, box.y + box.height / 2]);
      console.log('  collapse target before hiding dev overlay:', top);
      await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((e) => { e.style.display = 'none'; }));
      await cb.click({ timeout: 10000 });
      await page.waitForTimeout(500);
      const w1 = (await nav.boundingBox()).width;
      await page.getByRole('button', { name: /Expand sidebar|Collapse sidebar/ }).first().click();
      await page.waitForTimeout(500);
      return { ok: w1 < w0, detail: `sidebar ${w0}px → ${w1}px` };
    });
    await attempt('shell', 'dashboard range control (7/30/90 days) selects', async () => {
      await page.getByRole('radio', { name: '30 days', exact: true }).click();
      await page.waitForTimeout(300);
      const s = await page.getByRole('radio', { name: '30 days', exact: true }).getAttribute('aria-checked');
      return { ok: s === 'true', detail: 'aria-checked=' + s };
    });
    check('shell', 'no page errors on dashboard', page.errors.length === 0, page.errors.slice(0, 3).join(' || '));
    await page.context().close();
  }

  // ---- Mobile drawer ----
  {
    const page = await newPage({ width: 390, height: 844 }, true);
    await go(page, '/admin');
    await attempt('shell-mobile', 'drawer opens, Escape closes, focus returns to opener', async () => {
      const opener = page.getByRole('button', { name: /menu|navigation/i }).filter({ hasNot: page.locator('[aria-label*="Account"]') }).first();
      const name = await opener.getAttribute('aria-label');
      await opener.tap();
      await page.waitForTimeout(500);
      const open = await page.getByRole('dialog').first().isVisible().catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const closed = !(await page.getByRole('dialog').first().isVisible().catch(() => false));
      const focus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
      return { ok: open && closed && focus === name, detail: `opener="${name}" open=${open} closed=${closed} focus="${focus}"` };
    });
    await page.screenshot({ path: `${out}/admin-390.png` });
    await page.context().close();
  }

  // ---- Label workstation (each scenario in a fresh browser context: no state carried over) ----
  for (const [vp, touch, tag] of [[{ width: 1366, height: 768 }, false, 'mouse-1366'], [{ width: 1024, height: 768 }, true, 'touch-1024']]) {
    const A = 'label ' + tag;
    const open = async () => {
      const page = await newPage(vp, touch);
      await go(page, '/label');
      const h = {
        page,
        tap: (l) => (touch ? l.tap({ timeout: 10000 }) : l.click({ timeout: 10000 })),
        btn: (n) => page.getByRole('button', { name: n, exact: true }),
        preview: async () => ((await page.getByTestId('label-text-preview').count()) ? (await page.getByTestId('label-text-preview').innerText()).replace(/\s+/g, ' ') : ''),
        tileOn: (n) => page.evaluate((n) => { const b = [...document.querySelectorAll('[data-testid=action-grid] button, #action-grid button')].find((e) => e.innerText.replace(/\s+/g, ' ').trim().startsWith(n)); return b ? b.getAttribute('aria-pressed') === 'true' : null; }, n),
        editorButtons: () => page.evaluate(() => { const e = document.querySelector('[data-testid=action-qty-editor]'); return e ? [...e.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.innerText.trim()) + (b.disabled ? '(dis)' : '')).join(', ') : 'no editor'; }),
      };
      h.pressed = async (n) => (await h.btn(n).first().getAttribute('aria-pressed')) === 'true';
      return h;
    };

    for (const n of ['5H', '6H', '8H', 'Daily', 'Evening', 'Weekly']) {
      const h = await open();
      await attempt(A, `${n}: tile -> quantity editor -> + -> Done (Next) -> selected, preview updated`, async () => {
        try {
          await h.tap(h.btn(n));
          await h.page.waitForTimeout(300);
          const editor = h.page.getByTestId('action-qty-editor');
          const shown = await editor.isVisible();
          const q0 = (await h.page.getByTestId('action-qty').innerText()).trim();
          await h.tap(editor.getByRole('button', { name: /^Increase .*quantity/ }).first());
          await h.page.waitForTimeout(150);
          const q1 = (await h.page.getByTestId('action-qty').innerText()).trim();
          await h.tap(editor.getByRole('button', { name: /^Done/ }).first());
          await h.page.waitForTimeout(300);
          const on = await h.tileOn(n);
          const pv = await h.preview();
          return { ok: shown && Number(q1) === Number(q0) + 1 && on, detail: `qty ${q0}->${q1} on=${on} preview="${pv.slice(0, 50)}"` };
        } catch (e) { throw new Error(e.message.split('\n')[0] + ' | editor: ' + (await h.editorButtons())); }
      });
      await h.page.context().close();
    }

    {
      const h = await open();
      await attempt(A, 'EOD: tile selects, then Morning dose + -> EOD wording in preview', async () => {
        await h.tap(h.btn('EOD')); await h.page.waitForTimeout(300);
        const on = await h.tileOn('EOD');
        await h.tap(h.btn('Increase MORNING dosage')); await h.page.waitForTimeout(300);
        const pv = await h.preview();
        return { ok: on && /[඀-෿]/.test(pv), detail: `on=${on} preview="${pv.slice(0, 60)}"` };
      });
      await h.page.context().close();
    }

    {
      const h = await open();
      await attempt(A, 'observation: editor start value after Clear All (5H=1, clear, open 6H)', async () => {
        await h.tap(h.btn('5H')); await h.page.waitForTimeout(250);
        await h.tap(h.page.getByTestId('action-qty-editor').getByRole('button', { name: /^Increase .*quantity/ }).first());
        await h.tap(h.page.getByTestId('action-qty-editor').getByRole('button', { name: /^Done/ }).first());
        await h.page.waitForTimeout(250);
        await h.tap(h.page.getByRole('button', { name: 'Clear All' })); await h.page.waitForTimeout(250);
        await h.tap(h.page.getByRole('button', { name: 'Tap again to clear' })); await h.page.waitForTimeout(300);
        const cleared = (await h.tileOn('5H')) === false;
        await h.tap(h.btn('6H')); await h.page.waitForTimeout(300);
        const start = (await h.page.getByTestId('action-qty').innerText()).trim();
        return { ok: cleared, detail: `Clear All cleared 5H=${cleared}; 6H editor opened at qty ${start}` };
      });
      await h.page.context().close();
    }

    {
      const h = await open();
      await attempt(A, 'a standard dose locks interval/STAT tiles (sequencing rule intact)', async () => {
        await h.tap(h.btn('Increase MORNING dosage')); await h.page.waitForTimeout(250);
        const locked = await h.page.evaluate(() => ['5H', '6H', '8H', 'Weekly', 'EOD', 'STAT', 'Daily', 'Evening'].map((n) => { const b = [...document.querySelectorAll('button')].find((e) => e.innerText.replace(/\s+/g, ' ').trim() === n); return b ? (b.disabled || b.getAttribute('aria-disabled') === 'true' || !!b.querySelector('[data-testid=lock-glyph]')) : null; }));
        return { ok: locked.every((x) => x === true), detail: `locked(5H,6H,8H,Weekly,EOD,STAT,Daily,Evening)=${locked}` };
      });
      await h.page.context().close();
    }

    {
      const h = await open();
      const { page, tap, btn } = h;
      await attempt(A, 'workstation hydrated', () => hydrated(page));
      await attempt(A, 'manual product name accepted', async () => { await page.getByLabel(/Manual test-product name/i).first().fill('Paracetamol 500mg'); return true; });
      await attempt(A, 'product type set (required before printing)', async () => {
        const sel = page.locator('select:not([aria-label="Color theme"])').first();
        const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
        await sel.selectOption(opts[0]);
        await page.waitForTimeout(200);
        return { ok: (await page.getByText('Product type is missing').count()) === 0, detail: `chose "${opts[0]}" of ${opts.length}` };
      });
      await attempt(A, 'product quantity set via + control', async () => {
        await tap(page.getByRole('button', { name: 'Increase product quantity' })); await page.waitForTimeout(200);
        return (await page.getByRole('button', { name: /Product quantity not set/ }).count()) === 0;
      });
      await attempt(A, 'Morning dose + and preview updates', async () => {
        await tap(btn('Increase MORNING dosage')); await page.waitForTimeout(200);
        const lbl = await page.getByRole('button', { name: /Morning quantity/ }).getAttribute('aria-label');
        return { ok: /Morning quantity: 1/.test(lbl), detail: lbl };
      });
      for (const n of ['Chewable', 'With Food', 'Empty Stomach', 'Keep in Mouth', 'Dissolve and Drink']) {
        await attempt(A, `${n} selects and deselects`, async () => {
          await tap(btn(n)); await page.waitForTimeout(150); const on = await h.pressed(n);
          await tap(btn(n)); await page.waitForTimeout(150); const off = !(await h.pressed(n));
          return { ok: on && off, detail: `on=${on} off=${off}` };
        });
      }
      for (const n of ['Take medication', 'After meals']) await attempt(A, `${n} selects`, async () => { await tap(btn(n)); await page.waitForTimeout(150); return h.pressed(n); });
      await attempt(A, 'Sinhala instruction text in preview', async () => { const pv = await h.preview(); return { ok: /[඀-෿]/.test(pv), detail: pv.slice(0, 80) }; });
      await page.screenshot({ path: `${out}/${tag}-label-filled.png` });
      await attempt(A, 'Done opens review with Print-only and Print & Save (test-mode preview)', async () => {
        await tap(btn('Done — review and print labels')); await page.waitForTimeout(1000);
        const blockers = await page.getByRole('alert').allInnerTexts().catch(() => []);
        const po = await page.getByRole('button', { name: /Print label only \(not saved\)/ }).isVisible();
        const ps = await page.getByRole('button', { name: /Print layout preview|Print & Save/ }).isVisible();
        return { ok: po && ps, detail: `printOnly=${po} printAndSave=${ps}${blockers.length ? ' blockers=' + blockers.join(' | ').slice(0, 200) : ''}` };
      });
      await page.screenshot({ path: `${out}/${tag}-review.png` });
      await attempt(A, 'review preview label measures 70 x 50 mm', async () => {
        const n = await page.evaluate(() => { const mm = 96 / 25.4; return [...document.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - 70 * mm) < 1.5 && Math.abs(r.height - 50 * mm) < 1.5; }).length; });
        return { ok: n > 0, detail: `${n} element(s) at 70x50mm` };
      });
      await attempt(A, 'Print only: prints once, shows "nothing was saved" notice', async () => {
        await tap(page.getByRole('button', { name: /Print label only \(not saved\)/ }));
        await page.waitForFunction(() => window.__prints >= 1, null, { timeout: 15000 });
        const notice = await page.getByText(/Label printed only\. Nothing was saved/).isVisible();
        return { ok: notice, detail: `prints=${await page.evaluate(() => window.__prints)} notice=${notice}` };
      });
      await attempt(A, 'Print & Save in test mode: preview prints, reports not saved', async () => {
        await tap(page.getByRole('button', { name: /Print layout preview|Print & Save/ }));
        await page.waitForFunction(() => window.__prints >= 2, null, { timeout: 15000 });
        const msg = await page.getByText(/Operation was not saved or submitted/).first().isVisible();
        return { ok: msg, detail: `prints=${await page.evaluate(() => window.__prints)} notSavedMessage=${msg}` };
      });
      check(A, 'no page errors on workstation', page.errors.length === 0, page.errors.slice(0, 3).join(' || '));
      await page.context().close();
    }
  }

  // ---- POS ----
  {
    const page = await newPage();
    await go(page, '/pos');
    await attempt('pos', 'POS hydrated', () => hydrated(page));
    await attempt('pos', 'search accepts input and Clear enables', async () => {
      await page.getByPlaceholder(/Name, generic name or barcode/).fill('para');
      await page.waitForTimeout(1200);
      const v = await page.getByPlaceholder(/Name, generic name or barcode/).inputValue();
      const clr = await page.getByRole('button', { name: 'Clear search' }).isVisible();
      await page.getByRole('button', { name: 'Clear search' }).click();
      const after = await page.getByPlaceholder(/Name, generic name or barcode/).inputValue();
      return { ok: v === 'para' && clr && after === '', detail: `typed="${v}" clearSearch=${clr} after="${after}"` };
    });
    await attempt('pos', 'F4 opens customer chooser; Escape closes', async () => {
      await page.keyboard.press('F4');
      await page.waitForTimeout(500);
      const open = await page.getByRole('dialog').first().isVisible().catch(() => false);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const closed = !(await page.getByRole('dialog').first().isVisible().catch(() => false));
      return { ok: open && closed, detail: `open=${open} closed=${closed}` };
    });
    await attempt('pos', 'no enabled checkout / payment control', async () => {
      const enabled = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /checkout|complete sale|take payment|\bpay\b|charge/i.test(b.innerText + ' ' + (b.getAttribute('aria-label') || '')) && !b.disabled).map((b) => b.innerText.trim()));
      return { ok: enabled.length === 0, detail: enabled.length ? 'enabled: ' + enabled.join(', ') : 'none enabled' };
    });
    check('pos', 'no page errors on POS', page.errors.length === 0, page.errors.slice(0, 3).join(' || '));
    await page.screenshot({ path: `${out}/pos.png` });
    await page.context().close();
  }

  // ---- Patients dialog ----
  {
    const page = await newPage();
    await go(page, '/admin/patients');
    await attempt('patients', 'add-patient dialog opens, traps focus, Escape closes', async () => {
      const b = page.getByRole('button', { name: /add patient|new patient|register/i }).first();
      await b.click();
      await page.waitForTimeout(500);
      const dlg = page.getByRole('dialog').first();
      const open = await dlg.isVisible();
      const inDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const closed = !(await dlg.isVisible().catch(() => false));
      return { ok: open && inDialog && closed, detail: `open=${open} focusInDialog=${inDialog} closed=${closed}` };
    });
    check('patients', 'no page errors on patients', page.errors.length === 0, page.errors.slice(0, 3).join(' || '));
    await page.context().close();
  }

  // ---- Hydration + error sweep of remaining admin routes ----
  for (const r of ['/admin/prescriptions', '/admin/labels', '/admin/products', '/admin/inventory', '/admin/inventory/receiving', '/admin/inventory/adjustments', '/admin/inventory/batches', '/admin/inventory/expiry', '/admin/inventory/low-stock', '/admin/inventory/movements', '/admin/inventory/returns', '/admin/inventory/suppliers', '/admin/inventory/analytics', '/admin/analytics', '/admin/audit-log', '/admin/reasons', '/admin/settings', '/login']) {
    const page = await newPage();
    await attempt('routes', `${r} hydrates without page errors`, async () => {
      if (r === '/login') await page.context().clearCookies();
      await go(page, r);
      const h = await hydrated(page);
      return { ok: h.ok && page.errors.length === 0, detail: h.detail + (page.errors.length ? ' errors: ' + page.errors.slice(0, 2).join(' || ') : '') };
    });
    await page.context().close();
  }

  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nTOTAL ${results.length}  PASS ${results.length - fail}  FAIL ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
