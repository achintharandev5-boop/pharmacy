# Pharmacy Staging Verification Checklist

**Purpose:** Gate a controlled, single-pharmacy staging verification of the current label, prescription and inventory system.  
**Environment boundary:** Use a disposable/staging Supabase project and staging API/web deployment only. Do not point these steps at production. Do not paste credentials or patient data into this checklist.  
**Status:** Prepared; no staging project was accessed and no checkbox is represented as passed.

## Run record

- [ ] Pharmacy/site and staging project reference recorded (non-secret identifier only)
- [ ] Application commit/build ID and migration set recorded
- [ ] Test operator, pharmacist reviewer and owner recorded
- [ ] Local timezone confirmed (`Asia/Colombo` unless the pharmacy owner approves another)
- [ ] Staging data is synthetic/masked or an explicitly approved protected copy
- [ ] Evidence location and retention/access controls agreed
- [ ] Production endpoints and credentials are absent from the test environment

## 1. Database and migrations

- [ ] Confirm the Supabase project reference from the approved staging control plane.
- [ ] Export/record the current migration ledger and compare it with repository migration files in order.
- [ ] Take a pre-change staging backup/snapshot and verify it can be restored to a separate disposable project.
- [ ] Review every unapplied migration, grants, `SECURITY DEFINER`/`INVOKER`, `search_path`, constraints, indexes and function execute privileges.
- [ ] Apply approved migrations to staging in documented order only; capture command output and resulting migration ledger.
- [ ] Verify schema objects and function signatures used by the deployed API; confirm no legacy function migration was rerun over its final replacement.
- [ ] Verify RLS is enabled where intended and policies deny direct `anon`/`authenticated` access except explicitly approved paths.
- [ ] Confirm service-role use is server-only, secret-managed and not exposed through web build variables, logs, source maps or browser responses.
- [ ] Repeat the migration/deployment using a fresh disposable project to check reproducibility.

**Pass evidence:** migration ledger and schema diff reviewed by an engineer; security grants/policies reviewed by security owner; restore verified in an isolated project.

## 2. Authentication and authorization

- [ ] Sign in with a staging Supabase account and verify API token validation against Supabase Auth.
- [ ] Verify expired, malformed, revoked and absent tokens fail closed on protected routes.
- [ ] Test the actual approved role matrix for read, receive, adjust, quarantine/release, prescription create, print-event, SMS and destructive operations.
- [ ] Specifically decide and test which role may create/dispense prescriptions; current controller routes do not declare a role restriction.
- [ ] Test no-role, wrong-role and deactivated-user cases; record 401 versus 403 behavior.
- [ ] Verify audit actor identity and timestamps for sensitive writes.
- [ ] Confirm session expiry in the web shell leads to a clear sign-in flow; API remains the authorization boundary.

**Pass evidence:** pharmacist/owner-approved role matrix and route-by-route positive and negative test results. Do not enforce a new dispensing role until active accounts and user assignments are reviewed.

## 3. API connectivity and persistence

- [ ] Confirm staging web points only to staging API and staging API only to the staging Supabase URL/project.
- [ ] Check health/readiness route, TLS, CORS, timeout behavior and API logs for accidental secrets/health data.
- [ ] Verify DTO validation rejects missing/invalid fields and unknown fields are handled as configured.
- [ ] Create a synthetic patient and prescription; confirm response, database rows and history/detail views agree.
- [ ] Verify an unset/zero/negative prescription label quantity cannot reach review/save/print; each saved item carries an explicit positive quantity.
- [ ] Test inactive product, insufficient stock, expired product, malformed expiry, missing patient, duplicate idempotency key, retry after timeout and event-log failure.
- [ ] Confirm a retry with the same idempotency key does not create a duplicate prescription or stock deduction.
- [ ] Verify save-only, save-and-print-dialog, print-event failure and SMS outcomes are distinguishable; never claim browser-dialog invocation means physical printing.
- [ ] Review logs for customer name, phone, prescription text and tokens; minimize/redact sensitive values.

## 4. Inventory consistency and controlled dispensing

- [ ] Run the read-only diagnostics in `apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql` against a staging clone.
- [ ] Have a pharmacist/stock controller compare every discrepancy with a witnessed physical count and source receipts.
- [ ] Record batches by sellable, expired, quarantined, damaged and undated categories; do not infer missing opening balances.
- [ ] Verify product aggregate, batch balances and movement evidence for all products in the test scope.
- [ ] Confirm no stock-changing action is performed as part of diagnostics; capture before/after snapshots to prove read-only behavior.
- [ ] Keep legacy mode active until reconciliation and pharmacist approval are complete.
- [ ] In a disposable restored copy only, test the transactional function for FEFO allocation, expired/quarantined/undated exclusion, no stock, rollback, idempotency and concurrent last-stock attempts.
- [ ] Compare prescription items, batch deltas, product total, and movement before/after values after each disposable test.
- [ ] Re-run reconciliation diagnostics and review differences; discard/reset the disposable copy after evidence capture.

