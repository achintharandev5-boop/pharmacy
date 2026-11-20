# Pharmacy Label SaaS — Master Feature Completion Plan

**Date:** 2026-10-30 · **Branch:** `codex/phase1-safety-fixes` (HEAD `e3c15e4` + uncommitted work; nothing committed by this plan)
**Inputs:** `PHARMACY_FULL_SYSTEM_AUDIT_2026.md`, `PHARMACY_FEATURE_COMPLETION_MATRIX.md`, `PHARMACY_DEVELOPMENT_ROADMAP.md`, `PHARMACY_PRODUCTION_READINESS_REPORT.md`, `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md`, the POS documents, and the source code as it stands at 03:45 on 2026-10-30.
**Tracker:** `PHARMACY_FEATURE_DEVELOPMENT_PROGRESS.md` · **Module results:** `PHARMACY_MODULE_IMPLEMENTATION_REPORT.md`

This plan is about **functional completeness**. It is not a readiness assessment: a feature that is complete here can still be blocked for a pilot by staging, printer or pharmacist verification.

---

## 1. What changed since the audit (verified in code)

The audit ran from 01:40 to 02:00. Other sessions changed the code between 02:50 and 03:33. The audit's numbers are therefore out of date in these places:

| Audit finding | Current state | Evidence |
|---|---|---|
| S-4 / P0-04: routes without `@Roles` admit role-less accounts | **Fixed.** `RolesGuard` now fails closed: a route without `@Roles` admits only `ALL_ROLES`. A test boots the whole app and checks every registered route for role-less, unknown-role and cashier tokens | `apps/api/src/auth/roles.guard.ts`, `apps/api/src/auth/route-authorization.spec.ts` |
| POS 0% | **Milestone 1 built**: read-only catalogue search, cart, customer lookup and `cashier` role. Checkout is blocked on accountant decisions | `PHARMACY_POS_DEVELOPMENT_REPORT.md`, `apps/api/src/pos/`, `apps/web/components/pos/` |
| Role-based navigation | **Built**: `navSectionsFor(role)`; an unknown role sees no navigation | `apps/web/components/shell/nav.ts` |
| API tests 253 | **302 tests, 29 suites, all pass.** One run had a single load-sensitive failure in `reasons.spec.ts`, which passed on a rerun | This session's runs |

Still true, checked again in code: no session refresh (`app/actions/auth.ts:81`), presence-only proxy check (`proxy.ts:11`), no patient edit, unpaginated `GET /customers`, no prescription void, no settings endpoint, no audit viewer, no export, no login throttling or helmet.

## 2. Classification key

| Code | Meaning |
|---|---|
| **FC** | Required for functional completeness |
| **SO** | Required for safe operation |
| **OF** | Optional future enhancement |
| **BLOCKED (Q-n)** | Cannot be built without the decision in §5. Building it would mean inventing a business, clinical or financial rule |

---

## 3. Module backlog

Every module uses the ten dimensions from the brief. "—" means nothing outstanding in that dimension.

### 3.1 Authentication & user management (audit: 50%)

| Dimension | Items |
|---|---|
| Implemented | Login/logout; API guard fails closed; roles admin/pharmacist/staff/cashier from `app_metadata`; fail-closed default role policy on every route; `GET /auth/me`; role-based navigation and redirects; local UI-test mode isolated from production |
| Partial | Session: an access-token cookie only, lasting about an hour. Audit: triggers on `user_profiles`, but the actor is not recorded for API writes |
| Missing | Refresh tokens (**SO**, P0-09). Server-side session verification in the proxy or layouts (**SO**, P0-09). User list, invite or create, role assignment, deactivation (**FC**, P1-05). Password reset (**FC**, P1-06). Own-account settings (change password, display name) (**FC**). Login throttling (**SO**, P1-08) |
| Broken | — |
| Missing APIs | `GET/POST /admin/users`, `PATCH /admin/users/:id` (role, active), `POST /admin/users/:id/password-reset`, `POST /auth/refresh`, `POST /auth/password` |
| Missing DB integration | `user_profiles` exists (full_name, registration_number, is_active) but no code reads or writes it |
| Missing UI | Users page, user dialog, account page, "forgot password" path on the login page |
| Missing validations | Admins cannot demote or deactivate themselves (**SO**, so the system cannot be left without an admin); role must be one of `KNOWN_ROLES` |
| Missing tests | Refresh round trip; deactivated user refused; last-admin protection; throttle |
| Dependencies | Supabase Auth admin API (service-role key already used by the API). Real-session verification needs staging (O4) |
| Decisions | **Q-A1** reset method (email link vs admin-set temporary password). **Q-A2** who may assign the admin role. O2/O3 role assignment list (owner) |

