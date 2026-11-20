# Staging Readiness Report

Date: 2026-10-10 · Branch: `feature/ui-ux-redesign` (local only: not pushed, merged or deployed)

## Verdict

**NOT production-ready. Ready for a staging deployment once the exposed credentials have been rotated.**

Everything that can be built and tested on this machine is done and passes. Nothing has been run against the real Supabase project or any staging project. What remains needs the owner or the pharmacist: credential rotation, a staging project, approval to apply five migrations there, role assignments, and the decisions in §7. Production readiness can only be claimed after the staging run in `STAGING_DEPLOYMENT_CHECKLIST.md` has passed.

Related documents: `STAGING_DEPLOYMENT_CHECKLIST.md` (what to do, in order), `SUPABASE_DEPLOYMENT_GUIDE.md` (how to do each step), `DATABASE_MIGRATION_PLAN.md` (what each migration changes), `DATABASE_SECURITY_AUDIT.md`, `IMPLEMENTATION_STATUS_REPORT.md`.

---

## 1. What changed in this stage

| Area | Change |
|---|---|
| Prescriptions | The API can now save a prescription through the `create_prescription` database function (one transaction, batch-level, earliest expiry first). **Off by default** (`PRESCRIPTION_WRITE_MODE=legacy`) until the pharmacist approves the rules (§7, D1). Both modes use the same validation and build the same item rows, so stored instructions and label text are identical. |
| Dispensing safety (current mode) | The default (legacy) path now refuses units that sit in expired, quarantined or undated batches. Previously it only checked the product total. |
| Returns | Split into three: **patient return** (recorded, held for review, never added to stock), **supplier return** (removes units from a named batch), **stock correction** (reason and user required). The old `RETURNED` type, which added stock, is refused. New screen: Inventory → Returns. |
| Expired stock | Receiving an expired batch is still refused, and the whole delivery is rolled back. New **quarantine/release** for batches: quarantined units stay on record but are never dispensed; an expired or undated batch cannot be released. Receiving can no longer silently reactivate a quarantined batch. |
| Thresholds | Migration 000500 removes the column defaults (reorder 15, minimum 5, maximum 500) that gave every product an invented threshold. Products without one show **"Not configured"**. Existing values are left for the pharmacist to review (guide §1.7d). |
| Database | New migration `20261010000500_returns_quarantine_dispensing.sql`; nothing applied remotely. |
| Tests | 40 new SQL checks, a second concurrency test, 15 new API unit tests, and **42 end-to-end tests that run the real API over HTTP against a real PostgreSQL database with every migration applied** (§5). |
| Docs | This report, the staging checklist, and updates to the deployment guide (new §1.7 data checks, 000500 in the order, §8.1 steps that re-open public access) and the migration plan. |

Not changed: Sinhala dosage calculation, instruction text and rules, label layout and `PrintableLabel`, and the label-expiry parsing rules. One gap in those rules is listed as decision D8 rather than changed.

---

## 2. Backend integration status

Each operation below was exercised end to end (HTTP → authentication → roles → service → real SQL) except where stated.

