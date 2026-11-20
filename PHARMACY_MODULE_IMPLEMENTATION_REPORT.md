# Pharmacy Label SaaS — Module Implementation Report

One section per completed module, newest first. Nothing in this report has been committed, pushed, deployed or run against a remote database.

---

## Milestone 3 — Admin audit log viewer (2026-10-30)

Full report: `PHARMACY_ADMIN_AUDIT_LOG_VIEWER_REPORT.md`.

### Scope

- A read-only viewer for the existing `audit_log` table.
- No migration, no trigger change, no audit row changed.
- No change to printed labels, clinical logic, inventory rules or POS.

### Features completed

| Feature | Status |
|---|---|
| `GET /admin/audit-log`: server pages (max 100 per page, page ≤ 200), newest first with an id tie-break, filters for local date range, action, module, user (including "not recorded") and exact record reference. Validated input; 503 on failure, never an empty list | Complete (local) |
| `GET /admin/audit-log/:id`: one event; 400 for a malformed id, 404 for an unknown one | Complete (local) |
| Administrator-only access on both routes, enforced by the API. Pharmacist, staff, cashier, unknown-role and role-less accounts refused before the database; anonymous 401 | Complete (local) |
| Defensive output: fixed column list; changed-field entries that are not column names withheld and counted; non-id record references removed | Complete (local) |
| `/admin/audit-log` page: filters, pagination, loading, empty, filtered-empty, error + Retry, administrators-only message, responsive columns, 40 px touch targets, keyboard access | Complete (local) |
| Read-only details dialog with only recorded data, links to the affected patient, medicine or settings page, and "all changes to this record / by this user" shortcuts | Complete (local) |
| Previous and new values | **Not available.** The table stores field names only, by design |
| User for patient, medicine, supplier, return and settings changes | **Not recorded** by the database for PostgREST writes (G-1); shown as "Not recorded". Fix needs a migration |
| Database-enforced immutability of `audit_log` | **Risk (I-1).** Not enforced; migration proposed, not applied |

### Files changed

- **New:**
  - `apps/api/src/audit/` (module, controller, service, DTO, spec)
  - `apps/web/app/actions/audit.ts`
  - `apps/web/lib/auditLog.ts` (+ test)
  - `apps/web/app/admin/audit-log/page.tsx` (+ test)
- **Modified:**
  - `apps/api/src/app.module.ts` (module registration)
  - `apps/api/src/auth/route-authorization.spec.ts` (+8 cases)
  - `apps/web/lib/roles.ts` (`ADMIN_ROLES`)
  - `apps/web/components/shell/nav.ts` (admin-only link) and `nav.test.ts`

### Tests added: 105 (API 65, web 40)

Pagination, filtering, sorting, authorization for every role, sensitive-field withholding, empty results, invalid parameters, API failures, event details, read-only guarantees, and responsive layout.

### Results

| Check | Result |
|---|---|
| API Jest (in band) | **440/440**, 32 suites |
| Web Vitest | **2,157/2,161** in the full run, 73 files (all 38 new audit tests passed). The 4 failures are timeouts under load in files this milestone did not touch, and they differ between runs (run 1: `ProductTypeSelection`, `PosWorkstation`; run 2: `PosWorkstation`, `app/admin/page.test.tsx`, two label workflow tests). Each file passes alone (StatWorkflow 96/96, dashboard 5/5, settings 16/16, AppShell 9/9). The pre-existing POS unhandled rejection is still present. An earlier run found 3 audit tests timing out under load; they now use `asyncUtilTimeout: 5000`, as `PosWorkstation.test.tsx` does |
| API tsc, ESLint (changed files) | Pass |
| Web tsc, ESLint (changed files) | Pass |
| `next build` | Pass (`/admin/audit-log` built) |
| Real database | **NOT VERIFIED** (local Supabase not running; no remote access) |

### Functional completion

Admin & settings **67% → 78%**.

### Next recommended module

**Milestone 4: User management** (needs decision Q-A2). Not started. Before or alongside it, consider approving the audit migration in `PHARMACY_ADMIN_AUDIT_LOG_VIEWER_REPORT.md` §6 (immutability) and the G-1 fix, so that the viewer can show who made each change.

---

## Milestone 2 — Admin settings (2026-10-30)

Full report: `PHARMACY_ADMIN_SETTINGS_COMPLETION_REPORT.md`.

### Scope

- Pharmacy profile, label, printer and inventory settings on the existing `pharmacy_settings` table.
- No migration.
- No change to printed labels, clinical logic, inventory rules or POS.

### Features completed