### 3.2 Patient management (audit: 67%)

| Dimension | Items |
|---|---|
| Implemented | Register (validated DTO + form); search by name or phone (sanitised); profile with allergy status; prescription history; admin-only delete with confirmation |
| Partial | List loads **every** patient and filters in the browser (**SO**, S-5). Empty search on `/customers/search` also returns every patient |
| Missing | Edit patient details (**FC**, P1-03). Duplicate warning (**FC**, P1-03: phone numbers are deliberately not unique because families share phones, `docs/DATABASE_SCHEMA.md:39`, so it must be a warning, never a block). Server-side pagination (**SO**). Soft delete or archive (**SO**, S-10): **BLOCKED (Q-P1)** |
| Broken | — |
| Missing APIs | `PATCH /customers/:id`; paginated `GET /customers?q=&page=&pageSize=`; `GET /customers/duplicates?phone=` |
| Missing DB integration | — (columns exist; `customers` is already covered by the audit trigger) |
| Missing UI | Edit dialog on the profile; duplicate warning in the add dialog; server pagination on the list |
| Missing validations | Edit uses the same rules as create; "has allergies" requires an allergy list on edit too; cannot clear the name or phone |
| Missing tests | Update, partial update, 404, validation, pagination bounds, duplicate lookup, route authorization for new routes |
| Dependencies | None. Can be built and tested fully in the local environment |
| Decisions | **Q-P1** soft delete vs hard delete and retention period |

### 3.3 Prescription management (audit: 81%)

| Dimension | Items |
|---|---|
| Implemented | Idempotent create; list, search, status filter; detail; print and SMS log; reprint with reason; patient and medicine snapshots; immutable by design |
| Partial | Inventory deduction is product-total only in the default `legacy` mode; batch FEFO built but off (P0-06). Audit trail: `prescription_events`, without the actor on legacy writes |
| Missing | Cancel/void (**FC**, P1-04): **BLOCKED (Q-R1)**. The `CANCELLED` status exists but the rule for stock reversal per batch, permissions and the time window needs pharmacist approval. Date-range filter on the list (**FC**). Server pagination (**SO**). Real drafts (**OF**, P2-10) |
| Broken | — |
| Missing APIs | `POST /prescriptions/:id/void` (blocked); date and pagination parameters on `GET /admin/prescriptions` |
| Missing DB integration | A void function that reverses the exact movements in one transaction (blocked) |
| Missing UI | Void action and reason dialog (blocked); date filter |
| Missing validations | — |
| Missing tests | Date filtering; pagination |
| Dependencies | P0-06 (batch dispensing) before void can restore batches exactly |
| Decisions | **Q-R1** void rules. Pharmacist D1–D3 |

### 3.4 Admin & settings (audit: 36%)

| Dimension | Items |
|---|---|
| Implemented | Reasons catalogue CRUD (admin); settings page with status, current account, read-only roles table, label information |
| Partial | Pharmacy details come only from the environment (`lib/pharmacyBranding.ts`); label, inventory and printer settings exist as `pharmacy_settings` columns but have no endpoint or form |
| Missing | Pharmacy profile form backed by `pharmacy_settings` (**FC**, P1-07). Label, printer and inventory settings form (**FC**). Audit-log viewer (**FC**, P1-02). User management (see 3.1). Role configuration: roles are fixed in code by design; a read-only matrix is sufficient unless **Q-S2** asks for custom roles |
| Broken | — |
| Missing APIs | `GET/PATCH /admin/settings`; `GET /admin/audit-log?entity=&from=&to=&page=` |
| Missing DB integration | `pharmacy_settings` is never read or written; `audit_log` is never read |
| Missing UI | Settings forms; audit log page |
| Missing validations | Settings ranges already exist as DB CHECKs (`expiry_alert_days` 1–365, positive label size); the DTO must match them |
| Missing tests | Settings read/update/validation; audit-log pagination and admin-only access |
| Dependencies | Migration `20261010000200` (already in the repo; applied locally only). **Q-S1**: does the label print the DB pharmacy name instead of the environment value (a change to printed output)? |
| Decisions | **Q-S1** label branding source. **Q-S2** custom roles |

