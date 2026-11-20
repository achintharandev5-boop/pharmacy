# Single-pharmacy pilot: baseline and preservation

Baseline commit: `e3c15e42ccbffe63372455d9b10575374611a0b2`.
Branch: `codex/phase1-safety-fixes`. No Git remote configured. Initial Git status:
365 entries. No staged changes. Existing changes are of unknown ownership and are
treated as user work; no reset, clean, checkout, automatic commit or history rewrite.

Before implementation, 1,454 tracked/untracked files were archived with their current
bytes and SHA-256 manifest at `.turbo/pilot-remediation-20261102/source-before.zip`
and `manifest-before.json`. The same private ignored directory contains initial
status and binary staged/unstaged patches. Do not publish the archive or patches:
historical source may contain secrets. Ignored local credentials and dependencies
are deliberately excluded. This is a source recovery point, not a database backup.
A clean worktree would omit hundreds of existing changes, so targeted edits in the
preserved tree are used; the final manifest identifies this effort's exact changes.

## Verified initial facts

| Item | Evidence/result |
|---|---|
| Runtime | System Node 20.17.0; pnpm 10.34.5 |
| Declared packages | Next 16.3.2; React 19.2.8; Nest 11 ranges; root pnpm 10.34.5 |
| Layout | `apps/api`, `apps/web`, `packages/types`; legacy `api` and `types` also exist |
| API TypeScript | PASS, `pnpm exec tsc --noEmit --incremental false` |
| Web TypeScript | PASS, same command |
| API lint | FAIL: 1,008 errors, 49 warnings; read-only ESLint JSON |
| Web lint | PASS: 0 errors, 0 warnings |
| API E2E smoke | PASS: 2/2; mocked database, not staging acceptance |
| API first unit run | 436 pass / 4 fail; HTTP connection reset/timeouts; retry outside sandbox pending |
| Web first unit run | 2,119 pass / 52 fail; unconstrained worker overload; bounded retry pending |
| API lint script | Existing `lint` uses `--fix`; intentionally bypassed for baseline |
| Remote infrastructure | No verified deployment identity, credentials or approval evidence supplied |
| Dispensing mode | Default remains `legacy`; no authorization to switch clinical/stock behavior |

First web attempt could not spawn esbuild under the sandbox (`EPERM`); rerun was
authorized outside it. Failures from an overloaded or restricted runner remain in
the evidence and are not silently classified as application defects.

## Prioritized checklist

1. Preserve source and execute baseline checks; isolate build output from development.
2. Scan source/history without exposing values; add fail-closed pilot identity controls
   and document dedicated deployment/credential owner gates.
3. Trace stock/label behavior; test existing transactional functions on a new local
   synthetic database. Do not alter allocations, semantics or stock mode without approval.
4. Validate all ordered migrations, permissions and a synthetic restore in disposable databases.
5. Reproduce and fix the accessible interval recovery defect; categorize lint debt;
   type check, test and build under a supported Node runtime where available.
6. Add non-deploying CI and release/rollback procedures; explicitly contain pilot SMS.
7. Reassess using current evidence, preserving unsigned clinical, printer, stock,
   rotation and real infrastructure gates as blocked.

No production deployment, live SMS, live dispensing, remote database mutation or
credential rotation is authorized by this work. Later reports supersede pending
baseline results; historical reports are retained unchanged.
