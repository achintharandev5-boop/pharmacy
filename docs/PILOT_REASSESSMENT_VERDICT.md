# Report 6 — Independent CTO verdict

**PREVIOUS READINESS: 44/100** (historical, supplied by owner)

**CURRENT READINESS: 58/100** (explicit evidence checkpoint model below)

**IMPROVEMENT: +14 points** (arithmetic difference only; historical subcriteria
were not supplied, so this is not a validated like-for-like improvement measure)

**P0 ISSUES RESOLVED: 0 complete acceptance workstreams**

**P0 ISSUES REMAINING: 8 workstreams; all 4 historical critical gates remain open**

**HIGH-SEVERITY ISSUES REMAINING: total not fully enumerated; 23 high registry
findings plus open session-lifecycle/audit-attribution defects**

**REGRESSION TESTS: 2,700 passed / 0 failed**

**UNVERIFIED LAUNCH GATES: 9 of 11; the other 2 FAIL**

**GO-LIVE DECISION: NO-GO**

**ESTIMATED WORK REMAINING: not reliably quantifiable until dependency remediation,
stock-policy approval, hosted access and human acceptance scheduling are established.**

**RECOMMENDED NEXT ACTION: fix critical/high dependency findings in a preserved,
isolated candidate and rerun all gates; obtain the pending stock correction approval,
credential incident closure, dedicated infrastructure evidence and pharmacist sign-off.**

## Scoring method

The original seven category weights are used. Each category has five explicit,
equally weighted evidence checkpoints (20 category points each). PASS earns points;
FAIL or NOT VERIFIED earns zero. Local evidence is credited only where the checkpoint
explicitly says local. This is a reproducible conservative scoring convention,
not a measurement of clinical safety, a SaaS certification, or the unavailable
historical subcategory rubric. No code change earns points without executed evidence.

| Category | Weight | Passing checkpoints | Missing/failing checkpoints | Category score | Contribution |
|---|---:|---|---|---:|---:|
| Feature completeness | 20% | Local patient/product workflows; local workstation instruction tests; local inventory workflows; existing POS catalogue/cart/lookup tests | Intended staging essential workflow acceptance | 80 | 16 |
| Security | 20% | API negative-role/token tests; local wrong-pharmacy/config-binding tests | Actual deployment isolation; rotation/revocation closure; complete session lifecycle acceptance | 40 | 8 |
| Backend/database | 15% | API unit suite; disposable ordered migrations/RLS checks; transactional SQL consistency/concurrency | Safe reconciled active dispensing mode; hosted schema compatibility | 60 | 9 |
| Frontend/UX | 10% | TypeScript; lint; full web suite; isolated production build | Physical printer and pharmacist label acceptance | 80 | 8 |
| Testing/QA | 15% | API regression; web regression; local DB integration and API smoke | All release lint/security gates green; hosted essential E2E acceptance | 60 | 9 |
| Infrastructure/deployment | 15% | Node 22 isolated API build; Node 22 isolated web build | Reviewed release commit/artifact; hosted successful frozen-install CI; dedicated hosts/secrets verification | 40 | 6 |
| Monitoring/recovery | 5% | Local health-route tests; synthetic dump/restore comparison | Operational alerts/contacts; provider backup/Auth/storage restore; witnessed operational rollback | 40 | 2 |
| Total | 100% | | | | **58** |

## Remaining critical controls

The historical four critical gates—deployment isolation, credential rotation,
dispensing integrity and pharmacist clinical approval—are still open. Critical
dependency advisories are an additional release blocker. No acceptance workstream
P0-01 through P0-08 is entirely closed. Small technical fixes and clean automated
tests do not close external or clinical gates.

Known follow-up defects: unsafe legacy retry boundary; product/batch mismatch in
legacy mode; vulnerable dependency graph; missing refresh/server logout acceptance;
incomplete authenticated actor attribution; broad lint debt. No attempt was made to
change active stock accounting without explicit owner/pharmacist approval.

No clinical dispensing GO or non-dispensing CONDITIONAL GO is issued. The latter
would require enforced restrictions and independent acceptance not supplied here.
Physical reconciliation, actual printed output and licensed clinical approval are
outside the authority of this agent.

Supporting reports: [remediation](PILOT_REASSESSMENT_REMEDIATION.md),
[test execution](PILOT_REASSESSMENT_TESTS.md),
[feature matrix](PILOT_REASSESSMENT_REGRESSIONS.md),
[launch checklist](PILOT_REASSESSMENT_LAUNCH.md), and
[human approvals](PILOT_REASSESSMENT_APPROVALS.md).