| Operation | Route | Schema match | Tested end to end |
|---|---|---|---|
| Sign in / identity | `POST /auth/login`, `GET /auth/me` | n/a (Supabase Auth) | Yes, with an Auth stand-in (§5.3) |
| Patients | `POST /customers`, `GET /customers/search`, `DELETE /customers/:id` | Yes (columns from 000100) | Yes |
| Medicines | `POST /products`, `PATCH /products/:id` | Yes (expiry/batch nullable from 000100; no threshold defaults from 000500) | Yes |
| Suppliers | `POST /suppliers` | Yes | Yes |
| Receiving | `POST /inventory/receipts` → `receive_stock` | Yes | Yes |
| Adjustments, supplier returns | `POST /inventory/adjustments` → `adjust_stock` | Yes (000500) | Yes |
| Patient returns | `GET/POST /inventory/patient-returns`, `POST …/:id/dispose` | Yes (000500) | Yes |
| Quarantine / release | `POST /inventory/batches/:id/quarantine` and `…/release` | Yes (000500) | Yes |
| Prescriptions, legacy mode (default) | `POST /prescriptions` | Yes | Yes |
| Prescriptions, transactional mode | `POST /prescriptions` → `create_prescription` | Yes (000500) | Yes (separate test run with the mode switched on) |
| Print, reprint | `POST /prescriptions/:id/print`, `POST /admin/prescriptions/:id/reprint` | Yes | Yes |
| Single label record (legacy) | `POST /labels` | Yes | Yes |
| SMS event log | `POST /prescriptions/:id/sms` | Yes | Yes (no message sent) |
| SMS sending | web server action `sendClientSms` → Text.lk | n/a | Unit tests only, gateway mocked. Session check verified. |
| Reports | `GET /inventory/summary`, `/low-stock`, `/expiry`, `/movements`, `/admin/dashboard/summary`, `/admin/prescriptions/:id` | Yes | Yes |

Runtime demo data: none. A search of the API and web runtime code for the former sample lists, `HARDCODED_*`, `SAMPLE_*` and `Math.random()` found nothing.

Existing data: all five new migrations only add objects. 000500 also replaces three functions, removes three column defaults and widens one CHECK constraint to a superset. No existing patient, prescription, stock or movement row is changed or deleted. Historical `RETURNED` movements remain valid.

### Findings from the schema review

| # | Finding | Status |
|---|---|---|
| F1 | **The legacy dispensing path reduces the product total but never the batch quantities.** Every prescription dispensed so far has left batch records too high, so batch-level views (Batches, Expiry, valuation) overstate stock. The new safety check on that path is therefore conservative: it can refuse a dispense when an expired or quarantined batch still shows units that were in fact dispensed long ago. | Open. Guide §1.7(c) lists the affected products. Fixed by transactional mode (D1) after a stock count reconciles the batches (D3). |
| F2 | `receive_stock` set an existing batch back to `ACTIVE`, which would have released a quarantined batch without anyone deciding to. | Fixed in 000500; tested. |
| F3 | `RETURNED` adjustments added stock with no way to say whether the patient or the supplier returned it. | Fixed: split into three concepts (§1). |
| F4 | `inventory_v2` gave every product reorder 15 / minimum 5 / maximum 500 by default. | Defaults removed for new rows. Existing values need review (D7). |
| F5 | `create_prescription` could deadlock when two prescriptions shared medicines in a different order; two requests with the same key at the same moment could fail instead of returning the first result; batches without an expiry, and stock without a batch, could be dispensed. | Fixed in 000500; concurrency-tested. |
| F6 | A user with no role can create and print prescriptions (which deducts stock). This is a documented choice to avoid lockouts before roles are assigned. | Owner decision O2. |
| F7 | Label expiry text like `01/01/2001` is treated as ambiguous (day/month order unknown) and accepted even though every reading is in the past. ISO (`2001-01-31`) and month/year (`01/2001`) past dates are refused. | Pharmacist decision D8. Rules not changed. |
| F8 | `audit_log` records the acting user only for changes made through the database functions (stock, quarantine, prescriptions in transactional mode). Patients, medicines and suppliers created or edited directly by the API are logged without an actor. | Open: engineering follow-up B11. |

---

## 3. Database schema status

| Migration | Contents | Local status | Supabase |
|---|---|---|---|
| `20260824000000` … `20261005010000` | Original schema | Applied in tests | Presumed applied; verify with guide §1.1–1.3 |
| `20261010000100` | Hardening: patient columns, allergy status, nullable product expiry, CHECK constraints (NOT VALID), indexes, triggers, sequences | Tested | **Not applied** |
| `20261010000200` | Profiles, settings, SMS log, audit log | Tested | **Not applied** |
| `20261010000300` | `receive_stock`, `adjust_stock`, `create_prescription` | Tested (superseded by 000500) | **Not applied** |
| `20261010000400` | RLS on every table | Tested | **Not applied.** Until it is, every table is open to the public key. |
| `20261010000500` | Returns, quarantine, threshold defaults, hardened stock functions | Tested | **Not applied** |

