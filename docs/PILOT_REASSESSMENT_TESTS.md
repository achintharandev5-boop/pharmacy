# Report 2 — Actual test execution

Run date: 2026-11-02. System Node 20.17.0; final checks use the existing
Node 22.23.4 executable and pnpm 10.34.5. No production connection, SMS send,
clinical dispensing, deployment or credential rotation was performed.

## Commands and results

Commands below run inside the indicated application directory unless qualified.
The Python quality wrapper records actual commands, exit codes and runtime.

| Check / command | Result | Scope and evidence |
|---|---|---|
| API `pnpm exec tsc --noEmit --incremental false` | PASS | Final exit 0 |
| Web `pnpm exec tsc --noEmit --incremental false` | PASS | Exit 0; web source unchanged this session |
| API `pnpm exec jest --runInBand` | PASS | Baseline 453/453; final 457/457, 34 suites |
| API `pnpm exec jest --config ./test/jest-e2e.json --runInBand` | PASS | 2/2 smoke tests; mocked provider/database |
| Web `pnpm exec vitest run --pool=threads --maxWorkers=1 --minWorkers=1 --testTimeout=30000` | PASS | 2,181/2,181, 75 files; 621.81 seconds test runtime; unrestricted worker retry |
| API `pnpm exec jest --config ./test/jest-db.json --runInBand` | PASS | 60/60, 5 suites; fresh synthetic local databases, Auth stand-in |
| API `pnpm exec eslint "{src,apps,libs,test}/**/*.ts" --format json` | FAIL | 989 errors, 48 warnings; all auth files and main.ts have zero findings |
| Web `pnpm exec eslint . --format json` | PASS | Zero errors/warnings |
| Isolated API `pnpm exec nest build` | PASS | Final source copy, Node 22; generated dist/main.js |
| Isolated web `pnpm exec next build --webpack` | PASS | Exit 0; compiled, TypeScript, 30 generated pages, trace finalization and route summary completed |
| `python scripts/pilot-secret-scan.py` | PASS heuristic scan | Exit 0; 9 classified findings, zero unreviewed; source/local env/reachable Git blobs up to 5 MB; values never printed |
| `pnpm audit --json` | FAIL vulnerability gate | Registry retry completed: 11 critical, 23 high, 34 moderate, 7 low findings |
| `python scripts/pilot-local-db-check.py` | PASS | Nine migrations, migration reapplication, SQL checks, concurrent writes, dump/restore signatures; final explicit Python subprocess exit 0, 16.12 seconds |

Final assertion-bearing suites: **2,700 passed / 0 failed** (457 + 2,181 + 2 + 60).
No skipped tests reported in these completed suites. SQL scripts are separate
assertion groups and are not added to the 2,700 test count. No hosted browser E2E,
real provider Auth acceptance, physical print, or hosted restore was run.

## Evidence paths and baseline limitations

- Recovery/source baseline: `.turbo/pilot-reassessment-20261102-132756/`.
- Initial checks: `.turbo/pilot-remediation-20261102/*-final.log` and result JSON.
  The existing runner reused these paths before it was corrected; historical logs
  at those names are not immutable baseline evidence. Source ZIP remains preserved.
- Final API types/unit/smoke/lint:
  `.turbo/pilot-remediation-20261102/runs/20261102-133252-701229/`.
- Final web suite:
  `.turbo/pilot-remediation-20261102/runs/20261102-133526-996750/`.
- Final local DB integration:
  `.turbo/pilot-remediation-20261102/runs/20261102-133630-267130/`.
- Builds: `.turbo/pilot-remediation-20261102/builds/reassessment-final/`.
  The web build's full completion and exit 0 are recorded in the tool execution
  transcript. A BUILD_ID alone was not treated as completion evidence.
- Scan/audit/local SQL logs: `.turbo/pilot-reassessment-20261102-132756/`.
- Runtime evidence: `runtime-proof.json` in that directory confirms pnpm's actual
  child executable/version is Node 22.23.4. A standalone Python `node --version`
  lookup in API build metadata resolved system Node 20 before applying child PATH;
  retain that original probe and use the pnpm-child proof for runtime attribution.
- SQL signatures and migration hashes:
  `.turbo/pilot-remediation-20261102/local-db-restore-result.json`.

API/web TypeScript, API unit and smoke checks were fresh before the auth fixes;
final API checks repeat after changes. Initial lint ran after edits had begun,
so it is not a pristine pre-change lint measurement. Historical 1,008/49 is not
claimed as this session's baseline. Final 989/48 is the exact current measurement.

## Failed attempts retained

- Web unit worker spawning and isolated frontend build initially failed with EPERM;
  approved retries outside the sandbox completed. These are runner failures, not
  silently counted as successful initial runs.
- Local database was initially unreachable, including the first unrestricted retry.
  Existing audit-only cluster startup was denied by the sandbox; approved startup
  succeeded on loopback port 55473. No other cluster was modified.
- SQL concurrency Git Bash launch was denied inside the sandbox. The unrestricted
  run produced passing SQL/concurrency/restore results but its PowerShell wrapper
  reported exit 1 while handling PostgreSQL notices. Retain that discrepancy;
  the final explicit Python subprocess returned exit 0. Its metadata is
  `local-db-confirmed-result.json`, with `local-db-confirmed-unrestricted.log`.
- Registry audit was blocked by network restrictions; unrestricted read-only retry
  returned advisory results and nonzero status as expected for vulnerabilities.
- The fixed quality runner returned exit 1 for the final API batch because lint
  failed, despite passing types/unit/smoke checks. This verifies failure propagation.

## Lint classification

Current 1,037 findings: 586 formatting; 437 unsafe assignment/member/call/return/
argument findings; 7 unnecessary assertions; 3 require-await; 1 unbound-method;
2 unused directives; 1 unused variable. These are rule occurrences across errors
and warnings. 361 errors occur outside spec/test files. Unsafe database boundaries
need typed schema/result work and runtime validation, not casts or disabled rules.
Security/correctness priority: auth and startup paths now clean; service-role data
boundaries and production services remain ahead of cosmetic formatting batches.

## Database scope

The runner checks the cluster's actual data_directory against its audit-only path
before creating new uniquely named databases. It never drops or targets an existing
application database. SQL checks cover invalid/expired stock, multi-batch FEFO,
insufficiency, rollback, same-key retries, competing dispensers, RLS/grants,
returns/quarantine and reconciliation assertions. Product/batch/ledger agreement
in synthetic fixtures is not physical pharmacy reconciliation. Restore compares
all public/auth row digests and constraints, RLS, policies, functions, grants and
sequence signatures. Supabase Auth/storage/provider recovery remains unverified.

Environment/build inputs: no .env copied; API_URL and PILOT_API_URL use the same
reserved HTTPS example.invalid origin; SMS disabled; telemetry disabled. Production
startup binding misconfiguration tests pass. No claim is made that these synthetic
inputs establish actual deployment identity or production secret injection safety.
The audit-only PostgreSQL cluster started for these tests was stopped successfully;
synthetic databases, logs and recovery files are retained. No other service was stopped.
