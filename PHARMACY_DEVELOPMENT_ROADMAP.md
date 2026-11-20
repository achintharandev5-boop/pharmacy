# Pharmacy Label SaaS — Development Roadmap

**Date:** 2026-10-30
**Basis:** `PHARMACY_FULL_SYSTEM_AUDIT_2026.md` (read-only audit of the current working tree on `codex/phase1-safety-fixes`, HEAD `e3c15e4` plus uncommitted work)
**Companion documents:** `PHARMACY_FEATURE_COMPLETION_MATRIX.md`, `PHARMACY_PRODUCTION_READINESS_REPORT.md`

## Estimating assumptions

- Hours are **engineering hours for one developer familiar with this codebase**, including the code change, automated tests, and a short report. They exclude pharmacist and owner time, waiting for approvals, and calendar time.
- Ranges reflect uncertainty, and the low end assumes no surprises.
  - Tasks touching clinical wording, dispensing or the database carry the widest ranges, because they need review cycles.
  - Every database task assumes the existing migration-test harness (`apps/api/supabase/tests/run-migration-tests.sh`) is used locally first, then staging.
- "Regression risk" refers to the risk of breaking existing behaviour, not to the task's difficulty.
- Effort for POS (P3) is a sizing from the existing design (`PHARMACY_POS_TECHNICAL_DESIGN.md`), not a plan.

---

## P0 — Critical launch blockers

These must be closed before **any real patient label is printed in a pharmacy**.

| ID | Module | Problem (evidence) | Required development | Dependencies | Hours | Regression risk | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| **P0-01** | Engineering process | All work since 2026-10-10 is uncommitted (85 modified files, +6,120/−2,565; 326 untracked files, ≈43.9k lines), and **there is no git remote**. One disk failure loses Features #1–#22. | Owner-approved: review and commit the working tree in logical commits; add a private remote; enable off-machine backup. | Owner approval; concurrent sessions stopped | 6–10 | Low | `git status` clean; remote contains all commits; restore tested on a second machine | Clone from remote, install, run tests and build |
| **P0-02** | Security | Exposed Supabase service-role key and admin password not yet rotated (`docs/STAGING_READINESS_REPORT.md` §8, B1). | Owner rotates both; update local and staging env files; never commit them. | — | 1–2 | Low | Old key rejected; API starts with the new key | API `/health/db` with the new key; old key fails |
| **P0-03** | Tenancy | "SaaS", but **no tenant model**: no table except `reasons` has `pharmacy_id`, and the API uses the service-role key, which bypasses RLS (`apps/api/src/supabase/supabase.service.ts:20`). Any second pharmacy on the same database would see all patients. | **Decision first.** (a) Pilot: one Supabase project and deployment **per pharmacy** (document it, block multi-pharmacy use), or (b) build tenancy: `pharmacy_id` on every tenant table, backfill, composite indexes, enforcement in every service query, tests per endpoint. | Owner decision | (a) 4–6 / (b) 80–120 | (a) Low / (b) **High** | (a) Runbook states single-tenant deployment. (b) Cross-tenant read/write tests fail closed for every endpoint | (b) Two-tenant integration tests on local Postgres, then staging |
| **P0-04** | Authorization | Routes without `@Roles` admit **any signed-in user, including one with no role** (`apps/api/src/auth/roles.guard.ts:17`). This includes `GET /customers` (full patient list, no limit), `GET/POST /labels`, `GET /admin/patients/:id`, `GET /admin/prescriptions`, `GET /products/*`, `GET /inventory/*`, `GET /suppliers`, and the **write** `POST /admin/prescriptions/:id/reprint`. | Add `@Roles(...ALL_ROLES)` (or narrower) to every non-public controller, or a class-level default; add a guard test that enumerates routes and fails on any route without an explicit policy. Paginate `GET /customers`. | Owner decision O2/O3 (role assignment) | 8–12 | Medium (role-less accounts lose access by design) | A role-less token receives 403 on every non-public route | Unit test enumerating routes; staging sign-in with a role-less account |
| **P0-05** | Database | Migrations `20261010000100`–`20261025000100` not applied or verified on staging (`PHARMACY_STAGING_RUNBOOK.md` final line: NO-GO; `docs/FEATURE_21_DATABASE_VERIFICATION.md`). | Follow the runbook: backup, preflight, apply, verify schema, run the Feature #21/#22 checks. | P0-02, staging project (O4) | 8–16 | Medium | All verification queries pass; Reasons and dispensing-batch endpoints work against staging | `supabase/diagnostics/*.sql`, runbook §7 record |
| **P0-06** | Dispensing / Inventory | Default `PRESCRIPTION_WRITE_MODE=legacy` deducts the **product total only** with compensating rollback, so batch quantities drift from reality (`apps/api/src/config/env.validation.ts`, `prescriptions.service.ts:79`). Batch-level FEFO (`create_prescription`) is built but **off**. Batches not reconciled (D3). | Pharmacist approves D1/D2; physical stock count and reconciliation (D3, `PHARMACY_STOCK_RECONCILIATION_SOP.md`); switch staging to `transactional`; re-run the dispensing concurrency tests. | P0-05, pharmacist | 16–24 | **High** | Dispensing deducts the batch the label's expiry came from; batch totals equal product totals; concurrent dispensing never goes negative | `supabase/tests/40_dispensing_concurrency_test.sh` on staging-like data; reconciliation query returns 0 mismatches |
| **P0-07** | Clinical wording | Sinhala wording approvals open: S1–S3, A1–A16, C items (`docs/PHARMACIST_APPROVAL_REQUIRED.md`). Some schedules print **no** frequency sentence (A16), and the "spec" wording is behind a switch. | Pharmacist signs off each item; engineering applies the approved wording and switches modes; regression tests updated by approved expected text only. | Pharmacist | 8–24 | **High** | Signed `PHARMACY_PHARMACIST_SIGNOFF.md`; every printed combination has approved text or is refused at DONE | Sinhala output tests; printed samples reviewed by the pharmacist |
| **P0-08** | Printing | **No physical print has been verified** (B6). Browser print only (69.85 × 50.12 mm). | Run `PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md` on the pharmacy's printer and driver; fix scaling and margins found. | P0-07 (final wording) | 4–12 | Medium | Every checklist row passes on paper; Sinhala legible at the minimum size (B9) | Signed checklist with photos |
| **P0-09** | Auth / Sessions | Only the access token is stored (cookie `maxAge` = `expires_in`, about 1 h; `apps/web/app/actions/auth.ts:77-82`); no refresh, so staff are signed out mid-shift. `apps/web/proxy.ts:11` checks only that a cookie exists (B4). | Store the refresh token server-side (httpOnly) and refresh before expiry; verify the session server-side in the proxy or layout before rendering admin pages; sign-out on refresh failure. | — | 12–20 | Medium | An 8-hour shift with no forced sign-out; an expired or forged cookie never renders an admin page | Unit tests + staging soak with real Supabase Auth |
| **P0-10** | Operations | No tested backup/restore for the database (runbook §3 is procedure only). | Configure automated backups (Supabase PITR or scheduled dumps); perform and record one restore drill. | Staging | 4–8 | Low | A restore drill recovers a dated snapshot with prescriptions intact | Restore record in the runbook |
| **P0-11** | Release | Full staging acceptance run not done (B9: real sign-in, real print, one SMS). | Execute `docs/STAGING_DEPLOYMENT_CHECKLIST.md` end to end. | P0-01…P0-10 | 8–16 | Low | Checklist signed GO by the owner | Signed acceptance record |