All five are idempotent and were re-applied in the tests without error. Re-running 000300 on its own after 000500 would restore the older functions; the guide warns against it (§3).

---

## 4. Security verification

| Requirement | Result | Evidence |
|---|---|---|
| Fail-closed authentication | Pass | Every route except `GET /health` and `POST /auth/login` returns 401 without a valid token (`app.security.spec.ts` walks every registered route; e2e §1). Auth outage returns 503, never access. |
| Valid JWT required | Pass, with a caveat | Tokens are verified by Supabase Auth `getUser` (signature, expiry, revocation). Locally, Auth is a stand-in, so real token verification still has to be seen on staging. |
| Role enforcement | Pass | Stock, supplier, medicine, quarantine and disposal routes: admin and pharmacist only. Patient delete: admin only. Recording a patient return: any assigned role. No-role users: see F6. Tested over HTTP for staff and no-role users. |
| Restricted database functions | Pass (locally) | `anon` and `authenticated` cannot execute any of the five stock functions; `service_role` can (SQL tests, guide §5.3). |
| No public access to patient or prescription records | Pass locally; **open on Supabase until 000400 is applied** | With migrations applied, `anon` and `authenticated` read 0 rows and cannot write, on every table including `patient_returns` (SQL tests, e2e §14). |
| Service-role secret server-side only | Pass | No reference to the service-role key anywhere in `apps/web`. `create_admin.js` and `scripts/set-user-role.js` read it from the environment. `.env` files are git-ignored. |
| Audit logging | Pass, with a gap | Inserts, updates and deletes on patients, medicines, suppliers, batches, settings, profiles and patient returns are logged with changed field names (no values). Stock movements, prescriptions, events, receipts and patient returns carry the acting user. **Gap (F8):** `audit_log.actor_id` is filled only for changes made inside the database functions; a patient or medicine created or edited directly by the API is logged with no actor. Tested. |
| SMS authorization | Pass, with open items | `sendClientSms` verifies the session with the API before contacting the gateway (unit tests). Open: messages are not yet recorded in `sms_messages`, and there is no rate limit (blocker B3). |
| Compromised credentials not used | Pass | No credential was used in this work. The search of this repository's full git history found no secret-key or password values. The exposure predates this history, so **rotation is still required**. |
| RLS never disabled to make the app work | Pass | The API uses the service role and is unaffected by RLS. The guide (§8.1) now flags every step that would re-open public access. |

### Rollback steps that re-open public access (requirement 7)

The earlier rollback instructions included two such steps, now marked ⚠ in `DATABASE_MIGRATION_PLAN.md` and listed in guide §8.1:
1. **"RLS (000400): `alter table <t> disable row level security`"** directly re-opens every table.
2. **"Restoring the backup is the last resort"**: a pre-migration backup (or point-in-time restore) has RLS off, so a restore silently re-opens everything.

The guide also flags: restoring the dump into a new project (default grants, RLS off), `supabase db reset` (also inserts sample data), and creating tables by hand. Each must be followed immediately by re-applying 000400 and 000500.

---

## 5. Tests

### 5.1 Results (final run, 2026-10-10, Node 20.17, PostgreSQL 18.1 local)

