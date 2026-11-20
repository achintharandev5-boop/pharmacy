# Local UI Testing Mode: Fix and Run Report

Date: 29 October 2026.

**Result: the application runs at http://localhost:3002 in database-free UI testing mode. Sign-in with the local test account works, and every page opens without Supabase, PostgreSQL or the NestJS API.** No database, migration, remote Supabase, deployment, commit or push was involved. The backend was not started.

## 1. Root cause of the login error

The application switches UI testing mode on with exactly one variable, **`NEXT_PUBLIC_UI_TEST_MODE=true`** (`apps/web/lib/uiTestMode.ts`), and only when `NODE_ENV` is not `production`.

`apps/web/.env.local` instead contained `UI_DEMO_MODE=true`, `UI_DEMO_EMAIL` and `UI_DEMO_PASSWORD`. Those belong to an earlier demo that was retired (`PHARMACY_DATABASE_FREE_UI_TESTING_REPORT.md`: "The old UI_DEMO_MODE configuration is no longer used"). Nothing in the code reads them. `apps/web/.env.example` still listed them as commented-out lines, which is likely how they ended up in `.env.local`.

So UI testing mode was off. Signing in as `tester@pharmacy.local` then hit the deliberate guard in `app/actions/auth.ts` that stops the reserved local account from ever being sent to real authentication. That guard produced "The local test account is unavailable outside UI testing mode." (`demo@example.test` was never a valid account. With the mode off it would have tried the real API; with it on, it is refused as incorrect.)

## 2. Environment variables

| File | Setting | Purpose |
|---|---|---|
| `apps/web/.env.development.local` (new, git-ignored) | `NEXT_PUBLIC_UI_TEST_MODE=true` | Turns on UI testing mode for `next dev` only. Next.js never reads this file for `next build` or `next start`. |
| same file (optional, commented) | `UI_TEST_EMAIL`, `UI_TEST_PASSWORD` | Server-only overrides of the test account. |
| `apps/web/.env.local` | `UI_DEMO_*` lines removed, replaced by a comment explaining where the switch is | The existing `NEXT_PUBLIC_API_URL` / Supabase lines are untouched. |

Because `NEXT_PUBLIC_*` values are fixed when the dev server starts, **restart `pnpm --filter web dev` after changing them**. To use the real API and Supabase sign-in again, set the flag to `false` (or delete the file) and restart.

## 3. Files changed

- `apps/web/.env.development.local`: new, local only, git-ignored.
- `apps/web/.env.local`: retired `UI_DEMO_*` lines replaced by an explanatory comment (local only, git-ignored).
- `apps/web/.env.example`: no longer suggests the retired `UI_DEMO_*` settings; documents `.env.development.local` and the test account.
- `apps/web/components/ProductSearchInput.tsx`: a **"Test type (not catalogue)"** selector (accessible name "Temporary test product type (UI testing only)"), shown only in UI testing mode and only for a typed test product (see §7). It was shortened to one line in the right-panel update so it doesn't overflow the toolbar at 1024 px.
- `apps/web/app/label/page.tsx`: the UI-testing print layout preview now clears its print-only copy afterwards, as a real print does. The "70 ? 50 mm" text in the fit-blocked message is corrected to "70 × 50 mm".
- Tests: `apps/web/components/UiTesting.test.tsx` (temporary product type) and `apps/web/app/label/expiryFinal.test.tsx` (the print preview leaves no stale print copy).
- This report.

Existing uncommitted work was preserved.

## 4. Authentication behaviour

Checked in a real browser (headless Microsoft Edge driven through the DevTools protocol, throwaway profile) and over HTTP:

- Without a session every page redirects to `/login`. The login page shows the local test account.
- Correct credentials set one HTTP-only, SameSite=Strict cookie, `pharmacy-ui-test`, and open `/admin`. No JWT is issued and no request goes to the API or Supabase.
- A wrong password, and the old `demo@example.test` / `demo-only`, are refused with "Incorrect UI test email or password."
- Signed-in role: local **Admin / UI tester**, so admin-only screens such as Reasons and Settings are reachable.
- **Log out of UI testing** deletes the session cookie (no cookies remain). After that, `/admin` redirects to `/login` again. **Reset UI Test Session** clears the label draft and temporary Reasons but keeps the sign-in.
- Production is unchanged. `uiTestEnabled()` is false whenever `NODE_ENV=production`, `next.config.ts` refuses a production build with the flag on, and the flag now lives in a file production builds never read. The production build in §8 confirms this.

## 5. Working local test credentials

- URL: http://localhost:3002/login
- Email: `tester@pharmacy.local`
- Password: `Test@12345`

These are the built-in development defaults, not real credentials. The previous `demo@example.test` / `demo-only` do not match the implementation and are refused.

## 6. Pages tested (real browser, signed in)

All open with no console errors. The only requests leaving localhost:3002 go to Google Fonts (the existing Sinhala print fonts); none go to the API, Supabase or any remote service. Pages that need records show **"No data loaded / UI testing mode: Connect the backend to view records."** No patients, medicines, stock or prescriptions are invented.

