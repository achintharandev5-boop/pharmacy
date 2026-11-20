# Report 1 — Independent pilot remediation, 2026-11-02

This report describes the current session. Existing pilot reports and fixes were
already present and are not attributed to this session. Decision: **NO-GO**.

## Phase 0: baseline and change safety

- Branch: `codex/phase1-safety-fixes`.
- HEAD: `e3c15e42ccbffe63372455d9b10575374611a0b2`; no remote configured.
- Fresh status: 378 entries, compared with the historical 365. Ownership unknown;
  all pre-existing work is treated as user work. No reset, clean, commit or push.
- Before editing: 1,883 source files archived with SHA-256 hashes, status and binary
  patches in `.turbo/pilot-reassessment-20261102-132756/`. The archive may contain
  historical sensitive material: keep it private. Ignored environment files excluded.
- In-place targeted edits preserve the actual dirty release candidate; a clean
  worktree at HEAD would omit extensive application functionality.
- System Node 20.17.0, pnpm 10.34.5. Checks use existing local Node 22.23.4.
- Current manifests: Next 16.3.2, React 19.2.8, Nest 11 ranges. Root package manager
  is pinned; Turbo remains `latest`. Legacy `api/` and `types/` directories coexist
  with active `apps/api`, `apps/web`, and `packages/types`.
- Nine ordered migrations exist. Hosted migration history is NOT VERIFIED.
- Isolated builds exclude `.env`, active `.next`, `dist`, and local credentials.
  Dependency junctions are reused; no installation runs in those build copies.

## Checklist and findings

| Priority | Current finding | Action / status |
|---|---|---|
| P0-01 | Existing fail-closed guards and pilot configuration binding; service role bypasses RLS | Re-tested locally. Dedicated deployment/database identity remains NOT VERIFIED |
| P0-02 | Prior credential exposure cannot be closed by source scanning | Redacted scan and owner incident checklist; rotation remains NOT VERIFIED |
| P0-03 | Legacy stock mode updates product totals without batch deductions; response-key persistence failure can permit an unsafe retry | No stock behavior changed. Existing proposal retained for explicit approval; local transactional tests do not authorize activation |
| P0-04 | Clinical and physical printer forms unsigned | Automated label regressions re-tested; no clinical semantics changed or approved |
| P0-05 | No verified hosted staging schema or operational restore | Disposable local migrations, SQL concurrency, and digest-based restore exercised; external gate remains open |
| P0-06 | Workstation recovery already corrected; API lint and vulnerable dependencies remain | Full suites re-run; auth/startup corrections below. No lint-rule suppression |
| P0-07 | No reviewed release commit, remote, or hosted CI evidence | Existing non-deploying CI retained; source/recovery and owner checklists provided |
| P0-08 | Production SMS already blocked; session lifecycle and audit attribution incomplete | SMS negative regressions included; hosted controls and actor coverage remain blocked |

## Changes made by this session

| File | Root cause and change |
|---|---|
| `apps/api/src/auth/auth.controller.ts` | Thrown provider exceptions bypassed redacted outage handling. Catch and return generic 503; preserve invalid-credential and success contracts. Use SDK error status type directly |
| `apps/api/src/auth/auth.controller.spec.ts` | Four new regressions: thrown provider outage, credential rejection, returned provider outage, and minimal successful response |
| `apps/api/src/auth/auth.guard.ts` | Remove unnecessary error cast; correct documentation that implied guaranteed immediate session revocation |
| `apps/api/src/main.ts` | Handle rejected startup promise, emit a generic error and set nonzero process exit code |
| `scripts/pilot-quality-check.py` | Previously returned zero despite failed checks and overwrote evidence. Preserve unique run directories, read actual runtime version, propagate failure |
| `scripts/pilot-secret-scan.py` | Recognize exact previously reviewed synthetic fixtures in pnpm project-cache copies; explicitly classify the new synthetic auth fixture. No blanket test exclusion |
| `docs/PILOT_REASSESSMENT_*.md` | Six current-session reports and evidence-based release decision |

No schema, dosage wording, allocations, stock default, prescription deductions,
production credentials, patient records or deployed environments were changed.
Architecture remains one isolated deployment/database, with server-only privileged
access; it is not tenant-safe shared SaaS. Future SaaS requires organization scope
on records, queries, RPCs, idempotency keys, storage, audit, roles and onboarding.

Intentional behavior changes: unexpected login-provider throws now produce a
redacted retryable 503; startup failures explicitly produce failure status; quality
runner failures now fail their caller. No working business behavior was removed.
Risks: generic startup logging reduces diagnostics; provider failure handling is
mock-tested, not hosted failure injection. No incremental stock correction is safe
to activate without the approvals required in the original request.

See [test execution](PILOT_REASSESSMENT_TESTS.md),
[regression matrix](PILOT_REASSESSMENT_REGRESSIONS.md),
[launch checklist](PILOT_REASSESSMENT_LAUNCH.md),
[human approvals](PILOT_REASSESSMENT_APPROVALS.md), and
[verdict](PILOT_REASSESSMENT_VERDICT.md).
