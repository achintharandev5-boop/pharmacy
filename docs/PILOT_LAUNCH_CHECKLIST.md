# Report 4 — Production launch checklist

Decision: **NO-GO**. This is a single-pharmacy pilot checklist, not SaaS certification.
Each status applies only to the evidence scope described. No unsigned approval is PASS.

## Eleven mandatory launch gates

| ID | Requirement | Status | Evidence / missing closure |
|---|---|---|---|
| G01 | Verified dedicated single-pharmacy isolation | NOT VERIFIED | Local identity/URL guards exist; provider projects, hosts, storage, secrets and network isolation need independent owner evidence |
| G02 | Confirmed exposed credential rotation and revocation | NOT VERIFIED | Redacted offline scan cannot establish whether old credentials remain active |
| G03 | Safe and reconciled dispensing behavior | FAIL | Default legacy writes do not maintain batch deductions; reconciliation and mode/policy approval absent; retry-boundary correction awaits authorization |
| G04 | Signed licensed-pharmacist clinical approval | NOT VERIFIED | Existing and new approval forms remain unsigned |
| G05 | Verified staging and database migration ledger | NOT VERIFIED | All nine migrations tested locally; intended hosted schema/history not inspected |
| G06 | Successful essential workflows on intended staging release | NOT VERIFIED | Local synthetic API/unit evidence is not hosted acceptance or a real printer workflow |
| G07 | Accepted physical 70 × 50 mm label output | NOT VERIFIED | No physical samples, printer/driver record or pharmacist acceptance |
| G08 | Reviewed release artifact and reproducible release commit | NOT VERIFIED | Baseline preserved, CI defined; dirty source not reviewed/committed, no remote or approved artifact |
| G09 | Verified operational backup restoration | NOT VERIFIED | Local synthetic dump/restore passed; provider backup schedule, Auth/storage recovery, RPO/RTO and witnessed drill missing |
| G10 | Operational monitoring and rollback | NOT VERIFIED | Liveness and procedures exist; no verified production alerts, incident contacts or rollback exercise |
| G11 | No unresolved P0 defects | FAIL | Core dispensing/approval/isolation/rotation gates remain; dependency audit adds critical advisories |

Mandatory-gate totals: **0 PASS, 2 FAIL, 9 NOT VERIFIED, 0 NOT APPLICABLE**.
The count is defined by these eleven gates; it is not a comparison to the historical
fourteen unverified requirements, whose original granular rubric was not supplied.

## Supporting technical controls

| Requirement | Status | Evidence / limit |
|---|---|---|
| Preserve all initial dirty source before edits | PASS | Source ZIP, SHA-256 manifest, binary patches and initial 365-entry status recorded before changes |
| Do not reset/clean/commit unrelated work | PASS | No reset, clean, checkout, automatic commit or push used |
| Supported runtime available for release validation | PASS | Official Node 22.23.4 archive downloaded and SHA-256 checked; system installation retained |
| Frontend/backend TypeScript | PASS | Node 22 checks exit 0; see test report for exact source/check timing |
| Frontend lint | PASS | 0 errors / 0 warnings |
| Backend lint | FAIL | Exact current result in test report; no rules suppressed to pass |
| Authentication/role tests | PASS | Baseline 440 API tests passed outside sandbox; targeted pharmacy binding/token tests passed; final rerun recorded separately |
| Full final regression suites | NOT VERIFIED | Use final test execution report; a started command or partial log is not success |
| Frontend/backend production builds | NOT VERIFIED | Backend baseline build passed; web baseline hit sandbox denial and resource stall; final results must be recorded independently |
| Root manifest/lock consistency | PASS | Isolated offline frozen lockfile-only validation exit 0 before dependency candidate changes |
| Credential scanning | PASS | Current source/local env and reachable history scanned with redacted output; zero unreviewed findings; not proof of rotation |
| Dependency advisory gate | FAIL | Registry audit reports critical/high advisories; isolated patch candidate is not an approved installed release |
| Global API role boundary | PASS | Fail-closed AuthGuard/RolesGuard, negative route tests and wrong-pharmacy tests; hosted assignments still unverified |
| Browser privileged credential exposure | NOT VERIFIED | No known privileged source key found; actual hosted bundles/secret injection require inspection |
| Production SMS containment | PASS | Production blocked regardless of legacy flag; provider code retained; mocked negative tests only |
| SMS recipient authorization/consent/rate/audit/provider acceptance | NOT APPLICABLE | Disabled in production pilot; must be verified before any future enablement |
| API login throttling | PASS | HTTP test proves 11th attempt rejected with Retry-After, spoofed forwarding ignored and window recovery |
| Edge/provider login protections | NOT VERIFIED | In-memory process limiter is not shared across restarts/replicas; reverse-proxy policy and hosted Auth settings absent |
| Session refresh and logout revocation | FAIL | Current logout clears cookies only; refresh token path absent; provider copied-token behavior not tested |
| Actor attribution for all sensitive changes | FAIL | Direct service-role patient/product CRUD can leave audit actor NULL |
| Local migration/SQL concurrency checks | PASS | Fresh audit-only PostgreSQL 18 cluster; synthetic fixtures; RLS/grants and competing/duplicate dispensing tests pass |
| Local synthetic backup restore | PASS | Separate target; all row digests and schema/security/sequence signatures match; 12-second backup/restore |
| Physical stock reconciliation | NOT VERIFIED | Source review and synthetic balances cannot prove pharmacy shelf/batch totals |
| Clinical wording, dose calculations and stock policy preserved | PASS | No wording/dosage/allocation migration or dispensing-mode default changed by this effort |
| POS catalogue/cart/lookup preserved | NOT VERIFIED | Existing tests are in final regression evidence; operational staging acceptance absent |
| POS checkout/payments/invoices/sales persistence | NOT APPLICABLE | Unfinished and outside this pilot's operational scope; never represented as complete |
| Shared SaaS tenancy/subscription onboarding | NOT APPLICABLE | Explicitly deferred; one isolated database/deployment only |
| Production deployment/production data writes/live SMS | NOT APPLICABLE | Prohibited in this remediation; none performed |

Forms and precise owner tasks: [PILOT_OWNER_APPROVALS.md](PILOT_OWNER_APPROVALS.md).
Technical boundaries: [PILOT_ARCHITECTURE_AND_SAFETY_REVIEW.md](PILOT_ARCHITECTURE_AND_SAFETY_REVIEW.md).