Dashboard (`/admin`, `/`), Analytics, Inventory overview, Adjustments, Inventory analytics, Batches, Expiry, Low stock, Movements, Receiving / GRN ("Could not load suppliers or medicines / UI testing mode: No data loaded."), Returns, Suppliers and supplier detail, Labels, Patients and patient detail, Prescriptions and prescription detail, Products / Medicines and product detail, Reasons (Admin, temporary entries), Settings, Label workstation (`/label`), and Print check (`/label/print-check`). `/inventory`, `/admin/inventory/products*` and `/demo` are existing redirect aliases and redirect correctly.

In dev mode the first visit to a route can show "Loading…" for several seconds while Next.js compiles it; every page then settled on its empty state.

## 7. Label features tested

**Real-browser run: 26/26 checks passed.** Sign in, Admin Reasons, then on the workstation:

- Typed test product, then the temporary product type (Karal). The indicator shows "Product type: Karal · කරල්".
- Product quantity, Morning + and Night +, TAKE, AFTER. Preview: "කරල් 1 බැගින් දිනකට 2 වරක් කෑමට පසු ගන්න".
- **Add Expiry Date (Feature #22):**
  - Not selected at first.
  - The dialog says "inventory batches are not loaded. No GRN expiry is available", and no batch list is generated.
  - A non-ISO date is refused. The temporary date 2099-08-31 is accepted and marked "(UI test value, not GRN)".
  - Review says "(temporary UI test value, not a GRN batch)".
  - The label prints `EXP DATE : 2099-08-31` with a 30.5 mm instruction area.
  - Tapping again removes it. The expiry row disappears, there is no placeholder, and the instruction area grows to 34 mm.
- **STAT lock:** on a fresh label, STAT replaces the grid and the expiry card is faded and inert. Cancel restores it.
- **Reasons (Feature #21):** two temporary reasons added in Admin Reasons (marked "temporary entries in this tab only"). Multi-select shows `aria-pressed=true` on both. Enter confirms. Both lines print under the instruction.
- **Multiple labels:** Add Label (LABEL 2 OF 2), and each label keeps its own expiry. Delete Label with confirmation works.
- **Review:** the 1:1 preview measures 265 × 189 px (70 × 50 mm). "Save without printing" reports *not saved*. "Print layout preview" opens the print dialog once and reports *Operation was not saved*.

**Fix found during this run.** After a UI-testing print preview, a hidden print-only copy of the label stayed on the page. If you then edited the label (e.g. removed the expiry) and pressed Ctrl+P, that stale copy would print. A real print already clears this copy; the UI-testing preview now does too, and a regression test covers it.

**Product type for typed test products.** In UI testing mode there is no catalogue, so a typed medicine has no product type. The existing rule (Features #2/#3) then refuses every BD, TDS, 8H/6H/5H and four-times-daily label, so those features could not be reviewed at all. The new temporary selector lets the tester state the type explicitly, following the same pattern as the temporary expiry date. It is labelled "not catalogue data", appears only in UI testing mode for a typed product, and is reset when the name changes. The product-type rules themselves are unchanged and still refuse a label with no type.

**Covered by the automated component suites rather than the browser run:** Chewing, Dissolve and Drink, With Food, Keep in Mouth, Empty Stomach, USB TAKE/GIVE, EOD, intervals, Digital Label (equal/unequal), Evening, four-times, Daily, Weekly, Name of Days, Till to the Day, ENT, number pad and dosage X/Y. All are in the 1,835 passing tests. Every control is present on the running workstation, but I did not click through each in the browser.

## 8. Tests

| Check | Result |
|---|---|
| Real-browser UI test run (Edge, headless) | 26/26 passed; page crawl: 25 routes OK, 0 console errors |
| HTTP checks: login form POST, protected-route redirects, all routes | Passed |
| Web TypeScript | Passed |
| Web ESLint | Passed |
| Full web Vitest | **53 files, 1,835 passed** (previous run 1,834; +1 new test) |
| Focused: auth/proxy, UI-mode isolation, Reasons, Add Expiry Date, workstation, label page | **12 files, 410 passed** |
| Web production build (UI testing must stay off) | Passed. It loaded only `.env.local, .env`; `.env.development.local` (the UI testing switch) was not read |
| `git diff --check` | Passed |

No test failed. No backend code was changed, so the API suites were not rerun.

## 9. Remaining limitations

- There is no data. Record screens show empty states, catalogue search is off (typed test products only), Save never saves, and Send SMS is blocked.
- Temporary Reasons live in that browser tab's session storage. A full page refresh discards the label draft (sign-in is kept).
- Add Expiry Date in this mode uses only a typed temporary date. Real GRN batch retrieval needs the API.
- The Sinhala fonts load from Google Fonts. Without internet the preview uses fallback fonts and its measurements may differ.
- Physical printing is not tested.
- The headless-browser scripts used for verification live in my session's scratchpad, not in the repository.
- Feature #21 and #22 staging verification remain pending. Nothing was applied to any database.

## 10. Start commands

From PowerShell (or any shell):

```powershell
cd C:\Users\Achintha\Documents\Pharmacy-label-sass\pharmacy-label
pnpm --filter web dev
```

Then open http://localhost:3002 and sign in with `tester@pharmacy.local` / `Test@12345`. The dev server prints `Environments: .env.development.local, .env.local, .env`; if `.env.development.local` is missing from that line, UI testing mode is off.

Do not use `pnpm dev` / `pnpm run dev` from the root for this: it starts the NestJS API too (via turbo), which UI testing does not need.
