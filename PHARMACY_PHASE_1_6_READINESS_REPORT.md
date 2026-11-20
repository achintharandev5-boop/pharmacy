# Pharmacy Phase 1.6 Operational Readiness Report

**Date:** 19 October 2026  
**Branch:** `codex/phase1-safety-fixes`  
**Decision:** **NO-GO for a staging pharmacy pilot; NO-GO for Phase 2/POS implementation.**  
**Scope:** Local review of Phase 1.5 verification, staging/deployment docs, environment variable names, migration order, inventory diagnostics/SOP inputs, approval docs and POS design. No remote environment was accessed or modified, no stock was adjusted, and no dispensing-mode change was made.

## Summary

Phase 1.5 established passing local evidence: web lint/tests/build, API tests, and migration/dispensing/diagnostic suites against a disposable local PostgreSQL instance. Phase 1.6 converts the outstanding operational work into a staging runbook and sign-off documents. These documents are preparation only; Supabase staging state, actual credentials, backup configuration, pharmacy stock, account roles and printer output remain unverified.

The deployment guide and security audit record that a Supabase service-role secret and an administrator password were historically exposed in source and removed. **Rotation and revocation remain owner actions until independently confirmed in the provider control plane.** Secret values are not repeated here. The old backup archive referenced by the security audit may contain `.env` material and must remain encrypted/restricted or be securely retired by its owner.

The API must remain configured with `PRESCRIPTION_WRITE_MODE=legacy` or unset (legacy default) in all environments until stock is physically reconciled and the pharmacist authorizes a separately reviewed staging trial. This is not a recommendation to keep legacy mode indefinitely; legacy dispensing leaves batch balances stale, so current batch availability cannot be assumed accurate.

## Gate matrix

| Requirement | Status | Evidence / completion condition |
|---|---|---|
| Phase 1.5 local web/API and SQL checks | **PASS** | Recorded in `PHARMACY_PHASE_1_5_VERIFICATION_REPORT.md`; local-only evidence. |
| Required staging variable inventory | **PASS** | Names and server/client scope are documented in `PHARMACY_STAGING_RUNBOOK.md`; no values disclosed. |
| Migration order and dependency map | **PASS** | Repository deployment guide reviewed and transcribed into the runbook. |
| Migration ledger/schema compatibility of a real staging project | **NOT TESTED** | Requires owner-authorized Supabase staging access. |
| Migration approval and staging application | **BLOCKED** | Owner approval, backup/restore point, compatibility review and change window required. |
| Credential exposure remediation | **BLOCKED** | Owner must confirm new Supabase service-role key and admin password, revoke/reset old credentials, review access/tampering. No rotation was attempted. |
| Staging auth and actual role matrix | **NOT TESTED** | Requires staging Auth accounts and owner/pharmacist-approved roles. Prescription routes do not all enforce a dispensing-specific role. |
| Existing local auth/role test coverage review | **PASS, bounded** | Prior security audit records coverage for missing/malformed/invalid/expired tokens, auth outages, environment modes, route-by-route forged/unauthenticated requests, and role guard behavior. This does not prove staging identities/metadata or prescription role policy. |
| Tenant/branch isolation | **FAIL for multi-tenant readiness** | No tenant or branch model; API service-role client bypasses RLS. Must be designed and negatively tested before shared-tenant POS. |
| Backup and isolated restore | **NOT TESTED** | Requires owner-enabled staging backup and isolated restore environment. |
| Read-only stock diagnostic and synthetic tests | **PASS** | Tested locally in Phase 1.5; no live records inspected. |
| Real inventory reconciliation | **BLOCKED** | Requires authorized read-only export, witnessed physical counts, pharmacist/owner classification and documented approvals. |
| Transactional dispensing cutover | **BLOCKED** | Keep legacy mode; requires completed reconciliation, policy approval and staging sign-off. |
| Pharmacist clinical/workflow approval | **BLOCKED** | Checklist prepared in `PHARMACY_PHARMACIST_SIGNOFF.md`; approval not received. |
| Accountant/tax/payment decisions | **BLOCKED** | Decision register prepared in `PHARMACY_ACCOUNTING_DECISIONS.md`; approval not received. |
| Physical label printer acceptance | **NOT TESTED** | Test matrix prepared; exact printer, driver, roll, workstation and pharmacist sign-off required. |
| POS technical design | **PARTIAL** | Strong proposal exists, but tenant authorization, payment/invoice policy, links, and operational rules remain unresolved. No POS code exists. |
| Controlled staging pharmacy pilot | **NO-GO** | Mandatory security, data, clinical, backup, role, and print gates are incomplete. |
| Phase 2/POS development | **NO-GO** | Tenant/branch authorization, stock correctness, clinical and accounting decisions are prerequisites. |

## Required deliverables

- `PHARMACY_STAGING_RUNBOOK.md` — environment variables, migration preflight/order, deployment verification, rollback and backup/restore procedure.
- `PHARMACY_STOCK_RECONCILIATION_SOP.md` — export, read-only comparison, physical count, approval and transactional cutover procedure.
- `PHARMACY_PHARMACIST_SIGNOFF.md` — clinical, dispensing, stock and label decisions requiring pharmacist sign-off.
- `PHARMACY_ACCOUNTING_DECISIONS.md` — receipt/invoice, tax, numbering, tender, pricing/costing and reconciliation decision register.
- `PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md` — 70×50 mm hardware acceptance cases and evidence form.

## POS readiness decision

The POS proposal identifies useful entities and invariants: organization/branch/membership, explicit unit conversion, sale snapshots, batch allocations, atomic checkout, idempotency, tenders, invoices, return/refund links, print attempts, and API modules. It remains incomplete for implementation because the product has no tenant boundary and its API service role bypasses RLS. Before writing POS schema, resolve tenant context enforcement and backfill, pharmacist/owner/accountant decisions, product units and pricing, cash drawer/change handling, invoice number semantics, returns/refund/restocking, prescription partial-fill links, and print job references. Build and test tenant/branch authorization first.

## Required next action

Owner authorizes a dedicated staging project or restored isolated copy, confirms secret rotation/revocation and backup availability, and assigns a rollback owner. Engineering performs the runbook preflight read-only first and stops on any mismatch. The pharmacist leads stock and label approvals; the accountant/tax advisor records invoice/payment decisions. Return for a go/no-go review with signed evidence. This report grants no permission to create resources, apply migrations, change credentials, alter stock, enable transactional dispensing, or deploy.
