# Phase 0 — Safety, Data-Integrity and Security Findings

Date: 2026-10-10 · Branch: `feature/ui-ux-redesign` · Baseline: tag `baseline-pre-redesign`

**Status: not production-ready.** Items marked Critical are production blockers.

---

## 1. Security findings

### S1. Authentication guard fails open — Critical (production blocker)
- **File:** `apps/api/src/auth/auth.guard.ts` (registered globally via `APP_GUARD` in `app.module.ts`)
- **Issue:** When `NODE_ENV` is unset or `development`, a request with **no token or an invalid token** is accepted and assigned a placeholder user. `start:prod` (`node dist/main`) does not set `NODE_ENV`, so a default production start runs with authentication effectively disabled.
- **Impact:** Anyone who can reach the API can read and modify patients, prescriptions and stock. The API uses the Supabase secret (service-role) key, which bypasses Row Level Security, so there is no second line of defence.
- **Remediation:** Fail closed: reject missing/invalid tokens unconditionally. If a development bypass is needed, gate it on an explicit opt-in variable (e.g. `AUTH_DEV_BYPASS=true`) that is also refused when `NODE_ENV=production`. Set `NODE_ENV=production` in the start script. Add tests for missing, malformed and expired tokens.

### S2. No role or permission model — High
- **Files:** entire `apps/api/src` (no role/permission checks exist); `apps/web/middleware.ts` only checks that a cookie is present.
- **Impact:** Every authenticated user can perform every action, including stock write-offs and adjustments. There is no separation between pharmacist and admin duties, and no per-user audit attribution beyond the token.
- **Remediation:** Define roles (e.g. pharmacist, admin), store them in Supabase `app_metadata`, enforce with a Nest `RolesGuard`, and hide unavailable actions in the UI. Requires a schema/auth design decision.

### S3. Hardcoded credentials — Critical (rotate now)
Values are intentionally not reproduced here.

| Location | What was hardcoded | Status |
|---|---|---|
| `apps/api/create_admin.js` | Supabase project URL, a **Supabase secret key (`sb_secret_…`)**, an admin email and password | Removed before the first commit of this repository; script now reads environment variables |
| `apps/web/app/login/page.tsx` | Admin email and password, pre-filled and displayed on the login screen | Removed before the first commit |

- **Impact:** The secret key grants full database access. The admin password was shown to anyone who opened the login page.
- **Remediation (owner action required):**
  1. Rotate the Supabase secret key in the Supabase dashboard and update `apps/api/.env`.
  2. Change the admin account password; review Supabase Auth users for unknown accounts.
  3. Treat the backup archive `../pharmacy-label-backup-20261009-pre-redesign.tar.gz` as sensitive: it contains the original files and `.env` files. Do not share or upload it.
- **Also noted:** the backend falls back to the placeholder key `dummy_key` when env vars are missing (`supabase.service.ts`); it should refuse to start instead.

### S4. Hardcoded prescription product dictionary — High (patient safety)
- **File:** `apps/api/src/prescriptions/prescriptions.service.ts` (`HARDCODED_PRODUCTS_MAP`), duplicated in `products.service.ts` (`HARDCODED_PRODUCTS`).
- **Issue:** When a product is not found in the database (or the query fails), dispensing validation uses a built-in list of 21 products with **unverified expiry dates, stock levels and batch numbers**. Product search also merges this list into real results, so these entries are offered to pharmacists alongside real stock.
- **Impact:** Expiry and stock checks can pass against invented values; invented expiry dates can reach labels.
- **Remediation:** Remove the dictionary from runtime code. If the 21 product names are a real requested catalogue, import them into the database with verified data.

---

## 2. Backend data-integrity findings (frontend cannot fully compensate)

The frontend no longer fabricates data (see §4), but several API endpoints still return invented data **with HTTP 200**, which the UI cannot distinguish from real data. The affected pages show a "Figures not verified" notice until this is fixed.

| # | Severity | Endpoint / file | Behaviour |
|---|---|---|---|
| D1 | High | `GET /admin/dashboard/summary` — `admin.service.ts` | `todayPrescriptions \|\| 124` etc.: a real count of 0 is replaced by an invented number; comparison texts ("+12.4% vs yesterday") are constant |
| D2 | High | `GET /admin/dashboard/activity` | Every day is seeded with `Math.random()` values; `items = labels × 1.6` |
| D3 | High | `GET /inventory/summary` — `inventory.service.ts` | Zero counts and valuation replaced by invented values (1,284 products, LKR 6.32M, …) |
| D4 | High | `GET /admin/health` | Always reports API, database, SMS and printer as healthy without checking anything |
| D5 | High | Customers service | Four hardcoded people (names + phone numbers) merged into every patient list/search; SMS can be sent to them |
| D6 | High | `GET /labels` — `labels.service.ts` | Returns `SAMPLE_LABELS` when the query fails |
| D7 | Critical | `POST /prescriptions` (non-production) | On a database failure returns a fabricated "saved" prescription; the workstation then prints the label as if it were saved. With `NODE_ENV` unset this applies in production too |
| D8 | Critical | `POST /inventory/receipts`, `POST /inventory/adjustments` | Catch-all returns `{ success: true, message: '… (simulated)' }` on any error; database write errors are never checked |
| D9 | Critical | `ReceiveStockDto`, `StockAdjustmentDto`, `CreateSupplierDto` | No class-validator decorators. With the global `ValidationPipe({ whitelist: true })` the request body is stripped to `{}` (verified). **Stock receiving, stock adjustments and supplier creation cannot work at all**; they fall into the simulated/placeholder fallbacks |
| D10 | High | `POST /suppliers` | On insert failure returns an invented supplier (`id: sup_<timestamp>`) with HTTP 201 |
| D11 | Medium | ~20 other `catch { /* Fallback */ }` blocks across services | Errors swallowed; empty or default data returned |

