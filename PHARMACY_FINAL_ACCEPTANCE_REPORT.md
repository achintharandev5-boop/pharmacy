# Pharmacy SaaS — Final Acceptance Report (post-modernization)

Date: 2026-11-01 · Branch: `codex/phase1-safety-fixes` · HEAD: `e3c15e4` (uncommitted working tree, 363 status entries, unchanged by this verification)

Baseline: `PHARMACY_UI_FINAL_MODERNIZATION_REPORT.md`, `PHARMACY_MODULE_UI_REDESIGN_PROGRESS.md`, `PHARMACY_UI_VISUAL_REGRESSION_REPORT.md`, `PHARMACY_UI_MODERNIZATION_BASELINE.md`.

## Verdict

**NOT READY FOR PRODUCTION.** The modernized UI passes local verification in UI-test mode, with one exception. TypeScript, ESLint, production build, API tests, the protected-file check and browser workflows all pass. The release is blocked by:

1. **A real regression in the label workstation.** After an interval quantity is cancelled, the "Next: Enter the quantity for 8H" button that reopens the quantity step is missing. An existing unit test fails deterministically.
2. **Physical 70 × 50 mm printer acceptance has not been done.** No label printer is attached to this machine.
3. **Live backend / staging integration has not been done.** No isolated staging was approved or available.

Items 2 and 3 were already open before this verification. Item 1 is new.

Status key: **VERIFIED** = observed in this session with evidence · **BLOCKED** = cannot be done here without hardware, approval or a decision · **NOT VERIFIED** = not tested.

| # | Acceptance item | Status |
|---|---|---|
| 1 | Dev-server hydration issue | **VERIFIED: root cause found and resolved on a fresh server.** The user's existing port-3002 server still needs a restart (not done; see §1). |
| 2 | Browser interactions, critical workflows | **VERIFIED** in UI-test mode: 86/87 checks pass. The one miss was a sampling-timing artifact that passed 3/3 on recheck. |
| 3 | ReviewPrintGuard timeout | **VERIFIED: load-induced, not a code defect.** It passes 8/8 in the full suite and 8/8 twice in isolation (slowest test 206 ms against a 5 s limit). |
| 4 | Reliable full test-suite pass | **NOT ACHIEVED**: 2164/2166. One deterministic regression and one load-sensitive POS test (§3). |
| 5 | Physical 70 × 50 mm printer | **BLOCKED**: no label printer installed. |
| 6 | Live backend in isolated staging | **BLOCKED**: no approval or staging environment. No remote database was accessed. |
| 7 | 174 protected files unchanged | **VERIFIED**: 174/174 match the baseline SHA-256, checked at the start and the end. |
| 8 | TypeScript, ESLint, production build, regression | **VERIFIED**: all pass (§4). |

## 1. Dev-server hydration

**Finding.** The port-3002 Next dev server (PID 28296) was started on **2026-10-29 02:25**, two days before the modernization baseline (2026-10-31). It had been hot-reloading through the whole redesign, including root-layout and theme-bootstrap changes. Measurements on that server:

- About 13–20 s pass between the HTML response and React hydration. A server-action round trip takes 7–10 s.
- The dashboard's server-action chain takes about 115 s to settle. That is 20 POSTs: 8 queries doubled by React Strict Mode in development, plus session checks. It is finite, not a loop.
- An earlier sweep used a 1.5 s network-idle window, so it interacted with markup that was not yet hydrated. That matches the "no responsive event handlers" symptom.
- Once allowed to hydrate, the theme selector on 3002 does work.

**Fresh-server comparison.** I started an isolated copy of `apps/web` in a temp folder on port 3012, with UI-test mode only and no backend URLs:

- Hydration takes about 2 s after HTML; sign-in action 1.4 s.
- **Every visible button on all 23 routes has React handlers attached**, with no page errors.

**Root cause:** a stale, long-running dev server, plus sweep timing. It is not an application defect.

**Action for the team:** restart the port-3002 dev server. I did not stop it because it is the user's process.