| Feature | Status |
|---|---|
| `GET /admin/settings` (admin, pharmacist, staff) and `PATCH /admin/settings` (admin only) | Complete (local) |
| Pharmacy profile form: name, address, contact number. Partial save of changed fields only, server and client validation, optimistic concurrency (409 on a stale or concurrent save), `updated_by` + audit trigger + field-name log line | Complete (local) |
| Printer settings: printer reference name stored by the app. Browser-managed print-dialog settings shown as guidance, explicitly not controlled | Complete (local) |
| Label settings panel: fixed 70 × 50 mm, details actually printed (environment) | **Pending Q-S1** (read-only by design) |
| Inventory settings panel: stored expiry window, low-stock alerts, timezone | **Pending Q-S3** (read-only; the API refuses edits) |
| Email and registration details | **Pending Q-S4** (no columns; not invented) |
| Settings UI: section navigation, loading, error + Retry, read-only mode for non-admins, save confirmation, Discard, unsaved-change warning (reload, close and in-app links), Enter to save | Complete (local) |

### Files changed

- **New:**
  - `apps/api/src/settings/` (module, controller, service, DTO, spec)
  - `apps/web/app/actions/settings.ts`
  - `apps/web/lib/pharmacySettings.ts` (+ test)
  - `apps/web/lib/useUnsavedChangesWarning.ts`
  - `apps/web/app/admin/settings/page.test.tsx`
  - `apps/web/components/SettingsLabelIsolation.test.tsx`
- **Modified:**
  - `apps/api/src/app.module.ts` (module registration)
  - `apps/api/src/auth/route-authorization.spec.ts` (+5 cases)
  - `apps/web/app/admin/settings/page.tsx` (rebuilt; status, account and roles cards kept)

### Tests added: 77 (API 44, web 33)

Loading, updating, validation, partial updates, authorization (every role, plus accounts without a role), failed requests, conflicts, unsaved changes, persistence, and that printed label output is unchanged.

### Results

| Check | Result |
|---|---|
| API Jest (in band) | **375/375**, 31 suites |
| Web Vitest | **2,118/2,121** in the full run, 71 files. 3 failures, all timeouts under load in files this milestone did not touch (`ProductTypeSelection.test.tsx` ×1, `PosWorkstation.test.tsx` ×2); both files then passed alone, **47/47**. All 33 new settings tests passed in the full run. The pre-existing POS unhandled rejection is still present |
| API tsc, ESLint (changed files) | Pass |
| Web tsc, ESLint (changed files) | Pass |