**Remediation:** remove all fabricated fallbacks; throw `ServiceUnavailableException` / `InternalServerErrorException` on database errors; check every Supabase `error`; add class-validator decorators to the three DTOs; make GRN receiving and adjustments transactional (database function/RPC). Requires backend approval.

---

## 3. Label workstation findings

| # | Severity | Finding | Status |
|---|---|---|---|
| W1 | Critical | **ADD EXP DATE invented an expiry** of "today + 1 year" when the product was not in the 21-item list, and printed it | **Fixed (approved).** Expiry now comes only from the product's API record or is entered by the pharmacist |
| W2 | High | Printed label and label builder looked up expiry in the hardcoded list | **Fixed (approved)** |
| W3 | High | Bottom bar displayed the expiry `1/8/2028` when none was set | **Fixed:** shows "Not set" |
| W4 | High | Changing the medicine kept the previous medicine's expiry | **Fixed:** a catalogue expiry is cleared when the product changes; a manually entered expiry is kept |
| W5 | High | Medicine search mixed in the 21 hardcoded products; patient search/Quick Select offered 4 hardcoded people | **Fixed (approved)** in the frontend; backend still merges them (see S4, D5) |
| W6 | High | **STAT dose workflow appears unreachable.** `StatPanel` renders only when `activeControl === 'stat'`, and nothing sets that value (`startStat()` only creates an empty STAT entry). Tapping STAT highlights the tile but no quantity or follow-up panel opens. The October audit describes this flow as working, so this is likely a regression. Confirmed in code and by `StatFlow.test.tsx`; not yet confirmed in the running app | **Not changed — needs approval** |
| W7 | Medium | Touch number pad has no backspace key; header text changed. `NumberPad.test.tsx` (2 tests) still expects them | **Not changed — needs decision:** restore the key, or update the tests to the current design |

---

## 4. Frontend changes made in Phase 0

- **Data layer:** every server action now returns `ApiResult` (`{ ok, data } | { ok: false, error }`). All fabricated fallbacks removed. List endpoints reject non-array responses instead of treating them as empty. Responses with `success: false` or a "(simulated)" message are treated as failures. Logs contain method, path and status only; no tokens, payloads or query strings (patient names/phone numbers).
- **UI states:** every admin page distinguishes loading, error (with Retry), empty and success. Missing values show "—" instead of invented defaults.
- **Fake operations disabled:** Add Medicine (no create endpoint), admin Reprint (logged a reprint without printing), settings save (no endpoint). Supplier creation, GRN and adjustments now report the server's real result; they currently show an error because of D9.
- **Fake status removed:** sidebar "System Operational", header notifications, fake user identity, health bars, fake printer status, fake activity logs, User Management / Activity Logs nav items. Settings shows live API and database checks (`/health`, `/health/db`) and whether an SMS token is configured.
- **Clinical text:** prescription detail no longer substitutes an invented Sinhala instruction, dosage or quantity. Patient profile no longer claims "No known drug allergies" when notes are empty, and no longer shows an invented penicillin allergy on load failure.
- **Stock actions:** expired-batch write-off and adjustments ask for confirmation. The adjustment justification typed by the user is now sent as the recorded reason (it was previously discarded).

## 5. Test environment fix

- **Root cause:** `vitest.config.mjs` ran every test in the `node` environment (no DOM), and `jsdom@30` requires Node ≥ 22.22 while this machine runs Node 20.17. `vitest.setup.ts` was never loaded.
- **Fix:** jsdom pinned to 26.1.0; component tests (`*.test.tsx`) run in jsdom; setup file loaded with explicit cleanup; `@/` alias added. One test-isolation defect fixed in `DosageRow.test.tsx`. No assertions changed or removed.
- **Result:** 82 passing; 6 genuine failures remain (W6: 4 tests, W7: 2 tests).
- **Recommendation:** upgrade Node to 22 LTS (≥ 22.22) on all machines; jsdom can then be unpinned.

## 6. Other notes
- `middleware.ts` is deprecated in Next 16 (rename to `proxy.ts`).
- `@vitejs/plugin-react@6` expects Vite 8; Vitest 2 ships Vite 5/6 (pre-existing peer warning).
- The top-bar global search navigates with `?search=` but no page reads it (Phase 2).
- `/admin/products` and `/admin/inventory/products` are near-duplicates (consolidate in Phase 4 after confirmation).