### 3.5 Reporting & analytics (audit: 44%)

| Dimension | Items |
|---|---|
| Implemented | Inventory, movement and expiry analytics; dashboard with 7/30/90-day presets; low-stock list |
| Partial | Prescription analytics (presets only); date filters (presets only) |
| Missing | CSV export of prescriptions, movements, low stock and expiry (**FC**, P2-01). Custom date ranges (**FC**). Sales and financial reports: **BLOCKED** on POS checkout (D-19) |
| Broken | — |
| Missing APIs | Date-range parameters; export endpoints, or exporting the already-loaded rows in the browser |
| Missing DB integration | — |
| Missing UI | Export buttons; date-range picker |
| Missing validations | Date range order and maximum span |
| Missing tests | CSV escaping (formula injection: cells starting with `= + - @` must be neutralised); range validation |
| Dependencies | — |

### 3.6 Point of sale (current: Milestone 1 of 10 built)

| Dimension | Items |
|---|---|
| Implemented | Milestone A (foundation): layout, product search, barcode scanning, selection, cart, quantity editing, recorded prices, sellable stock by the approved rule (D-08), validation, cashier role (D-10), patient lookup |
| Partial | Pricing: subtotal at recorded prices only; no discount, tax or rounding |
| Missing | Milestone B checkout, payments, invoices, receipt printing: **BLOCKED (D-01–D-06, D-13)**. Milestone C atomic stock deduction: **BLOCKED** (needs B). Milestone D history, reprints, refunds: **BLOCKED (D-15–D-17)** |
| Broken | — |
| Dependencies | `PHARMACY_ACCOUNTING_DECISIONS.md` (every row BLOCKED); P0-06 |
| Decisions | D-01–D-06, D-11, D-13, D-15–D-17, D-19 (accountant and owner) |

POS milestones B–D are **not** started by this plan. Starting them would mean inventing tax, rounding, invoice-numbering and refund rules, which the brief forbids.

### 3.7 Label workstation (audit: 100% implemented)

| Dimension | Items |
|---|---|
| Implemented | All 31 capabilities, Features #1–#22, ENT as the fifth Administration button, historical `ENT:v1:` printing, 70 × 50 mm, Print-only vs Print & Save |
| Missing | — (code). Wording sign-off S1–S3, A1–A16 is a pharmacist action (P0-07) |
| Integration checks for new work | Patient edits must not change names already printed (prescriptions keep `patient_name_snapshot`). The workstation's patient search must keep working against the bounded search |

### 3.8 Products (audit: 100%)

Implemented end to end. Integration check: product search still uses `ilike '%term%'` (performance risk, not a functional gap).

### 3.9 Inventory (audit: 92%)

| Missing | Reconciliation UI over the read-only diagnostic (**OF**, P2-06). Inventory settings form (see 3.4) |
|---|---|
| Blocked | Batch-level dispensing switch (P0-06, pharmacist D1–D3) |

### 3.10 Dashboard (audit: 88%)

Missing: sales KPIs (blocked on POS); custom date range (**FC**, shared with 3.5). No fabricated metrics were found.

### 3.11 Printing (audit: 85% implemented)

Missing: self-hosted Sinhala fonts (**SO**, P1-09); invoice printing (blocked on POS). Physical printer acceptance stays **NOT VERIFIED** until it is run on the pharmacy's printer (P0-08).

### 3.12 SMS (part of prescriptions in the audit)

