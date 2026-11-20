# Pharmacy Label SaaS — Admin Settings Completion Report

**Milestone 2: Admin settings** · 2026-10-30 · branch `codex/phase1-safety-fixes` (uncommitted)

Nothing in this milestone was committed, pushed or deployed. No remote database was used, and no migration was added. The existing `pharmacy_settings` table (migration `20261010000200`) is used as it is.

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Pharmacy profile (name, address, contact number) | **COMPLETE (local)** | Loaded, edited, validated, saved per changed field, admin only |
| Pharmacy email, registration details | **PENDING (migration approval)** | No columns exist; not invented |
| Label settings | **PENDING (Q-S1)** | Read-only panel. Printed output unchanged |
| Printer settings | **COMPLETE (local)** for what the app controls | Stores a printer reference name; browser-managed settings are listed as guidance, not claimed as controlled |
| Inventory settings | **PENDING (decision Q-S3, new)** | Stored values shown read-only; nothing in the app reads them yet |
| Security and authorization | **COMPLETE (local)** | Read: admin, pharmacist, staff. Write: admin. Cashier and role-less accounts: 403 before any query |
| UI/UX | **COMPLETE (local)** | Section navigation, loading, validation, save confirmation, unsaved-change warning, read-only mode |

## 2. What the existing code showed (verified before changing anything)

