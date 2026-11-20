# Pharmacy Label SaaS — Admin Audit Log Viewer Report

**Milestone 3: Audit log viewer** · 2026-10-30 · branch `codex/phase1-safety-fixes` (uncommitted)

Nothing in this milestone was committed, pushed or deployed. No remote database was used. No migration, trigger or audit row was added, changed or removed. The viewer reads the existing `audit_log` table (migration `20261010000200`) as it is.

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Read-only audit log API | **COMPLETE (local)** | `GET /admin/audit-log` (paged, filtered) and `GET /admin/audit-log/:id`. No write route exists |
| Authorization | **COMPLETE (local)** | Administrators only, enforced by the API on both routes. Pharmacist, staff, cashier, unknown-role and role-less accounts get 403 before any query; anonymous and invalid tokens get 401 |
| Audit Logs page | **COMPLETE (local)** | `/admin/audit-log`: filters, server pagination, loading, empty, error and access states, responsive table |
| Event details panel | **COMPLETE (local)** | Read-only dialog showing only what the record holds |
| Previous / new values | **NOT AVAILABLE** | The audit log never stores values, by design. Nothing is shown or invented |
| "Result" of an action | **NOT AVAILABLE as a column** | The log only holds committed changes. The page says so; no result column is invented |
| Real-database integration | **NOT VERIFIED** | Local Supabase was not running (`127.0.0.1:54321` refused). Tested against the in-memory fake only |

## 2. What the existing implementation showed (checked before writing code)