**Related dev-only notes, not defects:**
- The stale server logged React's *"Encountered a script tag while rendering React component"*. That happens when the root layout is client-rendered after it changed under a running server.
  - `app/layout.tsx` already follows the Next 16 documented pattern: an inline `<head>` script plus `suppressHydrationWarning`, per `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.
  - The fresh server does not log it.
  - The docs offer an optional `type="text/plain"` client helper if the warning should be silenced. Not applied.
- The Next.js dev-tools badge (`nextjs-portal`) sits over the sidebar's "Collapse sidebar" button at bottom-left and intercepts clicks. It does not exist in production builds.

## 2. Browser workflow verification

The fresh UI-test-mode server was driven with installed Microsoft Edge through `playwright-core` 1.48.2.

**Safety of the run:**
- `window.print` was stubbed to a counter.
- Every API call is short-circuited by UI-test mode (`lib/api/server.ts:47`).
- The isolated copy had no API URL at all.
- Nothing was saved or sent.

**Results: 87 checks, 86 PASS** (`docs/ui-modernization/acceptance/workflow-results.json`). Each label scenario ran in a fresh browser context.

| Area | Verified behaviour |
|---|---|
| Shell | Theme selector switches and persists. Preference applies before hydration on reload (`data-theme=dark` at DOMContentLoaded). Account menu opens and closes on Escape. Sidebar collapses 240 → 64 px. Dashboard 7/30/90-day range selects. |
| Mobile 390 px | Navigation drawer opens. Escape closes it and focus returns to "Open navigation". |
| Label workstation (mouse 1366 × 768 and touch 1024 × 768) | **Interval quantity flow:** 5H, 6H, 8H, Daily, Evening and Weekly each go tile → quantity editor → + → Done (Next) → selected, with the preview updated. **EOD:** applies to the standard dose with Sinhala wording (`උදේට 1 \| දිනක් හැර දිනක්`). **Locks:** a Morning dose locks 5H/6H/8H/Weekly/EOD/STAT/Daily/Evening. **Other controls:** Clear All needs two taps; Chewable, With Food, Empty Stomach, Keep in Mouth and Dissolve and Drink toggle on and off; Take/After select. **Print blockers:** missing product type, quantity or meal timing is blocked correctly. |
| Review and print (both viewports) | Review shows "Print label only (not saved)" and the test-mode Print & Save ("Print layout preview"). The preview label measures 70 × 50 mm. **Print only:** prints once and shows "Nothing was saved, no stock was deducted and no print was recorded." **Print & Save (test mode):** prints the preview and reports "Operation was not saved or submitted." |
| POS | Search input works and "Clear search" works. F4 opens the customer chooser and Escape closes it. **No enabled checkout or payment control.** |
| Patients | Add-patient dialog opens with focus inside it, and Escape closes it. |
| Routes | All 18 remaining admin routes plus `/login` hydrate without page errors. |

The single miss was `/admin/prescriptions` at 5/9 buttons hydrated in one run, because the probe sampled mid-hydration. Rechecked 3× at 1 s, 3 s and 8 s: 9/9 every time, with no errors.

**Repo e2e scripts are stale.** `apps/web/e2e/*.mjs` is untracked. The scripts expect a "Till Date" grid tile (moved into the Days panel by Features 17/18) and an old numpad (replaced by the action quantity editor). They also authenticate with `sb-access-token` rather than the UI-test cookie. Their failures are script drift, not regressions. They need updating before they can serve as regression tools. `save-and-print.e2e.mjs` needs a throwaway local Postgres + API harness and was not run.

**Observation for pharmacist review (not marked as a defect):** after Clear All, the next interval editor opens at the previously entered quantity (5H = 1 → cleared → 6H opens at 1). On a fresh label it opens at 0. The pharmacist must still confirm with Done. Please confirm that carrying the value over is intended, given the Weekly rule "never assumes a quantity".

**Screenshots:** `docs/ui-modernization/acceptance/screens/`.

## 3. Test suite and ReviewPrintGuard

| Run | Result |
|---|---|
| Full web suite, default workers (~15) | **1847 passed / 126 failed / 193 never ran**, 23 worker RPC timeout errors, 537 s. The host had **2.2 GB free of 15.6 GB RAM** (three other Next servers, Codex, etc.). Failures were 122 timeouts, 2 render-timing failures and 2 assertions (`ChewingSam`, `DissolveSam`), all of which pass 2/2 in isolation. |
| Full web suite, `--maxWorkers=2` | **2164/2166 passed, 74 files, 0 pending**, 2664 s. ReviewPrintGuard passed 8/8. |
| Isolated reruns, 1 worker, ×2 each | ReviewPrintGuard 8/8 ×2 · PosWorkstation 34/34 ×2 · ChewingSam 44/44 ×2 · DissolveSam 56/56 ×2 · NameOfDays 70/70 ×2 · **Workstation 41/42 and 40/42 (fails)** |

**ReviewPrintGuard conclusion:** the earlier timeout was load starvation. The suite renders the full review page with `userEvent` and runs well under its 5 s timeout when the host is not swapping. **No test change was made.** To get a reliable full run on this machine, use bounded workers (`--maxWorkers=2`), or free memory first.

**Outstanding failures:**

1. **`components/label/Workstation.test.tsx` › "an interval without its quantity blocks nothing silently: the step can be reopened" — DETERMINISTIC REGRESSION.**
   - **Symptom:** after 8H → Cancel, the status reads "Next: Enter the quantity for 8H". But no button with that name exists, so there is no reopen-quantity control.
   - **Documentation conflict:** `docs/LABEL_BUTTON_BEHAVIOR_MATRIX.md:17` documents this line as a button that reopens the quantity pad. `PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md` says the "Next" button was deliberately kept and enlarged to 40 px.
   - **Current code:** `components/label/LabelActions.tsx:119-131` renders the status as a screen-reader-only `<span>`, with no button.
   - **When it changed:** `LabelActions.tsx` was last modified 2026-11-01 00:32. That is after the previous session's final sweep (2026-10-31 23:11), and it is the only label component edited since. It also matches the modernization baseline hash, which means the edit happened during the modernization session. No earlier copy exists to diff against.
   - **Impact:** a user who cancels an interval quantity loses the guided way back into that step.
   - **Not fixed here**, because it changes a completed module and the intent of the 00:32 edit is unknown. **Decision needed:** restore the visible "Next: …" reopen button, or confirm the removal and update the test and behaviour matrix.
   - In the second isolated run the neighbouring test "refuses switching 6H → 8H…" also failed. That run had a 665 s stall on the host, and the test passed in the bounded full run. Treat it as load-sensitive, but recheck it after the fix.
2. **`components/pos/PosWorkstation.test.tsx` › "asks before the page is closed or reloaded with items in the cart" — LOAD-SENSITIVE.**
   - It failed in the bounded full run and passed 34/34 twice in isolation.
   - The test dispatches `beforeunload` immediately after the cart renders, so it can run before the listener effect attaches.
   - Recommend waiting for the listener in the test. No product code was changed.

Also seen: in the bounded run, one `NameOfDays` test recorded 2,242 s yet passed. The file runs in 8 s in isolation, so this was a host stall or sleep, not a hang in the code.

## 4. Static checks, build, regression

| Check | Result | Evidence |
|---|---|---|
| Web TypeScript (`tsc --noEmit`) | PASS, 0 errors | `acceptance/tsc-web.log` |
| Web ESLint (whole app) | PASS, 0 findings | `acceptance/eslint-web.log` |
| Production build (`next build`, isolated copy, no `.env` files) | PASS: compiled, TypeScript passed, **30/30 pages generated**, no warnings | `acceptance/build.log` |
| API unit tests (mock / fake-Supabase only; `test:db` and `test:e2e` not run) | **440/440, 32/32 suites** | `acceptance/api-jest.log` |
| API TypeScript | PASS | — |
| `git diff --check` | PASS | — |
| Protected files | **174/174 unchanged** against `docs/ui-modernization/source-baseline.json` (start and end of session) | `acceptance/protected-hash-check.json` |
| Print CSS | `@page { size: 70mm 50mm }` and the 70 mm × 50 mm label rules have no changed lines against HEAD | — |

Two notes on these results:
- The isolated copies needed `turbopack.root` set in the **copy's** `next.config.ts`, because Turbopack refuses a junctioned `node_modules` outside its root. The repository config is unchanged.
- `PrintableLabel.tsx` differs from the last commit but matches the modernization baseline hash. Those differences are earlier uncommitted feature work, not modernization edits.

## 5. Preservation

**Confirmed by evidence:**
- **Protected sources unchanged:** clinical logic, constants and actions, the store, the API, auth/roles, the proxy and `PrintableLabel`.
- **Sinhala dosage wording renders** in the workstation and the review preview.
- **Label output:** the label previews at 70 × 50 mm.
- **Print workflows:** Print-only and Print & Save remain distinct, with their own messages.
- **POS:** no enabled checkout control.
- **Clinical locks:** the dose/interval sequencing locks are active.
- **Contracts:** no API or database contract files changed.

**Not confirmable here:** physical print fidelity, and data-backed states.

## 6. Outstanding risks

| Risk | Severity | Owner / next step |
|---|---|---|
| Missing "Next: Enter the quantity…" reopen control (deterministic test failure) | **High, release blocker** | Product/dev decision: restore it, or document the removal and update the test |
| No physical 70 × 50 mm thermal print test (fonts, margins, Sinhala shaping, cut alignment) | **High, release blocker** | Run `PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md` on the pharmacy printer |
| No live backend / staging verification (auth, roles, saves, stock deduction, print logging) | **High, release blocker** | Approve an isolated staging run (`PHARMACY_STAGING_RUNBOOK.md`) |
| Full test suite unreliable on memory-constrained hosts | Medium | Use `--maxWorkers=2` locally and in CI; stabilise the POS `beforeunload` test |
| Repo e2e scripts stale against the current UI | Medium | Update to current controls and the UI-test cookie, or adopt `acceptance/scripts/workflows.cjs` |
| Interval quantity carried over after Clear All | Medium (clinical UX) | Pharmacist to confirm intent |
| Pharmacist sign-off, screen reader, physical touch device, scanner | Medium | Not available in this session |
| Stale port-3002 dev server | Low | Restart it |
| Concurrent agent (Codex) running on this workspace | Low/process | Coordinate edits; recheck hashes before release |

## 7. What was not done

- No commit, push, deploy or production-data change.
- No remote database access. The Supabase MCP endpoint was also unreachable.
- No modification of application source or tests. This verification added only this report and the `docs/ui-modernization/acceptance/` evidence folder.
- No physical printing, and no staging or live-backend testing.