**Pass evidence:** signed physical reconciliation, approved FEFO/undated stock rules, transactional test results, and explicit owner approval for any later mode switch. No mode switch occurs as part of this checklist.

## 5. Label printing and clinical review

Before hardware testing, obtain pharmacist approval for Sinhala/English text, STAT wording, instruction order, required printed fields, minimum readable font and overflow-block handling.

Use the exact workstation, browser, driver, printer model, 70 × 50 mm stock/roll and orientation intended for the pharmacy. Record device/driver versions and retain anonymized photographs/scans of test output.

| Scenario | Setup / expected observation | Result / evidence |
|---|---|---|
| Sinhala text | Each approved Sinhala instruction renders with correct glyphs, signs and spacing; no tofu, substitution or clipping | [ ] Pass [ ] Fail; photo/sample: |
| English text | Medicine, patient and dosage text remain legible and are not clipped | [ ] Pass [ ] Fail; photo/sample: |
| Long medicine name | Full name fits at approved size/wrap or the UI blocks printing and names the field; no silent ellipsis | [ ] Pass [ ] Fail; photo/sample: |
| Long patient/brand names | Full identity text remains legible or safe overflow block is shown | [ ] Pass [ ] Fail; photo/sample: |
| Multiple labels | Print 1, 2, 5 and a representative maximum batch; order, page breaks and feed position remain correct | [ ] Pass [ ] Fail; count/order: |
| Dosage instructions | Morning/lunch/night, fractions, intervals, STAT/follow-up and approved instruction combinations match preview | [ ] Pass [ ] Fail; pharmacist initials: |
| Expiry information | Entered/recorded expiry is accurate, formatted consistently and not invented when absent | [ ] Pass [ ] Fail; sample: |
| Margins and scale | Browser print uses 100% scale/no margins; compare 70 × 50 mm cut edges to CSS dimensions | [ ] Pass [ ] Fail; measured: |
| Label alignment | First and repeated labels align within the stock's safe print area; no drift/cutoff | [ ] Pass [ ] Fail; offset: |
| Overflow protection | Include known busy/long-name cases S7/S12/S13; blocked labels remain blocked and explain why | [ ] Pass [ ] Fail; cases: |
| Reprint/save states | Save, invoke browser dialog, cancel, and reasoned reprint; records distinguish saved/dialog-invoked; no false printer acknowledgement | [ ] Pass [ ] Fail; event IDs: |

Physical acceptance is not complete until every required case passes and the pharmacist signs the output. Browser preview/PDF checks are not hardware verification.

## 6. Backup, restore and recovery

- [ ] Confirm backup schedule, retention, encryption, access and recovery-point objective for staging.
- [ ] Restore a snapshot into a separate isolated project, never over the source project.
- [ ] Verify restored schema, migration ledger, synthetic records and authentication configuration.
- [ ] Exercise API/web connection to restored project using staging credentials.
- [ ] Record elapsed restore time and any missing objects/secrets that must be provisioned separately.
- [ ] Confirm rollback/runbook owner and escalation contacts.

## 7. Security configuration and privacy operations

- [ ] Validate required environment variables at startup; no production values in staging.
- [ ] Owner verifies any previously exposed credentials have been rotated in the provider/control plane; do not include secret material in evidence.
- [ ] Confirm service-role key is restricted to API server runtime and absent from web environment variables delivered to browsers.
- [ ] Verify database grants, RLS policies, API role checks, TLS, CORS allowlist, rate limits and log redaction.
- [ ] Verify SMS test mode/provider mock first; live SMS requires separate owner approval, consent checks, opt-out, rate limiting and outcome logging.
- [ ] Confirm retention/access procedures for patient and prescription records with privacy counsel; no compliance claim from staging tests alone.
- [ ] Confirm monitoring, alert delivery, incident response and backup-failure alerts.

## Exit decision

- [ ] **PASS for limited staging pilot** — all required evidence reviewed and signed by owner, pharmacist, engineering and operations.
- [ ] **FAIL / remediation required** — list blocker, owner and due date:

Do not deploy to production, change production credentials, apply production migrations, enable transactional dispensing, send live SMS, or use these checks as proof of regulatory compliance. Each needs its own approved change and operational gate.