**Pre-existing POS unhandled rejection: root cause found, not fixed (another session's files).** In `PosWorkstation.test.tsx`, Enter runs a search without cancelling the pending debounced type-ahead. The second call hits a reset mock that returns `undefined`. In production this means a duplicate request, not a crash.

### Functional completion

Admin & settings **36% → 67%**.

### Next recommended module

**Milestone 3: Audit-log viewer.** It needs no migration and surfaces the settings and patient change trail.

---

## Milestone P-1 — Patient management (2026-10-30)

### Scope (from the approved roadmap)

P1-03 (patient edit, duplicate warning) and S-5 (the patient list returned the whole table). **Not in scope:** soft delete or archive, which needs decision **Q-P1** (`PHARMACY_MASTER_FEATURE_COMPLETION_PLAN.md` §5); patient deletion is unchanged (admin only, hard delete, with confirmation).

**Rules followed, not invented:**
- Mobile numbers are deliberately **not unique**, because family members share phones (`docs/DATABASE_SCHEMA.md:39`). The duplicate check is therefore a warning that the user can accept, never a block or a database constraint.
- Prescriptions keep `patient_name_snapshot`, so editing a patient never changes what was printed.
- The allergy rule is the existing database CHECK (`customers_allergies_required_check`): "has allergies" requires a list.

### Features completed

| Feature | Behaviour |
|---|---|
| **Edit patient** | "Edit details" on the profile opens the same form used for registration, pre-filled. Only the changed fields are sent. Name and mobile number can be changed but not cleared; other text fields can be cleared. Changing the allergy status stamps `allergy_status_updated_at`. A status other than "has allergies" removes the stale allergy list, and the form says so before saving. Unknown patient → 404. No change → no write. The existing audit trigger on `customers` records which fields changed |
| **Paginated register** | `GET /customers?q=&page=&pageSize=` returns `{ items, total, page, pageSize }`: 25 per page by default, at most 100, ordered by name then id. The list page searches on the server 300 ms after typing stops and returns to page 1. An empty register, a search with no matches, a page emptied by concurrent changes, and a failed load (with Retry) are four distinct states |
| **Duplicate warning** | Before saving a new or changed number, `GET /customers/duplicates?phone=&excludeId=` returns patients with the same number, however it was typed (`077 123 4567`, `077-123-4567` and `+94771234567` match). The form lists them with links and asks the user to confirm ("Register as a new patient" / "Save anyway"). If the check itself fails, the form says so and offers "Save without checking". Changing the number resets the warning |
| **Bounded search** | `GET /customers/search` with an empty term now returns 400 instead of the whole register. Both callers (label workstation and patient panel) already refused to search with an empty term |

### Files changed

| File | Change |
|---|---|
| `apps/api/src/customers/customers.controller.ts` | `GET /customers` paginated; `GET /customers/duplicates`; `PATCH /customers/:id`; search no longer falls back to the full list |
| `apps/api/src/customers/customers.service.ts` | `list`, `findDuplicates`, `normalisePhone`, `update`; `findAll` removed (no remaining caller) |
| `apps/api/src/customers/dto/update-customer.dto.ts` | **New.** Partial edit DTO; `null` name, number or status rejected |
| `apps/api/src/customers/dto/list-customers.dto.ts` | **New.** Paging and duplicate-query DTOs |
| `apps/api/src/test-utils/fake-supabase.ts` | `ilike` now follows LIKE semantics (`%`, `_`, `\` escapes). Both existing callers use `%term%`, which behaves as before |
| `apps/web/app/actions/customers.ts` | `listPatients`, `findDuplicatePatients`, `updatePatient`; `getAllCustomers` removed (no remaining caller) |
| `apps/web/components/patients/PatientDialog.tsx` | **New.** Shared add/edit form with validation and the duplicate warning |
| `apps/web/app/admin/patients/page.tsx` | Server pagination and search; uses `PatientDialog` |
| `apps/web/app/admin/patients/[id]/page.tsx` | "Edit details" button and dialog; profile reloads after saving |

**Authorization:** the new routes carry no `@Roles`, so the fail-closed default admits only admin, pharmacist and staff, the same as registration. Cashiers and role-less accounts get 403 before any query. This is checked by the existing whole-app route enumeration and by two new explicit cases.

### Tests added (46: API 29, web 17)

| File | Tests |
|---|---|
| `apps/api/src/customers/customers.service.spec.ts` | +17: pagination (page, default, filter counts, past-the-end, failed count and page), duplicates (formats, self-exclusion, too short, failed lookup), update (partial, clear, allergy timestamp, allergy rule ×2, no-op, 404, failure) |
| `apps/api/src/customers/dto/customer-dto.spec.ts` | **New**, 10: partial body and whitelisting, 7 rejection cases, paging bounds, duplicate-query validation |
| `apps/api/src/auth/route-authorization.spec.ts` | +2: cashier refused on `PATCH /customers/:id` and `GET /customers/duplicates` |
| `apps/web/components/patients/PatientDialog.test.tsx` | **New**, 13: rules, register (no match, warn-then-confirm, re-check after a number change, failed check, failed save, invalid form), edit (changed fields only, duplicate check excluding self, allergy-removal notice, no-op close, unlisted gender kept) |
| `apps/web/app/admin/patients/page.test.tsx` | **New**, 4: server paging, debounced search from page 1, empty vs no-match, error with Retry |

### Results

| Check | Result |
|---|---|
| API Jest | **331/331**, 30 suites |
| Web Vitest | **2,088/2,088**, 68 files. One unhandled rejection from `components/pos/PosWorkstation.test.tsx`, also present in the baseline **before** this milestone (another session's file; not modified here) |
| API tsc, `nest build` | Pass |
| Web tsc | Pass for all source. `.next/dev/types/validator.ts` reports a stale generated-type mismatch caused by the live dev server; `next build` regenerates the types and passes |
| Web ESLint (changed files) | Pass |
| API ESLint (changed files) | No new type-safety errors in new code. Existing debt remains in untouched functions and in `fake-supabase.ts` (audit §8) |
| `git diff --check` | Pass |

### Not verified

- **Against a real database:** the local Supabase stack is not running (port 54321 refused), and no remote database was used. The queries use only operations already used elsewhere (`or`/`ilike`/`range`/`count: 'exact', head: true`). PostgREST behaviour of the interleaved `ilike` pattern on real rows should be checked on staging.
- **In a browser with data:** UI-test mode disables the backend, so the list shows its "unavailable" state there. Rendering with data is covered by component tests only.
- **Tablet/touch:** the dialog reuses the shared form components; no new measurement was taken.

### Remaining issues

1. **Q-P1:** archive instead of delete (S-10). Needs a migration and the owner's retention decision.
2. Search uses `ilike '%term%'` without a trigram index: fine for a single pharmacy's register, but a load-test item (P1-13).
3. The header's global search still routes names to medicines (U-3, unchanged).

### Functional completion

Patients **67% → 89%**. The remaining capability is tenant isolation (platform decision P0-03).

### Next recommended module

**Milestone 2: Admin settings** (pharmacy profile, label, printer and inventory settings on the existing `pharmacy_settings` table). No migration is needed. The form can be built and persisted without changing printed labels; switching the label's branding source waits for Q-S1.
