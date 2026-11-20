# Pilot approval and operating record — unsigned

Status: **NO-GO for clinical dispensing**. Blank fields are NOT VERIFIED.
This document records human decisions; automated checks cannot sign it.
Release candidate: pending reviewed commit, lockfile digest and build digest.

## Owner and infrastructure administrator

| Required evidence | Record / approver / date |
|---|---|
| One pharmacy legal/operational identity and UUID | |
| Dedicated staging and pilot Supabase project references, independently checked | |
| Dedicated frontend/API hosts; no shared pharmacy database or tenant onboarding | |
| Separate secret stores, storage buckets, restricted bucket policies and staff accounts | |
| API `SUPABASE_URL` equals approved `PILOT_SUPABASE_URL`; web API target equals `PILOT_API_URL` | |
| Every approved account has correct server-managed `app_metadata.role` and `pharmacy_id` | |
| Attempted login/data access with wrong project, wrong pharmacy, no role and cashier role | |
| Dedicated HTTPS origins, CORS, proxy source-IP policy, network egress and firewall review | |
| Staging contains synthetic records only; no copied patient data | |
| Monitoring destinations and named on-call/incident contacts | |

Do not give cashier accounts clinical APIs. Service-role RLS bypass is intentional
only inside this isolated API. An operator with that credential can bypass the API;
restrict it to API secret storage. The same identifier in two configuration values
does not independently prove isolation: review provider project identity and data.

## Security owner: credential incident closure

1. Identify affected credential IDs and accounts using private incident records; never
   paste key/password values into this repository, tickets, logs or this form.
2. With explicit owner authorization, rotate exposed Supabase secret/service-role
   credentials using the provider procedure; legacy JWT signing-secret rotation may
   affect other tokens and requires a separately approved session-impact plan.
3. Reset affected administrator passwords, review MFA, terminate affected sessions,
   remove unauthorized identities and revoke obsolete API/provider credentials.
4. Update only the dedicated API secret store; keep privileged keys out of the web
   host/build environment. Verify old credential rejection with a safe read-only probe.
5. Review provider Auth/API/database/storage access logs over the exposure period;
   investigate unexplained patient, prescription, inventory and account changes.
6. Review historical backups and source archives for restricted access and encryption.
7. Verify authorized login and role access after rotation; record old credential IDs,
   revocation timestamps, evidence references, operator and independent reviewer.

Rotation/revocation confirmation: ______. Owner: ______. Security reviewer: ______.
Until signed, the credential gate remains blocked even if source scans are clean.

## Licensed pharmacist and owner: stock policy

Review current implementation and synthetic test evidence alongside a physical count.
No switch from `legacy` to `transactional` is approved by this document.

| Decision / acceptance test | Decision, fixture/sample ID, signature/date |
|---|---|
| FEFO: earliest eligible expiry, then receipt time and stable batch ID | |
| Allocation across multiple batches and label expiry matching | |
| Undated batches and unbatched stock; approved exceptions, if any | |
| Expired stock, expiry-day boundary and Asia/Colombo timezone | |
| Quarantine, returns, disposal and authority to release stock | |
| Whole dispensed units versus dose fractions and product types | |
| Failed transaction leaves no partial deductions; duplicate retry takes no extra units | |
| Concurrent dispensing and stock receipt/adjustment interaction | |
| Product totals, batches, movement ledger and physical count reconcile | |
| Discrepancy register, correction approvals, recount and recovery procedure | |
| Exception handling and escalation before dispensing resumes | |
| Exact environment, migration hashes and approved dispensing-mode activation plan | |

Physical reconciliation performed by: ______. Independent checker: ______.
Owner approval: ______. Licensed pharmacist name/registration/signature/date: ______.

## Licensed pharmacist: clinical and physical label acceptance

Retain the detailed existing `PHARMACY_PHARMACIST_SIGNOFF.md` and
`PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md`. Link accepted samples here.

| Instruction / printed detail | English + Sinhala sample IDs; accept/reject; signer/date |
|---|---|
| Morning/lunch/night, dose integers and fractions | |
| 5H/6H/8H and daily/evening/four-times instructions | |
| STAT and follow-up sequence | |
| Every-other-day and weekly dosage/confirmation | |
| Specific days, start/end day and duration | |
| Take/give and before/after/with-food/empty-stomach instructions | |
| Chew, dissolve/drink, keep-in-mouth and product-type directions | |
| Eye/ear/nose and custom ENT intervals | |
| Reason catalogue wording and existing/current/spec wording modes | |
| Expiry, batch, patient and medicine identity; long names | |
| Incomplete/invalid labels refused; cancelled quantity can be recovered | |
| Saved snapshot/history reprint preserves the original clinical instructions | |

Print actual 70 × 50 mm labels using the intended printer, driver and roll. Record
printer model, driver/version, OS/browser, scaling/margins and font configuration.
Inspect Sinhala glyphs, readability, alignment, clipping, medication/patient identity,
expiry and repeated-label alignment; scan representative barcode output if present.
Browser preview or jsdom assertions do not count as a physical printer test.

Ambiguities for decision: current versus `spec` wording is not clinically approved
by appearance; English UI wording does not establish English clinical coverage;
week/day/STAT combinations, product-type units and handling of valid unbatched stock
need explicit decisions. Do not silently translate or adjust clinical semantics.

Pharmacist clinical approval: ______. Physical output acceptance: ______.

## Release manager and infrastructure administrator

Record reviewed commit/tag: ______; approved release version: ______; dependency
lock hash: ______; artifact hashes: ______; CI run: ______; schema ledger: ______.
No release artifact is approved until review includes the pre-existing dirty work.

Record backup schedule/retention/PITR, actual recovery point and restore target,
restore duration, table/constraint/RLS/function/sequence comparisons, Auth/storage
recovery, recovery objectives and independent witness. Local synthetic restoration
does not establish that provider-managed backups, users and storage are recoverable.

Before release, verify health/readiness alerts, redacted error logs, database failures,
audit actor coverage, login throttling/provider settings, expiry/re-login and copied
token behavior after logout. Production SMS stays disabled; no patient sends.
POS remains catalogue/cart/lookup only, without checkout/payments/invoices.

Rollback: retain the previous reviewed web/API artifacts and secret-store version
references. On incident, stop dispensing, record the last known completed transaction
and reconcile stock before recovery. Restore a database into a separate target;
never blindly downgrade schema or switch dispensing modes after transactions.
Choose a compatible artifact or reviewed forward repair; approve any traffic change
separately. Verify migration ledger, identities, data counts, sequences and synthetic
workflows before reopening. Never replay dispensing merely because the UI timed out.

Final owner acceptance: ______. Pharmacist: ______. Infrastructure/security: ______.
Release manager decision and explicit restrictions: ______.