### The `audit_log` table

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGSERIAL` | Primary key |
| `occurred_at` | `TIMESTAMPTZ` | Default `now()`. Indexed `DESC` |
| `actor_id` | `UUID` | From the transaction setting `app.user_id`. **NULL unless a database function set it** |
| `action` | `TEXT` | CHECK: `INSERT`, `UPDATE`, `DELETE` |
| `entity_type` | `TEXT` | The table name |
| `entity_id` | `TEXT` | The row's `id`. Index on `(entity_type, entity_id)` |
| `changed_fields` | `TEXT[]` | **Column names only**, for UPDATE. NULL for INSERT and DELETE. `updated_at` is excluded |

The migration states that values are deliberately not copied ("patient details stay in the patient table only"), and migration test `10_migration_tests.sql:69` asserts it. There is no `result`, `ip`, `old_values`, `new_values`, `pharmacy_id` or request-id column.

### Triggers

| Table | Trigger function | Operations | Actor source |
|---|---|---|---|
| `customers` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `products` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `suppliers` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `product_batches` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `pharmacy_settings` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `user_profiles` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `patient_returns` | `audit_row_change()` | INSERT, UPDATE, DELETE | `app.user_id` |
| `reasons` | `audit_reason_catalogue_change()` | INSERT, UPDATE (no DELETE) | `NEW.updated_by` (always set) |

`app.user_id` is set only inside the database functions `receive_stock`, `adjust_stock`, `create_prescription`, `quarantine_batch` and `release_batch`. Every other API write goes through PostgREST, so its audit row has **no user**.

Note: the `reasons` migration is headed "REVIEW ONLY: do not apply without approval". Whether it is applied in a given database was not verified; the viewer accepts `reasons` as a module either way.

### Access before this milestone

- RLS is enabled on `audit_log` with no policies, so `anon` and `authenticated` cannot read or write it through the Supabase REST API.
- The API's service role bypasses RLS.
- No API route, service or page read `audit_log`.

## 3. Features implemented

### API: `apps/api/src/audit/` (new module)

| Route | Roles | Behaviour |
|---|---|---|
| `GET /admin/audit-log` | **admin** | One page of events, newest first, with the total count |
| `GET /admin/audit-log/:id` | **admin** | One event. Unknown id → 404. Non-numeric, zero, negative or over-long id → 400 before the database |

`@Roles(Role.Admin)` is on the controller class, so it covers every route the controller has now or gets later. There is no POST, PUT, PATCH or DELETE route; a test asserts the controller registers exactly the two GET routes.

**Query parameters (all optional, validated by `class-validator`):**

| Parameter | Rule | Effect |
|---|---|---|
| `page` | Integer 1–200 | Page number |
| `pageSize` | Integer 1–100, default 25 | Rows per page |
| `from` | Real calendar date, `YYYY-MM-DD` | First local day included (pharmacy time zone, `PHARMACY_TIMEZONE`, default Asia/Colombo) |
| `to` | Real calendar date, `YYYY-MM-DD` | Last local day included. `from` after `to` → 400 `INVALID_RANGE` |
| `action` | `INSERT`, `UPDATE` or `DELETE` | Exact match |
| `entity` | One of the 8 audited tables above | Exact match on `entity_type` |
| `actor` | A user UUID, or `none` | `none` returns changes recorded without a user |
| `record` | 1–64 of letters, digits, `-`, `_` | Exact match on `entity_id`. Filter syntax and LIKE wildcards are refused |

**Behaviour:**
- **Sorting:** `occurred_at DESC, id DESC`. The id tie-break keeps pages stable when several events share a timestamp, so no event is skipped or repeated between pages.
- **Bounded:** at most 100 rows per request and page 200 at most (20,000 rows deep). Older events are reached by narrowing the dates. The table is never returned whole.
- **Count:** a separate `count: exact, head: true` query with the same filters, the same pattern as the patient list.
- **Columns:** only `id, occurred_at, actor_id, action, entity_type, entity_id, changed_fields` are selected. A column added later (for example old/new values) is not exposed until someone reviews it and adds it here.
- **User names:** looked up from `user_profiles.full_name` for the users on the page. If that lookup fails, events are still returned, identified by user id; the failure is logged by error code only.
- **Errors:** the shared `toHttpError` mapping. A failed count or page → 503 `DATABASE_UNAVAILABLE`, never an empty list. A missing table → 503 `SCHEMA_OUT_OF_DATE`. Database messages are never returned or logged.

**Response shape for one event:**

```json
{
  "id": "42",
  "occurred_at": "2026-10-30T08:00:00+00:00",
  "action": "UPDATE",
  "entity_type": "pharmacy_settings",
  "module": "Pharmacy settings",
  "entity_id": "true",
  "changed_fields": ["address", "phone", "updated_by"],
  "withheld_fields": 0,
  "actor": null
}
```

### Sensitive-data handling

The table holds no values, so there is nothing to redact today. The API adds three defensive checks so that a future trigger change cannot leak values through the viewer:

1. **Fixed column list.** Unknown columns (`old_values`, `new_values`, `password`, `access_token` in the tests) never reach the response.
2. **Changed fields must look like column names** (`^[a-z][a-z0-9_]{0,62}$`). Anything else, such as `Renamed Person` or `0771234567`, is withheld and counted in `withheld_fields`. The details panel says how many entries were withheld.
3. **Record references must look like ids** (`^[A-Za-z0-9_-]{1,64}$`). Anything else is returned as `null`.

Patient information shown: the patient's record id only (UUID). No name, phone, allergy or clinical text is read or returned. The details panel links to the patient page, which applies its own access rules.

### Web: `/admin/audit-log`

| Part | Content |
|---|---|
| Access check | Loads the signed-in user first. Non-administrators see "Administrators only" and **no request is made to the audit API**. A failed identity check shows an error with Retry. This is display only; the API enforces access |
| Navigation | "Audit log" under System, shown to administrators only (`ADMIN_ROLES`). Display only |
| Filters | From, To, Action, Module, User (All / Not recorded / a specific user set from the details panel), Record reference. Applied together with "Apply filters" or Enter; Clear resets. Client-side checks mirror the API (date order, record format, user id), with messages under each field (`aria-invalid`, `aria-describedby`). The browser's native date pop-ups are turned off (`noValidate`) so these messages are shown instead. Valid filters can also come from the page address, for example `?entity=customers&record=<id>`; invalid ones are ignored |
| Table | Date and time, Action (badge: Created / Updated / Deleted), Module, User ("Not recorded" when NULL), Record (short id; "Pharmacy settings record" for the settings row), Changed fields, Details button |
| Result | No column. The header says: "Each entry is a change that was saved; refused or failed attempts are not recorded." The details panel shows "Saved (the log only records changes the database committed)" |
| Pagination | Server pages of 25 with Previous / Next and "x–y of N". Capped at page 200 with a note to narrow the dates |
| States | Loading skeleton; empty log; empty filtered result with "Clear filters"; error with Retry (never shown as empty); a thrown request counts as a failure; stale data stays visible with "updating…" while a new page loads |
| Responsive | User, Record and Changed fields are hidden below `md`; Date, Action, Module and Details stay. Filters stack in one column on phones, two on tablets, six on wide screens. The details dialog becomes a bottom sheet on phones |
| Touch and keyboard | Details, Apply, Clear and pagination buttons and all filter inputs are 40 px high. Every control is a native button, input or select, reachable with Tab. The details dialog traps focus, closes with Escape and returns focus to the Details button |

### Event details panel (read-only dialog)

Loaded from `GET /admin/audit-log/:id`, so it shows exactly what the server holds.

| Shown | Source |
|---|---|
| Action performed | Badge plus the raw code |
| Date and time | Local format plus the raw stored timestamp |
| User | Name if a profile exists, plus the user id; otherwise "Not recorded" with an explanation |
| Module | Label plus the table name |
| Record reference | The id, linked to the patient, medicine or settings page where one exists |
| Result | "Saved", with the reason |
| Changed fields | Field names as recorded. For INSERT or DELETE, a sentence saying the log does not keep the fields or contents |
| Withheld entries | Count, if any |
| Values | An info box: "Previous and new values are not recorded" |
| Shortcuts | "All changes to this record" and "All changes by this user" / "All changes without a user" apply filters |

The panel has no inputs and no edit, delete or save action. Its description says "Audit events cannot be edited or deleted."

## 4. Audit event types supported

| Module | Table | Created | Updated (field names) | Deleted | User recorded? |
|---|---|---|---|---|---|
| Patients | `customers` | ✓ | ✓ | ✓ | **No** (PostgREST writes) |
| Medicines | `products` | ✓ | ✓ (includes `stock_quantity` changes made by the prescription service) | — no API delete | **No** |
| Suppliers | `suppliers` | ✓ | ✓ | — no API delete | **No** |
| Inventory batches | `product_batches` | ✓ | ✓ | — | **Yes**, through `receive_stock`, `adjust_stock`, `quarantine_batch`, `release_batch`, `create_prescription` |
| Patient returns | `patient_returns` | ✓ | ✓ (disposal) | — | **No** (PostgREST writes) |
| Pharmacy settings | `pharmacy_settings` | (migration seed) | ✓ (Milestone 2 form; `updated_by` appears as a changed field) | — | **No** in the log; the user is in `pharmacy_settings.updated_by` for the latest change only |
| Edit reasons | `reasons` | ✓ | ✓ | No trigger for DELETE (the API only deactivates) | **Yes** (`updated_by`) |
| User profiles | `user_profiles` | ✓ | ✓ | ✓ | No (nothing in the app writes this table yet) |

## 5. Missing audit coverage (documented, not changed)

These need database changes, which were not approved for this milestone.

| # | Gap | Effect | Suggested fix (needs approval) |
|---|---|---|---|
| G-1 | **User not recorded for most writes.** Patient, medicine, supplier, return and settings changes go through PostgREST, which never sets `app.user_id` | The viewer shows "Not recorded" for most events. Who edited a patient cannot be answered from the log | Write through database functions that set `app.user_id` (as the stock functions do), or have the trigger read `auth.uid()` / a request header. This is audit finding B11 / S-9 |
| G-2 | **No values recorded** | Cannot show previous and new values | Deliberate privacy choice. If wanted, add an approved per-table allowlist of non-sensitive columns (for example `is_active`, `status`) |
| G-3 | **Not audited:** `prescriptions`, `prescription_items`, `labels`, `label_sessions`, `stock_receipts`, `stock_receipt_items`, `sms_messages`, POS records | Prescription creation, reprints, label printing, deletion of a prescription (`prescriptions.service.ts:705-708`) and SMS sends do not appear here. Some have their own trails (`prescription_events`, `inventory_movements`) which this viewer does not merge | Add triggers, or a unified view over the existing event tables (decision) |
| G-4 | **Reads are not audited** | Opening a patient record leaves no trace | Application-level access log (decision; privacy) |
| G-5 | **Refused or failed attempts are not audited** | A 403 or a rolled-back write leaves no trace | Application-level security log |
| G-6 | **Sign-ins and role changes** are in Supabase Auth, not this table | Not visible here | Supabase Auth logs; Milestone 4 |
| G-7 | **No `pharmacy_id`** on `audit_log` | If several pharmacies ever share one database, every administrator would see every pharmacy's events. The `reasons` table is already per-pharmacy | Add `pharmacy_id` and filter by it before multi-tenant use (ties to decision P0-03) |

## 6. Audit integrity review

| Check | Finding |
|---|---|
| Viewer can modify records | **No.** The service has no insert, update or delete call. The controller has only GET routes (a test asserts this). Tests confirm no write call reaches the database during list or details, and that POST, PUT, PATCH and DELETE return 404 with the row unchanged |
| Browser access to the table | **Denied.** RLS is enabled with no policies, so `anon` and `authenticated` cannot read or write `audit_log` through Supabase REST |
| API access | Admin only, enforced by `RolesGuard` before the service runs (tests show no database call on refusal) |
| **Immutability in the database** | **RISK (I-1).** Nothing in the database stops the service role or the table owner from running UPDATE, DELETE or TRUNCATE on `audit_log`. Anyone with the service-role key could alter history. The service-role key exposure is still open (S-2) |
| Trigger tampering | **RISK (I-2).** The service role or owner can disable a trigger. `reasons_schema_verify.sql` checks only the reasons trigger |
| `actor_id` integrity | `app.user_id` is a transaction setting. Only the API's database functions set it, from the verified token. No request body can set it |
| Retention | **RISK (I-3).** No retention or archiving policy (audit §5). The table grows without limit; the page cap and date filters keep queries bounded |
| Sensitive data exposure | None found. Field names only; defensive withholding described in §3 |

**Recommended (needs approval, not done):** a migration that (a) `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role, authenticated, anon`, and (b) adds a `BEFORE UPDATE OR DELETE` trigger on `audit_log` that raises an exception. Inserts by the trigger functions would continue to work.

## 7. Files changed

| File | Change |
|---|---|
| `apps/api/src/audit/audit.module.ts` | **New** |
| `apps/api/src/audit/audit.controller.ts` | **New.** Two GET routes, `@Roles(Role.Admin)` on the class |
| `apps/api/src/audit/audit.service.ts` | **New.** Paged, filtered read; details; presentation and withholding; user names |
| `apps/api/src/audit/dto/list-audit-log.dto.ts` | **New.** Query validation, audited-table list, limits |
| `apps/api/src/audit/audit.spec.ts` | **New.** 57 tests |
| `apps/api/src/app.module.ts` | Registers `AuditModule` (2 lines) |
| `apps/api/src/auth/route-authorization.spec.ts` | +8 tests for the audit routes |
| `apps/web/app/actions/audit.ts` | **New.** `listAuditEvents`, `getAuditEvent` |
| `apps/web/lib/auditLog.ts` | **New.** Types, labels, filter validation, URL parsing |
| `apps/web/lib/auditLog.test.ts` | **New.** 10 tests |
| `apps/web/app/admin/audit-log/page.tsx` | **New.** Page, filters, table, details dialog |
| `apps/web/app/admin/audit-log/page.test.tsx` | **New.** 28 tests |
| `apps/web/lib/roles.ts` | Adds `ADMIN_ROLES` (display only) |
| `apps/web/components/shell/nav.ts` | Adds the admin-only "Audit log" link |
| `apps/web/components/shell/nav.test.ts` | "Staff see every page" now excludes the admin-only link; +2 tests |

**Not touched:**
- Migrations, triggers, `audit_log` rows, `fake-supabase.ts`
- Label printing, `PrintableLabel.tsx`, dosage and Sinhala logic
- POS code and POS test files
- Clinical, inventory and prescription services

## 8. Tests added (105: API 65, web 40)

| File | Covers |
|---|---|
| `audit.spec.ts` (57) | **Authorization:** admin allowed; pharmacist, staff, cashier, unknown role and no role refused before the database; anonymous and invalid token 401. **Read-only:** POST/PATCH/PUT/DELETE → 404 with the row kept; no write call during list or details. **Pagination:** bounded page with total; page 3 of 10; empty page beyond the end. **Sorting:** newest first with id tie-break; consecutive pages do not overlap. **Filters:** local-day date range across the UTC boundary, action, module, user (including `none` and upper-case ids), record, combined. **Invalid parameters (21):** page 0/201/1.5/"two", pageSize 0/101, impossible and malformed dates, timestamp, unknown or lower-case action, unaudited table, bad actor, record with filter syntax or wildcards, `from` after `to`; bad event ids. **Sensitive data:** extra columns never returned; non-column changed-field entries withheld and counted; non-id record references nulled. **Presentation:** module labels, unknown table, user names, name lookup failure, no lookup without users. **Details:** exact record, 404. **Failures:** page, count and detail failures → 503; missing table → `SCHEMA_OUT_OF_DATE`; database message not leaked |
| `route-authorization.spec.ts` (+8) | Only two GET routes registered; staff, pharmacist, cashier, role-less and unknown-role accounts refused before the database on both routes; expired and missing tokens 401; admin allowed. The existing app-wide enumeration also covers both routes |
| `page.test.tsx` (28) | Non-admin roles (4) see "Administrators only" with no API call; identity failure + Retry; API 403 shown. Loading then all columns; server paging; page cap note; empty log; failed load + Retry; thrown request; no edit/delete controls. All filters applied together from page 1; Enter; invalid filters explained with no request; filtered empty + Clear; filters from the URL. Details: only recorded data, read-only, settings link; no user and withheld entries; INSERT wording; failed load + Retry; filter by record; filter by user; Escape returns focus. Responsive columns; 40 px targets; stacked filters |
| `auditLog.test.ts` (10) | Labels, record names and links, user labels, filter validation, URL parsing |
| `nav.test.ts` (+2, 1 changed) | Admin sees the link; pharmacist, staff, cashier and no role do not |

## 9. Test results (run sequentially: API first, then web)

| Check | Result |
|---|---|
| API Jest (`--runInBand`) | **440/440, 32 suites** (baseline 375/31 + 65) |
| API `tsc --noEmit` | Pass |
| API ESLint (changed files) | Pass (after Prettier on the new files) |
| Web Vitest (`--testTimeout=30000`) | **2,157/2,161** in the full run, 73 files (all 38 new audit tests passed). The 4 failures are timeouts under load in files this milestone did not touch, and they differ between runs (run 1: `ProductTypeSelection`, `PosWorkstation`; run 2: `PosWorkstation`, `app/admin/page.test.tsx`, two label workflow tests). Each file passes alone (StatWorkflow 96/96, dashboard 5/5, settings 16/16, AppShell 9/9). The pre-existing POS unhandled rejection is still present. An earlier run found 3 audit tests timing out under load; they now use `asyncUtilTimeout: 5000`, as `PosWorkstation.test.tsx` does |
| Web `tsc --noEmit` | Pass (0 errors) |
| Web ESLint (changed files) | Pass |
| `next build` | Pass (`/admin/audit-log` built) |

## 10. Database verification status

| Item | Status |
|---|---|
| Queries against a real PostgreSQL / PostgREST | **NOT VERIFIED.** Local Supabase was not running (`127.0.0.1:54321` refused); no remote database was used |
| Real audit rows displayed | **NOT VERIFIED.** Behaviour is covered by the in-memory fake, which does not check column names or types |
| `count: exact` performance on a large `audit_log` | **NOT VERIFIED.** Date filters use `idx_audit_log_occurred_at`; record filters use `idx_audit_log_entity` |
| `.eq('id', <number>)` on `BIGSERIAL` and `.is('actor_id', null)` through PostgREST | **NOT VERIFIED** (standard PostgREST behaviour) |
| `user_profiles` has rows | **NOT VERIFIED.** Nothing in the app writes it yet, so names will usually show as "User xxxxxxxx" |
| Whether the `reasons` migration is applied | **NOT VERIFIED** |

**Staging check list:** edit a patient and the pharmacy settings, then confirm both events appear newest first with the right changed fields; check that the date filter includes an event at 00:30 Colombo time; open the details of each; sign in as pharmacist and confirm 403.

## 11. Admin module completion

| Capability | Before | Now |
|---|---|---|
| Reasons catalogue | 1 | 1 |
| System status / account / roles matrix | 1 | 1 |
| Pharmacy profile | 1 | 1 |
| Label settings | 0.5 | 0.5 (Q-S1) |
| Printer settings | 1 | 1 |
| Inventory settings | 0.5 | 0.5 (Q-S3) |
| Settings authorization + audit | 1 | 1 |
| Audit-log viewer | 0 | **1** |
| User management | 0 | 0 (Milestone 4, Q-A2) |

**Admin & settings: 7 / 9 = 78%** (was 67%).

## 12. Remaining Admin module work

| Item | Blocked by |
|---|---|
| User management (list users, assign roles, deactivate) | Milestone 4; decision Q-A2 |
| Label branding from settings | Q-S1 |
| Editable inventory alert settings | Q-S3 |
| Pharmacy email and registration details | Q-S4 (migration) |
| Record the user for PostgREST writes (G-1) | Migration approval |
| Database-enforced audit immutability (I-1, I-2) | Migration approval |
| Audit coverage for prescriptions, labels, SMS, POS (G-3) | Decision + migration |
| `pharmacy_id` on audit rows before multi-tenant use (G-7) | P0-03 |
| Audit retention policy (I-3) | Owner decision |
| Staging verification of the viewer against real data | Staging |

User Management (Milestone 4) was **not** started.