**P0 total:** 79–150 h with the per-pharmacy deployment option (P0-03a), or 155–264 h with full multi-tenancy (P0-03b).

---

## P1 — Essential functionality for a controlled pilot

| ID | Module | Problem | Required development | Dependencies | Hours | Risk | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P1-01 | SMS | SMS sent from the Next.js server action straight to text.lk; not recorded in `sms_messages`; no rate limit (`apps/web/app/actions/sms.ts:99`, B3) | Move sending into the API, persist each message and outcome, add per-user and per-patient rate limits | P0-04 | 12–16 | Medium | Every send has an `sms_messages` row; limit enforced; gateway errors surfaced |
| P1-02 | Audit | Actor not recorded for direct API writes (B11); no audit-log viewer | Set `app.user_id` per request (or `created_by`/`updated_by` everywhere); admin read-only audit view | P0-05 | 16–24 | Medium | Every mutation has actor, time, before/after |
| P1-03 | Patients | No edit endpoint (`customers.controller.ts` has no PATCH); no duplicate detection; delete is a hard delete that nulls `customer_id` on prescriptions | PATCH with validation; duplicate phone warning; soft-delete/archive | — | 12–18 | Low | Edit preserves history; duplicates flagged; archive keeps the prescription link |
| P1-04 | Prescriptions | No cancel/void (status `CANCELLED` exists in schema, unused) | Void with mandatory reason, stock reversal per batch, event row, permissions | P0-06, pharmacist rule | 16–24 | High | Void restores exactly the dispensed batches; cannot void twice |
| P1-05 | Users | No user management UI or API; roles via `scripts/set-user-role.js` | Admin API using Supabase admin: invite, assign role, deactivate (ban); UI | P0-04 | 20–30 | Medium | Admin manages accounts without the CLI; deactivated users rejected |
| P1-06 | Auth | No password reset (login says "ask the administrator") | Supabase reset-email flow, or admin-initiated reset in P1-05 | P1-05 | 6–10 | Low | User resets without engineering help |
| P1-07 | Settings | Pharmacy details only via environment (`lib/pharmacyBranding.ts`); no settings endpoint (B6) | `pharmacy_settings` API + form; label footer reads it | P0-05 | 8–12 | Low | Changing details updates the next label |
| P1-08 | Security | No login rate limiting; no security headers (no helmet/throttle in `apps/api`) | `@nestjs/throttler` on `/auth/login`; helmet; `forbidNonWhitelisted: true` review | — | 4–8 | Low | 6th failed login in a minute is throttled |
| P1-09 | Printing | Sinhala fonts load from Google Fonts at runtime (`app/globals.css:1`, `PrintableLabel.tsx`); an offline till falls back to system fonts | Self-host Gemunu Libre / Noto Sans Sinhala; re-run print checks | P0-08 | 4–6 | Medium | Correct print with the network disconnected |
| P1-10 | Quality | No CI; web suite times out at the 5 s default under load (57 timeouts in the Phase 0 baseline) | CI pipeline (tsc, lint, unit, build); raise `testTimeout` or split heavy tests | P0-01 | 8–12 | Low | Green CI on every commit |
| P1-11 | Quality | No end-to-end tests against a real API and database for the critical path | Playwright: sign-in → label → Print & Save → stock deducted → reprint | P0-05 | 24–40 | Low | E2E suite green on staging |
| P1-12 | API lint debt | See audit §8 for the measured count | Fix new-code errors; baseline the rest with a ratchet | — | 8–24 | Low | Lint count never increases in CI |
| P1-13 | Reliability | Concurrency and load untested beyond the scripted DB tests | Load test on staging: 3–5 concurrent tills, 10k products, stock contention | P0-05, P0-06 | 8–16 | Low | p95 search < 500 ms; no negative stock |
| P1-14 | Legacy | `POST /labels` writes legacy `labels` rows with no role check | Restrict to roles or remove if unused | P0-04 | 2–4 | Low | No unauthenticated-role writes |

