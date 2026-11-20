# Pharmacy Label SaaS — Feature Development Progress

**Last updated:** 2026-10-30 · after **Milestone 3 (Admin audit log viewer)**
**Plan:** `PHARMACY_MASTER_FEATURE_COMPLETION_PLAN.md` · **Results:** `PHARMACY_MODULE_IMPLEMENTATION_REPORT.md`

Status values: **Complete (local)** = meets the acceptance rule in the local environment; **Partial**; **Missing**; **Blocked (decision)**; **NOT VERIFIED** = needs staging, a real printer, a pharmacist or an external service.

## Current test baseline

| Suite | Before this phase | Now |
|---|---|---|
| API (Jest) | 331/331, 30 suites (after P-1) | **440/440, 32 suites** (`--runInBand`; Milestone 2 added 44, Milestone 3 added 65) |
| Web (Vitest, `--testTimeout=30000`) | 2,088/2,088, 68 files (after P-1) | **2,161 tests, 73 files** (Milestone 2 added 33, Milestone 3 added 40). Full run: 2,157 passed, plus 4 load-sensitive timeouts in untouched files that differ between runs and pass alone. The same pre-existing POS unhandled rejection (root cause in `PHARMACY_ADMIN_SETTINGS_COMPLETION_REPORT.md` §6) |
| API tsc / build | Pass | Pass |
| Web tsc (source) / ESLint / `next build` | Pass | Pass |

## Tracker

| Module | Feature | Initial status | Current status | Frontend | Backend | Database | Tests | Blockers | Next task |
|---|---|---|---|---|---|---|---|---|---|
| Patients | Registration | Complete | Complete (local) | ✓ shared `PatientDialog` | ✓ `POST /customers` | ✓ | ✓ | — | — |
| Patients | Edit details | Missing | **Complete (local)** | ✓ "Edit details" on the profile | ✓ `PATCH /customers/:id` | ✓ existing columns; audit trigger records changed fields | ✓ 8 service + 8 DTO + 5 UI | Real-DB run NOT VERIFIED | Staging check |
| Patients | Paginated list + server search | Partial (whole table loaded) | **Complete (local)** | ✓ server pages of 25, debounced search | ✓ `GET /customers?q&page&pageSize` (max 100) | ✓ | ✓ 5 service + 4 UI | — | — |
| Patients | Duplicate warning | Missing | **Complete (local)** | ✓ warning with links; user may proceed | ✓ `GET /customers/duplicates` | — (no constraint; families share numbers) | ✓ 4 service + 4 UI | — | — |
| Patients | Bounded search | Partial (empty term returned everyone) | **Complete (local)** | — | ✓ empty term → 400 | — | ✓ | — | — |
| Patients | Profile + history | Complete | Complete (local) | ✓ | ✓ | ✓ | ✓ | — | — |
| Patients | Archive instead of delete | Missing | **Blocked (Q-P1)** | — | — | Migration needed | — | Owner/privacy decision | Ask Q-P1 |
| Auth | Fail-closed roles on every route | Partial | Complete (local) (another session) | — | ✓ | — | ✓ route enumeration | — | — |
| Auth | Session refresh + server-side check | Missing | Missing | — | — | — | — | Needs real Supabase Auth to verify | Milestone 5 |
| Auth | User management | Missing | Missing | — | — | `user_profiles` unused | — | Q-A2 | Milestone 4 |
| Auth | Password reset | Missing | **Blocked (Q-A1)** | — | — | — | — | Q-A1 | Ask Q-A1 |
| Prescriptions | Void/cancel | Missing | **Blocked (Q-R1)** | — | — | — | — | Q-R1, P0-06 | Ask Q-R1 |
| Prescriptions | Date filter + pagination | Partial | Partial | — | — | — | — | — | Milestone 7 |
| Admin | Pharmacy profile (name, address, phone) | Missing | **Complete (local)** | ✓ `/admin/settings` form, per-section save, unsaved-change guard | ✓ `GET` (staff roles) / `PATCH` (admin) `/admin/settings` | ✓ existing `pharmacy_settings`; `updated_by` + audit trigger | ✓ API 44 + web 33 | Real-DB run NOT VERIFIED | Staging check |
| Admin | Pharmacy email / registration details | Missing | **Pending (Q-S4)** | — | — | Needs migration | — | Q-S4 | Ask Q-S4 |
| Admin | Label settings | Missing | **Pending (Q-S1)** | ✓ accurate read-only panel | — | — | ✓ label isolation test | Q-S1 | Ask Q-S1 |
| Admin | Printer settings | Missing | **Complete (local)** | ✓ printer reference name + browser print-dialog guidance | ✓ | ✓ `printer_name` | ✓ | — | — |
| Admin | Inventory settings | Missing | **Pending (Q-S3)** | ✓ read-only stored values | Refuses edits (400) | — | ✓ | Q-S3 | Ask Q-S3 |
| Admin | Audit-log viewer | Missing | **Complete (local)** | ✓ `/admin/audit-log`: filters, server pages, details dialog, admin-only link | ✓ `GET /admin/audit-log` + `/:id`, admin only, read-only | ✓ existing `audit_log` (field names only; no migration). User not recorded for PostgREST writes (G-1); no DB-level immutability (I-1) | ✓ API 65 + web 40 | Real-DB run NOT VERIFIED; G-1 / I-1 need migration approval | Staging check |
| Reporting | CSV export + custom ranges | Missing | Missing | — | — | — | — | — | Milestone 6 |
| POS | Milestone A (foundation) | 0% (audit) | Complete (local) (another session) | ✓ | ✓ read-only | — | ✓ | — | — |
| POS | Milestones B–D | Missing | **Blocked (D-01…D-19)** | — | — | — | — | Accountant | Accountant decisions |
| Label workstation | Features #1–#22 | Complete (local) | Unchanged | — | — | — | ✓ (in the 2,088) | Wording sign-off, printer | Pharmacist |

## Functional completion (Patients module)

Capabilities from the completion matrix, rescored: registration 1, search 1, profile 1, prescription history 1, contact info **1** (was 0.5), duplicate handling **1** (was 0), validation 1, privacy **1** (was 0.5: role-less access fixed by another session, and the list is now paginated), pharmacy isolation 0 (tenancy decision P0-03, not a Patients task).

**Patients: 8 / 9 = 89%** (was 67%). The remaining point is tenancy, which belongs to the platform. Archive (Q-P1) is a safety item, not a matrix capability.

## Functional completion (Admin & settings, Milestone 2)

**Admin & settings: 6 / 9 = 67%** (was 36%). Settings capabilities alone: 5 / 6 = 83%; the remainder waits on Q-S1 (label branding source) and Q-S3 (inventory alert settings). The audit-log viewer (Milestone 3) and user management (Milestone 4) make up the rest. Details: `PHARMACY_ADMIN_SETTINGS_COMPLETION_REPORT.md`.

## Functional completion (Admin & settings, Milestone 3)

**Admin & settings: 7 / 9 = 78%** (was 67%). The audit-log viewer is complete locally. Remaining: user management (Milestone 4, Q-A2) and the pending settings decisions Q-S1 and Q-S3. Audit gaps that need migration approval (user not recorded for most writes, database-enforced immutability, coverage of prescriptions/labels/SMS/POS) are listed in `PHARMACY_ADMIN_AUDIT_LOG_VIEWER_REPORT.md` §5–6.
