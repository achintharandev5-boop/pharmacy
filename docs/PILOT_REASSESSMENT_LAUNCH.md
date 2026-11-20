# Report 4 — Production launch checklist

**NO-GO.** This is a single-pharmacy deployment, not shared SaaS approval.

| Gate | Status | Missing evidence / reason |
|---|---|---|
| G01 Dedicated pharmacy/frontend/API/database/secrets/storage isolation | NOT VERIFIED | Owner and independent infrastructure review of actual deployments and projects |
| G02 Exposed credentials rotated and obsolete credentials revoked | NOT VERIFIED | Authorized incident closure, safe old-key rejection and account reset evidence |
| G03 Safe and physically reconciled dispensing | FAIL | Legacy batch gap and retry boundary; no approved policy, activation or reconciled staging/physical stock |
| G04 Pharmacist clinical sign-off | NOT VERIFIED | Signed instruction-by-instruction review and accepted samples |
| G05 Intended staging migration history/schema | NOT VERIFIED | Local migrations pass; hosted schema and migration ledger absent |
| G06 Essential workflows on intended staged release | NOT VERIFIED | Local tests cannot replace hosted acceptance |
| G07 Physical 70 × 50 mm labels | NOT VERIFIED | Intended printer, driver, Sinhala glyphs, clipping and identity acceptance |
| G08 Reviewed reproducible release artifact | NOT VERIFIED | Dirty baseline unreviewed; no approved commit/tag/artifact or hosted CI run |
| G09 Operational backup restore | NOT VERIFIED | Local synthetic restore passes; provider backups, Auth/storage recovery and witnessed drill absent |
| G10 Operational monitoring and rollback | NOT VERIFIED | No actual alerts, incident contacts, recovery objectives or rollout/rollback exercise |
| G11 No unresolved P0 defects | FAIL | Original four critical gates plus critical dependency advisories remain open |

Totals: **0 PASS, 2 FAIL, 9 NOT VERIFIED** across eleven mandatory gates.

| Supporting requirement | Status | Scope |
|---|---|---|
| Preserve dirty source | PASS | Snapshot and SHA-256 manifest before edits |
| Frontend/backend TypeScript | PASS | Node 22 validation |
| Unit, smoke and local DB integration tests | PASS | 457 API + 2,181 web + 2 smoke + 60 DB |
| API lint | FAIL | 989 errors, 48 warnings; modified auth/startup modules clean |
| Frontend lint | PASS | Zero errors and warnings |
| Frontend/backend production builds | PASS | Node 22 isolated source copies; web worker retry exit 0; no deployment |
| Redacted source/history credential scan | PASS | Heuristic only; zero unreviewed matches; rotation remains unverified |
| Registry dependency audit | FAIL | 11 critical, 23 high, 34 moderate, 7 low reported findings; counts are advisory findings, not unique exploitable production flaws |
| Transactional migration/SQL checks | PASS | Disposable local PostgreSQL; synthetic only |
| Local synthetic dump/restore comparison | PASS | Rows/schema/security/sequences; not provider restore approval |
| Production SMS containment | PASS | Existing unconditional production block retained and tested |
| SMS delivery/consent/rate-limit acceptance | NOT APPLICABLE | Production SMS blocked; must pass before future enablement |
| Login throttling | PASS | Local process limiter tests; edge/shared limits NOT VERIFIED |
| Session refresh and logout revocation | FAIL | Refresh path absent; logout deletes cookies; copied-token behavior unverified |
| Complete sensitive-operation actor attribution | FAIL | Direct service-role patient/product writes can leave actor NULL |
| Physical stock reconciliation | NOT VERIFIED | Requires actual shelf/batch count and pharmacist/owner signatures |
| Shared SaaS tenancy and subscription billing | NOT APPLICABLE | Explicitly deferred; prohibited for this pilot |
| POS checkout/payments/invoices/sales persistence | NOT APPLICABLE | Unfinished and excluded from operational scope |
| Production deployment, live SMS, real dispensing | NOT APPLICABLE | Not authorized and not performed |

No non-dispensing CONDITIONAL GO is issued: enforcement and independent acceptance
of such restrictions have not been established.
