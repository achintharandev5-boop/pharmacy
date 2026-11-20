# Pharmacy Label SaaS — Full System Audit 2026

**Date:** 2026-10-30 · **Type:** read-only, evidence-based audit (no application code, test, migration or git changes)
**Code state audited:** branch `codex/phase1-safety-fixes`, HEAD `e3c15e4` (last commit 2026-10-10) **plus uncommitted work**: 84 modified, 1 deleted, 180 untracked entries (including this audit's reports).
**Companion reports:** `PHARMACY_FEATURE_COMPLETION_MATRIX.md`, `PHARMACY_DEVELOPMENT_ROADMAP.md`, `PHARMACY_PRODUCTION_READINESS_REPORT.md`, `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md`

---

## 1. Executive summary

Pharmacy Label SaaS is a **strong single-pharmacy label-dispensing system that is not yet a SaaS and not yet launch-ready.**

**Strong:**
- The label workstation (Features #1–#22) is fully implemented locally and heavily tested (1,994 web tests pass).
- Inventory with GRN, batches, quarantine and returns is largely complete.
- Authentication fails closed.
- RLS denies every browser path.

**Missing or blocking:**
- There is **no tenant model**: only `reasons` has a `pharmacy_id`, and the API's service-role key bypasses RLS.
- **POS does not exist**: it is a design document only.
- Several read endpoints admit **any signed-in account, even one with no role**, including the full patient list.
- Sessions expire after about an hour with no refresh.
- Dispensing deducts product totals, not batches, by default.
- Clinical wording sign-off, physical printing and staging have **never** been verified.
- **Three weeks of work exist only on this laptop**: uncommitted, with no git remote.

| Measure | Result | How measured |
|---|---|---|
| Feature implementation | **71.6% weighted** (74.7% excluding POS; 65.9% unweighted) | Capability scoring, `PHARMACY_FEATURE_COMPLETION_MATRIX.md` §1–2 |
| Modules | **5 complete, 9 partial, 1 missing** (of 15 scored areas) | Complete = ≥ 85% of capabilities implemented: Label Workstation, Products, Inventory, Dashboard, Printing. Complete ≠ ready: Printing and Inventory still carry P0 verification items. Missing: POS |
| Tests | **0 failing.** Web 1994/1994 (61 files), API 253/253 (27 suites) | This audit's run; web needs `--testTimeout=30000` under load (§8) |
| Static checks | Web tsc ✓, web ESLint ✓, API tsc ✓, both builds ✓, `git diff --check` ✓; **API ESLint 784 problems (724 errors, 60 warnings)** | §8 |
| Security issues | **3 Critical, 5 High, 6 Medium, 3 Low** | §6 |
| Staging | **NOT READY** | No staging project exists; migrations unapplied (`PHARMACY_STAGING_RUNBOOK.md`) |
| Production | **NO-GO** | §9 and readiness report |
| Remaining work to a single-pharmacy pilot | **≈ 227–394 engineering hours** + pharmacist and owner decisions | Roadmap |

---

## 2. Architecture (verified from source)

| Layer | Technology | Evidence |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | `pnpm-workspace.yaml`, `turbo.json` |
| Web | Next.js 16.3.2 (App Router, Turbopack), React 19.2, Zustand 5, Tailwind 4, Recharts, lucide | `apps/web/package.json` |
| API | NestJS 11, class-validator, `@supabase/supabase-js` 2.112 | `apps/api/package.json` |
| Database | Supabase Postgres; 9 migrations; 18 tables | `apps/api/supabase/migrations/` |
| Auth | Supabase Auth; API verifies bearer tokens with `auth.getUser`; role from `app_metadata.role` | `apps/api/src/auth/auth.guard.ts` |
| Data access | **API only**, with the **service-role key** (bypasses RLS); browsers never query the DB | `apps/api/src/supabase/supabase.service.ts:20`; RLS migration header |
| Web → API | Next.js server actions call the API with the session cookie's token | `apps/web/app/actions/*.ts`, `lib/api/server.ts` |
| SMS | Next.js server action → text.lk directly (not via the API) | `apps/web/app/actions/sms.ts:99` |
| Printing | Browser print of a 70 × 50 mm `@page`; Sinhala web fonts from Google Fonts | `components/PrintableLabel.tsx`, `app/globals.css:1` |
| Local test mode | `NEXT_PUBLIC_UI_TEST_MODE`; backend calls short-circuited | `lib/uiTestMode.ts`, `lib/api/server.ts:47` |

**Tables:** `audit_log, customers, idempotency_keys, inventory_movements, label_sessions, labels, patient_returns, pharmacy_settings, prescription_events, prescription_items, prescriptions, product_batches, products, reasons, sms_messages, stock_receipt_items, stock_receipts, suppliers, user_profiles`.

**Concurrent sessions:** two other sessions (`pharmacy-label-e7`, `pharmacy-label-28`) worked in this checkout today. Both were **idle** for the whole audit; the last source edit was at 01:33. No file they touched was edited by this audit.

---

## 3. Module-by-module findings

Scores and capability lists are in the completion matrix; key evidence and gaps follow.

### A. Authentication & user management (50%)

- ✓ Login/logout; the API guard fails closed with no environment bypass (`auth.guard.ts`); `@Public` only on `/auth/login` and `/health`.
- ✓ Roles admin/pharmacist/staff from `app_metadata` (user-unwritable); `STOCK_MANAGERS` gate stock mutations.
- ✗ **Role-less accounts pass every route without `@Roles`** (`roles.guard.ts:17`).
- ✗ No refresh token; the cookie lives `expires_in` (≈1 h) (`app/actions/auth.ts:77-82`).
- ✗ The proxy checks only that a cookie exists (`proxy.ts:11`, blocker B4).
- ✗ No password reset ("ask the administrator", `login/LoginForm.tsx:42`).
- ✗ No user creation, role management or deactivation UI or API (`scripts/set-user-role.js` only).
- ✗ No pharmacy-level restriction (`pharmacyId` read in the guard but used only by `reasons.service.ts`).
- **UI-test mode cannot bypass production auth:** `uiTestEnabled()` requires `NODE_ENV !== 'production'` (`lib/uiTestMode.ts:3`), and `next.config.ts:3` refuses a production build with the flag. The API has no test bypass at all.

### B. Dashboard (88%)

- Real API endpoints for summary, activity, status breakdown, top products, alerts and recent activity (`admin.controller.ts:33-69`), plus inventory expiry and movement dashboards.
- Web actions state "Failures are reported as errors, never replaced with sample data" (`app/actions/admin.ts:6`). No mock data was found (search for mock/placeholder/dummy/TODO in `app`, `components`, `lib`, `store`).
- ✗ No sales statistics (no POS); date filtering is presets only.
- Real-data rendering is **NOT VERIFIED** (UI-test mode returns "unavailable").

### C. Label workstation (100% implemented)

- All 31 capabilities in the brief are present and tested (matrix §4). Print & Save blocks labels whose text would overflow; names are never truncated (approvals doc B2, B7).
- **ENT:** removed from the left action grid and kept as the fifth Administration button by the approved 2026-10-29 decision (`components/label/LabelActions.tsx:63`). Historical `ENT:v1:` data still prints (`lib/labelBuilder.ts:68`).
- Clinical gaps, not code gaps:
  - Sinhala wording approvals S1–S3, A1–A16 are open (`docs/PHARMACIST_APPROVAL_REQUIRED.md`).
  - Some combinations print **no** frequency sentence and say "Awaiting pharmacist" (A16).
  - "Save without printing" records a COMPLETED prescription and dispenses stock; there are no real drafts (B3).
- The latest touch-first redesign by another session (`PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md`, 2026-10-30) is in the working tree; its tests are part of the 1,994 passing.

### D. Prescriptions (81%)

- ✓ Create with idempotency key (`prescriptions.service.ts:107-152`), list, search, detail, print/SMS log, reprint (`admin.controller.ts:94`).
- ✗ **No cancel/void**: status `CANCELLED` is defined (`20261005000000…sql:11`) but unused.
- ⚠ **Default write mode `legacy`**: application-level steps with compensating rollback, deducting the product total only (`env.validation.ts`, `prescriptions.service.ts:79-100`). Batch-level FEFO `create_prescription` is built and tested but **off**, pending pharmacist approval D1 and reconciliation D3.

### E. Patients (67%)

- ✓ Register, search (sanitised PostgREST filter, `common/db.ts:100`), profile, history.
- ✗ **No edit endpoint** (no PATCH in `customers.controller.ts`).
- ✗ No duplicate detection (no unique phone; no 23505 handling in `customers.service.ts`).
- ⚠ Hard delete (admin only) nulls `customer_id` on prescriptions (`ON DELETE SET NULL`).
- ⚠ `GET /customers` returns **every patient, unpaginated**, to any signed-in account including role-less ones.
- ✗ No pharmacy isolation.

### F. Products (100%)

- Create, edit and search by barcode; unique barcode (`init.sql:16`); generic name, category, `is_active`, `product_type`, `unit_of_measure`; unique batch per product.

### G. Inventory (92%)

- Receipts (GRN), adjustments, quarantine/release, patient returns (never restocked: D4), expiry matrix, low stock, analytics, dispensing batches; all mutations limited to `STOCK_MANAGERS`.
- Reconciliation is a read-only SQL diagnostic + SOP with no UI.
- Batch totals can diverge from product totals while dispensing is `legacy` (finding F1 in `STAGING_READINESS_REPORT.md`).

### H. Point of sale (0%)

`PHARMACY_POS_TECHNICAL_DESIGN.md`: *"Design proposal only. No POS schema, route, UI, migration or checkout code was implemented."* `price` columns exist on products and receipt items, but there are no carts, payments, invoices, receipts or refunds.

### I. Admin & settings (36%)

- ✓ Reasons catalogue (admin CRUD).
- Settings page shows system status, the current account, a read-only roles table, label-printing info and pharmacy details from the environment (`app/admin/settings/page.tsx`).
- ✗ No pharmacy-profile endpoint (B6), user management, printer configuration or audit-log viewer.

### J. Reporting (44%)

- Inventory, movement and expiry analytics exist.
- ✗ No sales or financial reports, and no CSV/Excel export anywhere (no `text/csv`/export code in web or API).

### K. Printing (85% implemented; physical NOT VERIFIED)

- ✓ 70 × 50 mm `@page`, fit measurement with a 1 px margin, waits for the Sinhala font, blocks overflow, print-only vs Print & Save distinct.
- Browser print measured 69.85 × 50.12 mm (approvals doc B6).
- ✗ **No physical printer test ever recorded.**
- ⚠ Fonts load from Google Fonts at runtime (offline fallback risk).
- Headless captures show Sinhala as boxes (`PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md` §9.3). Confirm on real hardware.

---

## 4. Backend API audit

**62 routes in 11 controllers enumerated** (`apps/api/src/**/*.controller.ts`). All routes require a valid Supabase token except `POST /auth/login` and `GET /health`. A global `ValidationPipe` (`whitelist: true`) runs on all DTOs; UUID params use `ParseUUIDPipe`.

| Group | Routes | AuthZ | Notes |
|---|---|---|---|
| `/auth` | login (public), me | — | **No rate limit** on login |
| `/admin/dashboard/*` | 6 GET | ALL_ROLES | OK |
| `/admin/health`, `patients/:id`, `prescriptions`, `prescriptions/:id`, `products`, `products/:id`, `products/:id/movements`, `inventory/summary`, `labels/logs` | 9 GET | **none → any signed-in user, even role-less** | Patient profile and prescriptions exposed to role-less accounts |
| `/admin/prescriptions/:id/reprint` | POST | **none: a role-less account can trigger a reprint (a write)** (`admin.controller.ts:94`) | Reprint |
| `/customers` | GET all, GET search, POST | **none** | Unpaginated full list; create by role-less users |
| `/customers/:id` | DELETE | Admin | Hard delete |
| `/labels` | GET, POST | **none** | Legacy table; role-less write |
| `/prescriptions/*` | 5 | ALL_ROLES (class) | Idempotent create |
| `/products` | search, barcode, `:id` GET | none | Catalogue read |
| `/products` | POST, PATCH | STOCK_MANAGERS | OK |
| `/inventory/*` | 9 GET, 6 POST | mutations STOCK_MANAGERS / ALL_ROLES (patient return) | Several GETs without roles |
| `/suppliers/*` | 2 GET, POST, PATCH | mutations STOCK_MANAGERS | |
| `/reasons`, `/admin/reasons/*` | GET; admin CRUD | Admin for writes | Only module using `pharmacyId` |

**Missing endpoints:** patient update; prescription void/cancel; users/roles; pharmacy settings; audit-log read; exports; SMS send (lives in web); POS.

**Transaction safety:**
- Prescription create is idempotent (unique `idempotency_keys`, `prescriptions.service.ts:145`).
- Stock mutations use database functions (`20261010000300_transactional_functions.sql`).
- The legacy prescription path is a multi-step write with compensation, not a single transaction.

**Response consistency:** errors are mapped by `toHttpError`; there is no envelope-format test across modules (NOT VERIFIED).

---

## 5. Database audit (static; **not executed**)

Running PostgreSQL 18 was found on `localhost:5432`, but this audit did not connect: the migration-test runner creates and drops databases, which is not read-only, and it was not approved. Database verification in this audit is **NOT VERIFIED**; the last recorded local run is in `docs/STAGING_READINESS_REPORT.md` §5.1 (2026-10-10, PostgreSQL 18.1).

| Check | Finding |
|---|---|
| Tables / FKs | 18 tables; FKs with `ON DELETE SET NULL` from history to patients (history survives patient deletion but loses the link) |
| Unique constraints | `products.barcode`, `(product_id, batch_number)`, idempotency key; **none on patient phone** |
| Indexes | barcode, generic name, category, active and more (`inventory_v2`, `schema_hardening`) |
| **Tenant isolation** | **Absent**: `pharmacy_id` only in `20261025000100_reasons_catalogue.sql` |
| RLS | Enabled on all 17 base tables + `reasons` with **no policies** (deny-all for anon/authenticated) (`20261010000400_row_level_security.sql:29`). Correct for API-only access; offers no tenant protection because the API is service-role |
| Service role | Used for every query; isolation must be in application code, where none exists |
| Migration ordering | Timestamped, sequential; tests in `supabase/tests/` (10–60) |
| Transactional integrity | `create_prescription`, receipt, adjustment and dispensing functions with row locks (concurrency tests `20_`, `40_…sh`) |
| Audit | `audit_log` table + 7 triggers; the actor is not set for API writes (B11). `created_by` only on prescriptions; `updated_by` only on reasons |
| Backup / recovery | Procedure documented (runbook §3); **no restore drill recorded** |
| Retention | No retention policy for patient data, SMS logs or audit rows |
| Expiry/batch consistency | Enforced in functions (no dispensing of undated or expired batches, D2); quantities not reconciled (D3) |

---

## 6. Security audit

| # | Severity | Issue | Evidence | Recommendation |
|---|---|---|---|---|
| S-1 | **Critical** | No tenant isolation in a product sold as SaaS; the service-role key bypasses RLS | `supabase.service.ts:20`; no `pharmacy_id` columns | One deployment per pharmacy for the pilot; tenancy before sharing (P0-03) |
| S-2 | **Critical** | Exposed service-role key and admin password **not rotated** | `STAGING_READINESS_REPORT.md` §8 | Rotate now (P0-02); no secret values were found in tracked files during this audit |
| S-3 | **Critical** (operational) | No remote and three weeks uncommitted: total-loss risk; no reviewable history of clinical changes | `git remote -v` empty; last commit 2026-10-10 | P0-01 |
| S-4 | High | Role-less accounts can read all patients, prescriptions and label logs, create patients and labels, and trigger reprints | `roles.guard.ts:17`; controllers without `@Roles` (§4) | Explicit policy on every route (P0-04) |
| S-5 | High | `GET /customers` returns the entire patient table, unpaginated | `customers.service.ts:19` | Paginate, require role, audit access |
| S-6 | High | No login throttling or lockout | No throttler or helmet in `apps/api` | P1-08 |
| S-7 | High | Proxy trusts cookie presence; pages render before server-side token verification | `apps/web/proxy.ts:11` (B4) | Verify the session server-side (P0-09). API calls still verify, so data stays protected |
| S-8 | High | SMS sent from the web server without rate limit or persistence: abuse and cost risk, no audit | `app/actions/sms.ts:65-99` (B3) | Move into the API (P1-01) |
| S-9 | Medium | Audit actor missing on most API writes | B11 | P1-02 |
| S-10 | Medium | Patient hard delete detaches clinical history | `customers.service.ts:52`, FKs | Soft delete |
| S-11 | Medium | Sessions expire in ≈1 h with no refresh, which encourages password sharing and shared logins | `auth.ts:81` | P0-09 |
| S-12 | Medium | `forbidNonWhitelisted: false`: unknown fields silently dropped (safe, but hides client bugs) | `main.ts` | Consider `true` |
| S-13 | Medium | No security headers (helmet); CORS restricted to `FRONTEND_URL` (good) | `main.ts` | Add helmet |
| S-14 | Medium | Legacy `POST /labels` writes with no role | `labels.controller.ts:14` | Restrict or remove |
| S-15 | Low | PostgREST `.or()` filters built by interpolation; mitigated by `likeTerm` stripping `, ( ) " \` | `common/db.ts:100`, `customers.service.ts:31`, `suppliers.service.ts:28` | Use a parameterised RPC or keep a test of the sanitiser |
| S-16 | Low | `dangerouslySetInnerHTML` used only for a static CSS constant | `PrintableLabel.tsx:428` | No action |
| S-17 | Low | The API's `pnpm lint` script runs `--fix` (mutates files) | `apps/api/package.json` | Separate `lint` and `lint:fix` |

**Verified safe:**
- UI-test mode is isolated from production (two guards).
- `.env*` are git-ignored (`.gitignore:28`, `apps/web/.gitignore:34`).
- The web holds no Supabase keys.
- API tokens are verified by Supabase on every request.
- Server actions use Next.js's built-in origin check, and the cookie is `httpOnly` + `SameSite=Lax` + `Secure` in production.
- The API uses bearer tokens, so classic CSRF does not apply.

---

## 7. Feature completeness

See `PHARMACY_FEATURE_COMPLETION_MATRIX.md` §4.

- **Features #1–#20:** complete locally with passing tests. Several await wording approval.
- **#21 Reasons and #22 Expiry Date:** implemented locally, **staging verification pending**. #22 also depends on batch reconciliation and batch-level dispensing.
- **No feature is production-ready.**

---

## 8. Testing & quality (this audit's run, 2026-10-30 01:40–02:00)

| Check | Command | Result |
|---|---|---|
| Web unit/component | `npx vitest run --testTimeout=30000` | **61 files, 1994/1994 pass** (228 s) |
| API unit | `npx jest` | **27 suites, 253/253 pass** (67 s) |
| Web TypeScript | `npx tsc --noEmit -p .` | Pass |
| API TypeScript | `npx tsc --noEmit -p tsconfig.json` | Pass |
| Web ESLint | `npx eslint .` | Pass (0) |
| **API ESLint** | `npx eslint "src/**/*.ts"` (no `--fix`) | **784 problems: 724 errors, 60 warnings, in 47 files.** 467 `prettier/prettier` (formatting); 312 type-safety (`no-unsafe-*` 301, unnecessary assertion 8, require-await 3); 5 other |
| Web build | `npx next build` | Pass (all routes) |
| API build | `npx nest build` | Pass |
| Diff | `git diff --check` | Pass |
| DB/migration tests | `supabase/tests/*` | **NOT RUN** (§5) |
| End-to-end | — | **None exist** |
| CI | — | **None** |

**API lint debt:**
- Earlier reports cited more than 1,000 errors; the current count is **724 errors**.
- About 64% of all problems are auto-fixable formatting.
- No per-file baseline exists, so new and old debt cannot be told apart exactly. With the web lint clean and API tsc clean, there is no evidence of new type errors.
- The `test/` directory, included by the `lint` script's glob, was not linted here.

**Timeout caveat:** at the default 5 s timeout, the web suite timed out in 57 tests during the 2026-10-29 baseline and 106 in another session's baseline; all pass at 30 s. This is load sensitivity, not failure. CI needs a higher timeout (P1-10).

**Missing tests:** E2E sign-in → label → Print & Save → stock deduction; cross-role authorization enumeration; two-tenant isolation; staging DB; physical print.

---

## 9. Performance & reliability (risks, not measurements)

No load test exists, so every item here is a **risk requiring load testing** (P1-13).

| Area | Observation |
|---|---|
| Patient list | Unpaginated `select('*')` of all customers |
| Product search | `ilike '%term%'` on name (`products.service.ts:65`); a trigram index is not evident, so it will scan on large catalogues |
| Stock races | Transactional functions lock rows (tested locally on 2026-10-10); the legacy prescription path depends on compensation |
| Session expiry | Staff are signed out about hourly, interrupting dispensing |
| Network loss | Workstation errors are surfaced; the UI is not offline-capable; fonts load from Google |
| Printer failure | No print-job confirmation from the browser; "Print & Save" records the print before the physical outcome is known |
| Web test suite | ≈230 s on this machine; slow but passing |

---

## 10. Production readiness

| Area | Verdict |
|---|---|
| Functional completeness | PARTIALLY READY (no POS, users, void, exports) |
| Clinical workflow correctness | NOT VERIFIED (wording sign-off pending) |
| Security | NOT READY (S-1…S-8) |
| Database safety | PARTIALLY READY (functions and RLS good; tenancy, reconciliation and backups missing) |
| Reliability | NOT VERIFIED |
| Printing | NOT VERIFIED (physical) |
| UI/UX | PARTIALLY READY (workstation 8/10 per the latest report; admin screens: see the UI audit) |
| Testing | PARTIALLY READY (unit strong; no E2E or CI) |
| Deployment | NOT READY (no staging, monitoring or backups) |
| Operational support | NOT READY (no remote, no runbook execution) |

**Verdicts by stage:**

| Stage | Verdict |
|---|---|
| Local development | **READY** |
| Internal demonstration (UI-test mode) | **READY** |
| Isolated staging | **NOT READY**: needs P0-01, P0-02, P0-05 first |
| Controlled pharmacy pilot | **NOT READY**: all P0 items |
| Production | **NO-GO** |

Details in `PHARMACY_PRODUCTION_READINESS_REPORT.md`.

## 11. What this audit could not verify

- Admin screens at tablet and phone sizes, and the three detail pages. The shared dev server slowed to 10–60 s per page and its render worker crashed once, so the live sweep was stopped (see `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md` §4).
- The database against a live PostgreSQL (§5).
- Staging behaviour (no project).
- The physical printer.
- Real Supabase Auth sessions.
- Dashboards with real data.
- Real-hardware Sinhala rendering.
- Performance under load.
- Screen-reader behaviour.