**P1 total:** 148–244 h.

---

## P2 — Important improvements

| ID | Module | Work | Hours | Risk |
|---|---|---|---|---|
| P2-01 | Reporting | CSV/Excel export for prescriptions, stock movements and expiry; custom date ranges | 12–20 | Low |
| P2-02 | Reporting | Dispensing report per pharmacist/day; controlled-medicine log if required | 12–20 | Low |
| P2-03 | UI/UX | Admin pages accessibility and responsive pass (audit in `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md`) | 16–24 | Low |
| P2-04 | UI/UX | Manual screen-reader pass (NVDA) and pharmacist usability session on the workstation | 8–12 | Low |
| P2-05 | UI/UX | Remaining workstation items: 10–11 px captions, duplicate EXP control decision, 1920 density | 6–10 | Low |
| P2-06 | Inventory | Reconciliation UI over the read-only diagnostic (`supabase/diagnostics/inventory_reconciliation_readonly.sql`) | 12–16 | Low |
| P2-07 | Inventory | Supplier returns UI review; expired-delivery rejection record (D6) if wanted | 8–16 | Medium |
| P2-08 | Operations | Error monitoring (e.g. Sentry) and structured API logs | 8–12 | Low |
| P2-09 | Platform | Node 22 LTS upgrade (O5) | 4–6 | Low |
| P2-10 | Prescriptions | Real drafts (B3 in the approvals doc: "Save without printing" saves COMPLETED) if wanted | 12–20 | Medium |

**P2 total:** 98–156 h.

## P3 — Future enhancements

| ID | Module | Work | Hours (sizing) |
|---|---|---|---|
| P3-01 | POS | Full POS per `PHARMACY_POS_TECHNICAL_DESIGN.md`: catalogue pricing, cart, discounts, tax, payments, invoices, receipts, returns/refunds, cashier permissions, history | 240–400 |
| P3-02 | Reporting | Sales and financial reports (needs P3-01) | 40–60 |
| P3-03 | Inventory | Multi-branch stock transfers | 40–60 |
| P3-04 | Printing | Invoice/receipt printing (needs P3-01) | 20–40 |
| P3-05 | Patients | SMS reminders, refill prompts | 24–40 |

---

## Recommended sequence

1. **Weeks 1–2: secure and stabilise.** P0-01, P0-02, P0-03(a), P0-04, P1-08, P1-10.
2. **Weeks 2–4: data integrity and clinical approval.** P0-05, P0-06, P0-07 (pharmacist time is the critical path), P0-09, P0-10.
3. **Weeks 4–6: pilot essentials.** P1-01…P1-07, P1-09, P1-11, P1-13; then P0-08 and P0-11 (staging GO).
4. **Pilot:** one pharmacy, one deployment, daily backups, P2 items as feedback arrives.
5. **After the pilot:** tenancy (P0-03b) if more than one pharmacy shares an installation, then POS (P3).

**Remaining work to a controlled single-pharmacy pilot (P0 with option a, plus P1): ≈ 227–394 engineering hours** (about 6–10 weeks for one developer), plus pharmacist and owner time for decisions D1–D9, O1–O5 and the wording sign-off.