Missing: send through the API with an `sms_messages` row and rate limits (**SO**, P1-01). Needs the provider's credentials only on the API.

### 3.13 Security (cross-cutting, audit: 58%; P0-04 since fixed)

Outstanding: throttling and helmet (**SO**, P1-08); audit actor (**SO**, P1-02); tenancy (**BLOCKED**, owner decision P0-03); credential rotation (owner, P0-02).

### 3.14 Database (audit: 80%)

Outstanding: tenant columns (blocked, P0-03); restore drill (staging, P0-10). New migrations from this plan: none for the Patients module.

### 3.15 Testing & deployment (audit: 58% / 50%)

Outstanding: CI (P1-10); E2E (P1-11); API lint ratchet (P1-12); staging (O4). All need either owner approval or a remote, which this phase does not touch.

---

## 4. Implementation order

Each module is completed, tested and reported before the next one starts.

| Order | Module | Why this position | Status |
|---|---|---|---|
| 1 | **Patients** (3.2, without soft delete) | Fully specified by P1-03 and S-5; no open decision for edit, pagination or duplicate warning; no migration; testable locally | **This session** |
| 2 | Admin settings: pharmacy profile, label, printer and inventory settings (3.4) | Table exists; only Q-S1 (label output) needs an answer, and the form can be built without changing printed labels | Next |
| 3 | Audit-log viewer (3.4) | Read-only; table and indexes exist | Next |
| 4 | User management + password reset (3.1) | Needs Q-A1/Q-A2; user list and deactivation can start first | After decisions |
| 5 | Session refresh + server-side session check (3.1, P0-09) | Engineering-only, but touches sign-in for every user; needs real Supabase Auth to verify | After 4 |
| 6 | Reporting: date ranges + CSV export (3.5) | No decisions needed | |
| 7 | Prescriptions: date filter + pagination (3.3) | No decisions needed | |
| 8 | Login throttling + helmet (3.13) | No decisions needed | |
| 9 | SMS via the API (3.12) | Needs provider credentials on the API | |
| 10 | Prescription void (3.3) | **BLOCKED (Q-R1)**, P0-06 | |
| 11 | POS B–D (3.6) | **BLOCKED** on the accountant | |

## 5. Open decisions (exact questions)

| ID | For | Question | Blocks |
|---|---|---|---|
| **Q-P1** | Owner + privacy advisor | When a patient record is removed, should it be **archived** (hidden from search, kept with its prescription link) or **deleted** (today's behaviour: the record is gone and prescriptions keep only the printed name)? How long must patient records be retained? | Soft delete (S-10) |
| **Q-R1** | Pharmacist + owner | May a completed prescription be voided? If so: who may void (pharmacist only?), within what time window, does stock return to the **same batch** or to quarantine, and must the label be physically recovered? | Prescription void (P1-04) |
| **Q-A1** | Owner | Password reset: an email link sent by Supabase (needs outgoing email configured) or a temporary password set by an administrator? | Password reset |
| **Q-A2** | Owner | May an administrator create other administrators, or only the owner? | Role assignment |
| **Q-S1** | Owner + pharmacist | Should printed labels take the pharmacy name, address and phone from the new settings form instead of the environment? This changes printed output and needs a print check | Label branding from settings |
| **Q-S2** | Owner | Are the four fixed roles enough, or are custom roles needed? (Fixed roles are recommended for the pilot) | Role configuration |
| D-01…D-19 | Accountant + owner | See `PHARMACY_ACCOUNTING_DECISIONS.md` and `PHARMACY_POS_IMPLEMENTATION_PLAN.md` §4 | POS B–D, sales reports |
| D1–D3, S1–S3, A1–A16 | Pharmacist | See `docs/PHARMACIST_APPROVAL_REQUIRED.md` | Batch dispensing, wording sign-off |

## 6. Acceptance rule (from the brief)

A feature is **COMPLETE** only when the UI exists and works, the backend and required persistence work, validation and authorization are enforced, errors are handled, relevant tests pass, nothing regresses, and the behaviour matches the approved specification. Dimensions that need a real printer, a pharmacist, staging or an external service stay **NOT VERIFIED** until tested.