| Suite | Passed | Failed |
|---|---|---|
| API unit and integration (Jest, in-memory database stand-in) | **159 / 159** (17 suites; 15 new) | 0 |
| API end-to-end over HTTP against real PostgreSQL (`pnpm test:db`): legacy mode 36, transactional mode 6 | **42 / 42** | 0 |
| SQL migration tests (`run-migration-tests.sh`): 49 existing + 40 new checks | **89 / 89** | 0 |
| Concurrency: two sessions on one product (adjust_stock) | Pass | — |
| Concurrency: same idempotency key twice at once; two prescriptions racing for the last units | Pass | — |
| Web (Vitest): server actions, STAT workflow, number pad, dosage logic | **91 / 91** (10 files) | 0 |
| TypeScript, API and web | Clean | — |
| `nest build`, `next build` | Succeed (web: 25 routes, including the new Returns page) | — |
| ESLint, web | 25 errors, **unchanged** (all in older label-workstation files; deferred) | — |
| ESLint, API | No new rule violations in application code (only formatting differences; the API code has never been formatted to Prettier's 80-column default). The new test files add findings of the kinds the existing tests already have (untyped database rows, long lines). | — |

Failures seen during development, all resolved: three end-to-end expectations used the wrong HTTP status (the routes deliberately return 200, not 201), and one revealed the label-expiry gap F7, which is now a decision for the pharmacist. No test was weakened to pass.

### 5.2 The 14 requested scenarios

| # | Scenario | Where | Result |
|---|---|---|---|
| 1 | User authentication | e2e §1 | Pass |
| 2 | Role authorization | e2e §2, §7, §9 | Pass |
| 3 | Patient creation | e2e §3 | Pass (allergy status UNKNOWN, audited) |
| 4 | Medicine creation | e2e §4 | Pass (no invented stock, expiry or thresholds) |
| 5 | Supplier creation | e2e §5 | Pass |
| 6 | Stock receiving | e2e §6 | Pass (batches, total and ledger together; idempotent retry) |
| 7 | Stock adjustment | e2e §7 | Pass (reason and user recorded; RETURNED refused; supplier and patient returns) |
| 8 | Prescription creation | e2e §8; transactional suite | Pass (Sinhala text stored exactly; retry does not dispense twice; nothing left behind on failure) |
| 9 | Batch-level allocation | transactional suite; SQL tests | Pass (earliest expiry first; quarantined and expired skipped; split across batches; full rollback) |
| 10 | Label generation and printing | e2e §10; web dosage tests | Pass (print, reprint with reason, label record). Physical printing not tested. |
| 11 | SMS authorization and delivery handling | e2e §11; web `sms.test.ts` | Pass. **No SMS was sent**; the gateway is mocked. |
| 12 | Inventory reporting | e2e §12 | Pass |
| 13 | Expiry validation | e2e §13; SQL tests | Pass (expired delivery refused whole; past label date refused; expired batch units not dispensed) |
| 14 | Audit history | e2e §14 | Pass (what changed for every audited table; who, for batch and stock changes; ledger balanced; public roles read nothing). See F8 for the actor gap. |

### 5.3 What the local end-to-end tests do not prove

- **Supabase Auth.** Sign-in and token checks use a local stand-in that returns users and roles the way Supabase Auth does. Real JWT verification must be seen on staging.
- **PostgREST.** The API's database client is replaced by a test adapter that runs the same queries as the `service_role` on real PostgreSQL. Grants, RLS, constraints, triggers and functions are real; PostgREST's own request handling is not.
- Not run at all: a real Supabase project, a real SMS, a real printer, automated accessibility checks, Node 22.

How to rerun: `apps/api/supabase/tests/run-migration-tests.sh` and `DB_TEST_URL=postgres://postgres@localhost:<port>/postgres pnpm --filter api test:db`, both against a disposable local PostgreSQL server. Both refuse non-local hosts.

---

## 6. Migration readiness

Ready for staging, subject to the gates in guide §0. The checklist is `STAGING_DEPLOYMENT_CHECKLIST.md`. It covers compatibility checks (guide §1, including the new data checks in §1.7), a verified backup (§2), migration order (§3), RLS checks (§6), owner-confirmed role assignment (§7), post-migration verification (§5) and recovery (§8, §8.1).

One behaviour change appears as soon as 000500 is applied, even before the new API is deployed: the old Adjustments screen still offers "customer return to stock" (`RETURNED`), and the database now refuses it. Deploy the new API and web app together with the migrations.

---

## 7. Decisions still required

### Pharmacist

| # | Decision | Current behaviour in code |
|---|---|---|
| D1 | **Approve batch-level dispensing** (`create_prescription`): earliest expiry first among eligible batches (expiry known and not passed, not quarantined, not marked expired); ties by date received. Only then set `PRESCRIPTION_WRITE_MODE=transactional`, on staging first. | Built and tested; **off**. |
| D2 | Confirm that units with **no expiry date** (undated batches, or stock recorded without a batch on a product with no valid expiry) are never dispensed until the expiry is entered from the pack. | Refused in both modes. Guide §1.7(a) lists affected stock. |
| D3 | **Reconcile batch quantities** with a physical count before switching to D1 (finding F1). | Not done; needs a stock count. |
| D4 | Confirm that **patient returns are never put back into stock**, only held and then disposed of. | Implemented that way. Restocking is not possible. |
| D5 | Confirm that a **supplier return** is recorded when the units physically leave, against the batch they came from. | Implemented that way. |
| D6 | Does the pharmacy need to **record expired deliveries** (for example for supplier credit)? | Receiving refuses them and saves nothing. A rejection record is not built; it can be added if needed. |
| D7 | **Review thresholds** that look like the old defaults (15/5/500) and set real reorder levels where low-stock alerts are wanted. | No defaults for new medicines; existing values untouched. |
| D8 | Should a label expiry written as day/month/year be **refused when every possible reading is in the past** (e.g. `01/01/2001`)? | Accepted today (finding F7). |
| D9 | Who may **release a quarantined batch**: pharmacist and administrator (as built), or pharmacist only? | Pharmacist or administrator. |

### Owner

| # | Decision |
|---|---|
| O1 | Rotate the Supabase secret key and the admin password (§8). |
| O2 | Once every account has a role, require a role for creating prescriptions (finding F6). This is a one-line change. |
| O3 | Confirm in writing who gets which role (guide §7). |
| O4 | Provide a staging project and approve applying the five migrations there. |
| O5 | Upgrade Node to 22 LTS on every machine (supabase-js warns that Node 20 support is ending). |

---

## 8. Credential rotation status

**Not done. Still required before any further step.** The exposed Supabase secret (service-role) key and the admin password must be rotated by the owner (`DATABASE_SECURITY_AUDIT.md` §A1). Nothing in this work used either credential. No secret value is present in the repository or its git history. There is no git remote configured, and nothing was pushed.

---

## 9. Remaining production blockers

| # | Blocker | Owner |
|---|---|---|
| B1 | Credential rotation (O1) | Owner |
| B2 | Apply migrations 000100–000500 on staging, verify, then production (checklist) | Owner approval |
| B3 | Move SMS sending into the API, record each message in `sms_messages`, add rate limiting | Engineering |
| B4 | Middleware checks only that a session cookie exists; verify the token server-side before rendering admin pages | Engineering |
| B5 | 25 ESLint errors in older label-workstation files, deferred to a separate cleanup with clinical review | Engineering + pharmacist |
| B6 | Pharmacy-details settings endpoint and form (needs B2) | Engineering |
| B7 | Pharmacist decisions D1–D9, especially D2 and D3 before go-live | Pharmacist |
| B8 | Role assignments (O3) and the no-role prescription decision (O2) | Owner |
| B9 | Full staging run of `STAGING_DEPLOYMENT_CHECKLIST.md`, including real sign-in, a real print and one SMS to the owner's phone | Owner + engineering |
| B10 | Node 22 upgrade (O5) | Owner |
| B11 | Record the acting user in `audit_log` for direct API writes (F8), e.g. by setting `app.user_id` per request or adding `created_by`/`updated_by` columns | Engineering |

The application must not be described as production-ready until B1, B2, B7–B9 are closed and the staging run has passed.