- `pharmacy_settings` is a single row (`id = TRUE`) with: `pharmacy_name`, `address`, `phone`, `timezone`, `label_width_mm`, `label_height_mm`, `printer_name`, `sms_enabled`, `sms_sender_id`, `low_stock_alerts_enabled`, `expiry_alert_days` (CHECK 1–365), `updated_at`, `updated_by`. RLS is enabled (the API's service role bypasses it), and an audit trigger writes changed field names to `audit_log`.
- Nothing read or wrote the table before this milestone.
- The printed label footer comes only from `NEXT_PUBLIC_PHARMACY_NAME/ADDRESS/PHONE` (`apps/web/lib/pharmacyBranding.ts`, used by `components/PrintableLabel.tsx`).
- `timezone` feeds the database function `pharmacy_today()`, which the expiry checks use. Editing it would change expiry validation, so it stays read-only.
- The expiry alert window is fixed at 30 days in `admin.service.ts`, `inventory.service.ts` and the dashboard text. Low-stock alerts are always on. So `expiry_alert_days` and `low_stock_alerts_enabled` have no effect today.

## 3. Features implemented

### API: `apps/api/src/settings/` (new module)

| Route | Roles | Behaviour |
|---|---|---|
| `GET /admin/settings` | admin, pharmacist, staff | Returns the row's display columns (SMS columns are excluded; SMS stays server-configured). A missing row → 404 `SETTINGS_MISSING`; the API never creates one |
| `PATCH /admin/settings` | **admin only** | Accepts `pharmacy_name`, `address`, `phone`, `printer_name` and optional `expected_updated_at` |

PATCH rules:
- **Partial:** only the fields sent are considered, and only those whose trimmed value differs from the saved one are written. If nothing changed, there is no write and the response is `changed: []`.
- **Clearing:** an empty string or `null` clears a value.
- **Exact wording:** only surrounding whitespace is trimmed. Sinhala text is kept exactly.
- **Validation (server side, `class-validator`):**
  - Name: at most 120 characters, one line.
  - Address: at most 300 characters, one line.
  - Phone: 7–20 digits, spaces or dashes, optional leading `+`.
  - Printer name: at most 100 characters, one line.
- **Read-only fields are refused, not silently dropped:** sending `timezone`, `label_width_mm`, `label_height_mm`, `expiry_alert_days`, `low_stock_alerts_enabled`, `sms_enabled`, `sms_sender_id`, `updated_by`, `updated_at` or `id` → 400 naming the field.
- **No silent overwrite:**
  - A stale `expected_updated_at` → 409 `SETTINGS_CHANGED`.
  - The UPDATE is also conditional on the loaded `updated_at`, so a save that lands between read and write → 409.
- **Audit:**
  - `updated_by` is set to the acting admin.
  - The existing trigger records the changed field names in `audit_log`. Its `actor_id` is NULL for PostgREST writes, which is why `updated_by` matters.
  - The API logs `pharmacy settings updated by <user id>: <fields>`. Field names only, no values.
- **Database errors** are mapped by the shared `toHttpError`:
  - Unreachable → 503.
  - CHECK violation → 400.
  - Schema missing → 503 `SCHEMA_OUT_OF_DATE`.

### Web: `/admin/settings`

| Section | Content |
|---|---|
| Section navigation | Anchor links: Pharmacy profile, Label, Printer, Inventory, System and account. They scroll horizontally on narrow screens |
| Pharmacy profile | Editable form for name, address and contact number, with its own Save and Discard. Includes a "Last saved" time and a note that printed labels do not use these details yet (Q-S1). Says that email and registration need an approved database change |
| Label | Read-only: 70 × 50 mm (fixed), the source of the pharmacy details on labels (server configuration), and the name, address and phone actually printed (from the environment). States that wording, dosage, size, Print only, Print & Save and reprints are unaffected |
| Printer | **Stored by the application:** the printer reference name (editable). **Chosen in the browser's print dialog:** printer, 70 × 50 mm paper, margins None, scale 100%, headers and footers off. States that browsers do not let a web app choose or configure a printer |
| Inventory | Read-only stored values: expiry window, low-stock alerts, timezone. Shows that the expiry window in use is fixed at 30 days. Marked "Pending decision". Says that stock rules are not configurable |
| System and account | The existing status checks, account card and roles card, unchanged except that the roles text now says administrators change pharmacy settings |

UX behaviour:
- **Loading:** a skeleton while loading. A failed load shows an error with Retry; an empty form is never shown in its place.
- **Validation:** client-side checks mirror the API rules. Errors show under each field, with `aria-invalid` and `aria-describedby` set through the shared `FormField`.
- **Saving:** Save is disabled until something changes. Only that section's changed fields are sent, so unsaved edits in the other section are kept. Saving shows a toast plus an "All changes saved" / "Unsaved changes" status line (`aria-live`).
- **Failures:** a failed save shows an inline "Not saved" alert with the server message and keeps the edits. A 409 conflict adds a "Reload settings" button. A thrown request counts as a failure, never as a success.
- **Unsaved changes:** while there are unsaved edits, the browser prompts before reload or close, and in-app links ask for confirmation. In-page section links and new-tab clicks are not intercepted.
- **Keyboard:** Enter submits a section, and everything is reachable with Tab.
- **Read-only mode:** pharmacists, staff, accounts without a role, and the state while the role is still loading all get read-only inputs, no Save button, and an explanation.
- **Tablet:** controls are 40 px or taller, cards stack in one column, and the navigation scrolls.

## 4. Files changed

| File | Change |
|---|---|
| `apps/api/src/settings/settings.module.ts` | **New** |
| `apps/api/src/settings/settings.controller.ts` | **New.** `GET`/`PATCH /admin/settings` with explicit `@Roles` |
| `apps/api/src/settings/settings.service.ts` | **New.** Load, partial conditional update, conflict, audit log line |
| `apps/api/src/settings/dto/update-settings.dto.ts` | **New.** Validation and the read-only field refusals |
| `apps/api/src/settings/settings.spec.ts` | **New.** 39 tests |
| `apps/api/src/app.module.ts` | Registers `SettingsModule` (2 lines) |
| `apps/api/src/auth/route-authorization.spec.ts` | +5 tests for settings routes |
| `apps/web/app/actions/settings.ts` | **New.** `getPharmacySettings`, `updatePharmacySettings` |
| `apps/web/lib/pharmacySettings.ts` | **New.** Types, draft/diff, validation mirroring the API |
| `apps/web/lib/useUnsavedChangesWarning.ts` | **New.** beforeunload and link-click guard |
| `apps/web/app/admin/settings/page.tsx` | Rebuilt with the sections above; the status, account and roles cards are kept |
| `apps/web/app/admin/settings/page.test.tsx` | **New.** 16 tests |
| `apps/web/lib/pharmacySettings.test.ts` | **New.** 13 tests |
| `apps/web/components/SettingsLabelIsolation.test.tsx` | **New.** 4 tests |

**Not touched:**
- `PrintableLabel.tsx`, `pharmacyBranding.ts` and the label workstation
- Dosage and Sinhala logic
- Inventory services and POS
- Migrations and `fake-supabase.ts`

## 5. Tests added (77: API 44, web 33)

| File | Covers |
|---|---|
| `settings.spec.ts` (39) | Load by admin, pharmacist and staff. Cashier, unknown-role and role-less accounts refused before the database. Missing row (no insert). DB failure. Partial update with `updated_by`. No-op without a write. Clearing. Sinhala preserved. Printer name. Persistence (PATCH then GET). Pharmacist, staff, cashier, unknown and role-less accounts refused on PATCH with no DB call. 8 validation rejections. 7 read-only field refusals. Empty body. Stale version → 409. Concurrent write between read and update → 409 and the other save is kept. Failed write → 503 with the row unchanged. CHECK violation → 400 |
| `route-authorization.spec.ts` (+5) | Cashier refused on GET and PATCH. Staff and pharmacist can read but are refused on PATCH before the DB. Admin allowed. The app-wide enumeration also covers both routes for cashier, unknown-role and role-less accounts |
| `page.test.tsx` (16) | Loading state and values. Failed load + Retry. Section navigation. Read-only for pharmacist, staff and role-less accounts. Changed-field-only save with version and confirmation. Enter key. Printer save that keeps profile edits. Save disabled when clean, and Discard. Invalid phone. Server error keeps edits. Thrown request. 409 → Reload. Unsaved-change warning (beforeunload and links, confirm accept and decline, cleared after Discard). In-page links not intercepted |
| `pharmacySettings.test.ts` (13) | Draft, diff (trim, clear, per-section, Sinhala), validation rules |
| `SettingsLabelIsolation.test.tsx` (4) | **Printed label unchanged:** the 70 × 50 mm label still prints the environment name, address and phone. `PrintableLabel.tsx`, `pharmacyBranding.ts` and `app/label/page.tsx` do not reference the settings action or API |

## 6. Test results (run sequentially: API first, then web)

| Check | Result |
|---|---|
| API Jest (`--runInBand`) | **375/375, 31 suites** (baseline 331/30 + 44) |
| API `tsc --noEmit` | Pass |
| API ESLint (changed files) | Pass |
| Web Vitest (`--testTimeout=30000`) | **2,118/2,121** in the full run, 71 files. 3 failures, all timeouts under load in files this milestone did not touch (`ProductTypeSelection.test.tsx` ×1, `PosWorkstation.test.tsx` ×2); both files then passed alone, **47/47**. All 33 new settings tests passed in the full run. The pre-existing POS unhandled rejection is still present |
| Web `tsc` (changed files) | Pass |
| Web ESLint (changed files) | Pass |

### Pre-existing issues (reported separately, not caused by this milestone)

**POS Vitest unhandled rejection.** `components/pos/PosWorkstation.test.tsx`, test "shows a search failure as an error with Retry, never as an empty list". It reproduces when that file runs alone, so machine load is not the cause.

- **Root cause:**
  1. The test types `pana`, which schedules the debounced type-ahead search (`PosWorkstation.tsx:212`).
  2. It then presses Enter, which runs a search immediately (`:225`) without cancelling that pending timer.
  3. The Enter search consumes the test's single `mockResolvedValueOnce`.
  4. When the debounce fires, `searchPosCatalog` is the reset mock and returns `undefined`.
  5. `res.ok` at `:176` then throws.
- **Production impact:** a real server action always returns an `ApiResult`, so this cannot crash in production. It does mean that **Enter followed by the debounce sends the same search twice**. The second result is the same, so nothing visibly breaks.
- **Suggested fix** (for the POS owner; these files belong to another session and were not modified):
  - Either clear the pending type-ahead timer when Enter runs a search,
  - or give the test a default `mockResolvedValue` for the second call.

**Load-sensitive Reasons test.** `apps/api/src/reasons/reasons.spec.ts` passed in this run (in-band). It is not affected by this work.

**Load-sensitive web tests seen in this run** (untouched files; each passed when rerun alone):
- `components/ProductTypeSelection.test.tsx`, "search selects Pethi and displays පෙති": the `findByRole` lookup timed out.
- `components/pos/PosWorkstation.test.tsx`, "shows only the latest search when responses arrive out of order" and "shows a search failure as an error with Retry": the full suite ran each over 4.9 s.

## 7. Settings persistence status

| Setting | Persisted | Applied by the app |
|---|---|---|
| Pharmacy name, address, phone | ✓ `pharmacy_settings` | **No.** Labels use the environment until Q-S1 |
| Printer reference name | ✓ | Shown to staff on the settings page only (by design) |
| Expiry alert days, low-stock alerts | Existing values shown, not editable | No (fixed 30 days; always on) |
| Timezone | Shown, not editable | Yes, by `pharmacy_today()`; deliberately locked |
| Label width/height | Not exposed | No (layout fixed at 70 × 50 mm) |

**Not verified:**
- **Against a real database:** the local Supabase stack was not running (`127.0.0.1:54321` refused), and the remote database was not used. The update uses `.eq('updated_at', …)` against a `timestamptz` value echoed back from PostgREST; check this conditional update on staging, including a save with no intervening change.
- **In a browser with data:** UI-test mode disables the backend, so the page shows its load-error state there. Behaviour is covered by the component tests.

## 8. Remaining business decisions

| ID | Decision | Owner | Blocks |
|---|---|---|---|
| **Q-S1** (existing) | Should printed labels take the pharmacy name, address and phone from these settings instead of the environment? Changes printed output, so it needs a print check | Owner + pharmacist | Label branding from settings |
| **Q-S3** (new) | Should dashboards and alerts use `expiry_alert_days` and `low_stock_alerts_enabled` instead of the fixed 30 days / always on? If yes, those two fields become editable | Owner + pharmacist | Inventory settings editing |
| **Q-S4** (new) | Should the pharmacy profile store email and registration details (council/licence number)? Needs a migration | Owner | Email and registration fields |
| Q-S2 (existing) | Custom roles. A read-only matrix is kept | Owner | — |

## 9. Module completion score

Admin & settings capabilities (audit baseline 36%):

| Capability | Before | Now |
|---|---|---|
| Reasons catalogue | 1 | 1 |
| System status / account / roles matrix | 1 | 1 |
| Pharmacy profile (stored, editable) | 0 | **1** |
| Label settings | 0.5 (static info) | **0.5** (accurate read-only; branding source pending Q-S1) |
| Printer settings | 0 | **1** (everything the app can control) |
| Inventory settings | 0 | **0.5** (visible; editing pending Q-S3) |
| Settings authorization + audit | 0 | **1** |
| Audit-log viewer | 0 | 0 (Milestone 3) |
| User management | 0 | 0 (Milestone 4, Q-A2) |

**Admin & settings: 6 / 9 = 67%** (was 36%). Settings alone, without the audit viewer and user management: **5 / 6 = 83%**, with the remainder being decisions Q-S1 and Q-S3.

## 10. Next recommended module

**Milestone 3: Audit-log viewer** (`GET /admin/audit-log?entity=&from=&to=&page=`, admin only). The `audit_log` table already records the settings and patient edits made in Milestones P-1 and 2, so the viewer needs no migration, and it makes the new `updated_by` / changed-fields trail visible. While doing it, consider having the API set `app.user_id` inside the transactional functions so `audit_log.actor_id` is filled. That would be a database change, so it needs approval.
