# Pharmacy Label SaaS — Production Readiness Report

**Date:** 2026-10-30 · **Decision requested:** GO / NO-GO for staging, pilot and production
**Evidence base:** `PHARMACY_FULL_SYSTEM_AUDIT_2026.md` (this audit's test, build and static results), `PHARMACY_STAGING_RUNBOOK.md`, `docs/STAGING_READINESS_REPORT.md`, `docs/PHARMACIST_APPROVAL_REQUIRED.md`

## Verdict

| Stage | Verdict | Why |
|---|---|---|
| **Local development** | **READY** | Web 1994/1994 and API 253/253 tests pass; both builds and type checks pass; web lint clean |
| **Internal demonstration** (UI-test mode, no database) | **READY** | UI-test mode verified isolated (`lib/uiTestMode.ts:3`, `next.config.ts:3`); the workstation, admin shell and printing preview all render |
| **Isolated staging** | **NOT READY** | No staging project; credentials not rotated; uncommitted code with no remote; migrations `…000100`–`…25000100` never applied outside a local test database |
| **Controlled pharmacy pilot** | **NOT READY (NO-GO)** | All P0 items open: role gaps, sessions, batch dispensing, wording sign-off, physical print, backups |
| **Production / multi-pharmacy SaaS** | **NO-GO** | Additionally: no tenant isolation, no POS, no user management, no monitoring |

## Readiness by area

| # | Area | Verdict | Evidence |
|---|---|---|---|
| 1 | Functional completeness | PARTIALLY READY | 71.6% weighted implementation; POS 0%, Admin 36%, Reporting 44% (completion matrix) |
| 2 | Clinical workflow correctness | **NOT VERIFIED** | Wording S1–S3 / A1–A16 unsigned; `PHARMACY_PHARMACIST_SIGNOFF.md` has no signature |
| 3 | Security | **NOT READY** | 3 Critical, 5 High (audit §6) |
| 4 | Database safety | PARTIALLY READY | RLS deny-all and transactional functions are good; no tenancy, reconciliation or restore drill |
| 5 | Reliability | NOT VERIFIED | No load test; sessions expire hourly |
| 6 | Printing | **NOT VERIFIED** | Browser print only (69.85 × 50.12 mm); no physical test (B6) |
| 7 | UI/UX | PARTIALLY READY | Workstation 8/10 (latest report); admin screens: `PHARMACY_UI_UX_FULL_SYSTEM_AUDIT.md` |
| 8 | Testing | PARTIALLY READY | Strong unit coverage; no E2E, no CI, DB tests not re-run, 784 API lint problems |
| 9 | Deployment | **NOT READY** | No staging, monitoring or tested backups |
| 10 | Operational support | **NOT READY** | No remote repository; no support runbook exercised |

## Mandatory launch blockers (pilot)

| # | Blocker | Owner | Roadmap |
|---|---|---|---|
| 1 | Commit the working tree and add a private remote and backup | Owner + engineering | P0-01 |
| 2 | Rotate the service-role key and admin password | Owner | P0-02 |
| 3 | Decide tenancy: one deployment per pharmacy for the pilot | Owner | P0-03 |
| 4 | Explicit role policy on every API route, including the patient list and reprint | Engineering | P0-04 |
| 5 | Apply and verify migrations on staging (incl. Feature #21/#22 checks) | Owner approval + engineering | P0-05 |
| 6 | Pharmacist decisions D1–D3, stock count, batch-level dispensing on | Pharmacist + engineering | P0-06 |
| 7 | Pharmacist sign-off of all printed Sinhala wording | Pharmacist | P0-07 |
| 8 | Physical printer acceptance on the pharmacy's printer | Pharmacist + engineering | P0-08 |
| 9 | Session refresh + server-side session check | Engineering | P0-09 |
| 10 | Automated backups + one restore drill | Owner + engineering | P0-10 |
| 11 | Full staging acceptance run signed GO | Owner | P0-11 |

Strongly recommended before the pilot: login throttling (P1-08), SMS through the API with logging (P1-01), audit actor (P1-02), patient edit and soft delete (P1-03), self-hosted fonts (P1-09), CI (P1-10).

## Required approvals

| Approval | Who | Status |
|---|---|---|
| Credential rotation (O1) | Owner | **Open** |
| Role assignments and the no-role prescription rule (O2, O3) | Owner | **Open** |
| Staging project and migration apply (O4) | Owner | **Open** |
| Tenancy model for the pilot | Owner | **Open** (new in this audit) |
| Batch-level FEFO dispensing (D1), undated stock (D2), reconciliation (D3) | Pharmacist | **Open** |
| D4–D9 inventory rules | Pharmacist | **Open** (D4/D5 implemented as proposed) |
| Sinhala wording S1–S3, A1–A16, C-items | Pharmacist | **Open** |
| Physical print acceptance | Pharmacist | **Open** |
| Feature #21 Reasons staging verification | Owner + engineering | **Pending** |
| Feature #22 Expiry Date staging verification | Owner + engineering | **Pending** |
| Final GO | Owner | **NO-GO** |

## What "ready" will mean

The pilot may start when every blocker above is closed **with evidence**:
- a signed staging acceptance record (`PHARMACY_STAGING_RUNBOOK.md` §7);
- a signed pharmacist sign-off;
- a signed printer checklist;
- a restore drill record;
- a green CI run on the committed code.

UI test results alone are not evidence of production readiness.
