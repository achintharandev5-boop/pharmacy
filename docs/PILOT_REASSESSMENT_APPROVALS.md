# Report 5 — Human approvals and release recovery

All signatures remain pending. Existing detailed forms are retained in
[PILOT_OWNER_APPROVALS.md](PILOT_OWNER_APPROVALS.md),
[pharmacist sign-off](../PHARMACY_PHARMACIST_SIGNOFF.md), and
[printer acceptance](../PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md).

| Accountable owner | Required concrete evidence | Acceptance / signature |
|---|---|---|
| Pharmacy owner + infrastructure administrator | Exactly one organization; dedicated provider project/database/API/web/storage/secrets; project IDs and hostnames cross-checked; no SaaS onboarding or cross-environment fallback; wrong-project/wrong-pharmacy tests witnessed | Pending |
| Security owner + pharmacy owner | Rotate exposed credentials with explicit authorization; reset affected admin accounts, revoke obsolete keys/sessions, update API secret stores, review provider logs and verify rejected old credentials. Record identifiers/timestamps only, never values | Pending |
| Licensed pharmacist + owner | Approve FEFO allocation, undated/unbatched/expired stock rules, substitution/exception handling, quantity deductions and reconciliation; review retry-boundary proposal before any stock fix; approve staging mode activation only after witnessed synthetic rollback/concurrency tests | Pending |
| Licensed pharmacist + inventory owner | Reconcile physical shelf quantities, batches, product totals and movement ledger, with discrepancy register and independent checker | Pending |
| Licensed pharmacist | Approve Sinhala/English instructions, quantities, frequency, time-of-day, STAT, EOD, weekly, selected days, duration, food/product/ENT wording, expiry, identity, stored snapshots/reprints and incomplete-label guards | Pending |
| Pharmacist + printer operator | Physically print 70 × 50 mm samples: long names, all supported instructions, Sinhala glyphs, English, expiry, repeated alignment, clipping, scaling and medication/patient identity; record printer/driver/browser/OS/font versions | Pending |
| Infrastructure administrator | Isolated staging, synthetic data only, actual ordered migration ledger and hashes, storage/Auth configuration and safe SMS settings; witnessed essential browser/API workflows | Pending |
| Infrastructure + security owner | Provider backup schedule/retention/PITR, Auth/storage recovery, approved RPO/RTO, restore into separate target, row/security/schema comparison and independent witness | Pending |
| Release manager | Review all pre-existing changes and session delta; establish commit/tag/version, lock hash, successful CI, dependency fixes and artifact hashes; approve release candidate without deployment | Pending |
| Operations owner | Real health/readiness and failure alerts, redacted logs, contacts/escalation, audit actor coverage, provider brute-force protection and copied-token/logout test | Pending |

Recovery sequence: stop dispensing on integrity uncertainty; record the last known
completed transaction and reconcile before replay. Retain previous reviewed web/API
artifacts and secret-store version references. Restore database backups into a
separate target. Do not blindly downgrade schema, delete migration history, change
stock mode or replay prescriptions after a timeout. Verify identities, migration
hashes, sequences, data counts/security and synthetic workflows; owner/release
manager authorize any traffic switch separately.

Estimated remaining effort must be scheduled by owners after policy and infrastructure
evidence is supplied. Clinical/printer/reconciliation acceptance cannot be estimated
from source. No deployment, credential rotation or clinical approval is delegated
to this agent by these forms.
