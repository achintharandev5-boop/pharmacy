# Private staging verification and release decision

**Decision: BLOCKED — SECURITY OR CONFIGURATION.**

Repository preparation is not permission to create resources, push source or deploy.
No hosted URLs exist as evidence from this session. Production remains NO-GO; the
historical 58/100 production assessment is not replaced by this staging work.

Deployment package: [PRIVATE_STAGING_DEPLOYMENT.md](PRIVATE_STAGING_DEPLOYMENT.md).
Package/advisory details: [PRIVATE_STAGING_DEPENDENCIES.md](PRIVATE_STAGING_DEPENDENCIES.md).

## Preserved starting state and scope

Branch `codex/phase1-safety-fixes`, HEAD
`e3c15e42ccbffe63372455d9b10575374611a0b2`, no configured remote.
Before edits, 1,891 source files were archived with SHA-256 hashes, status and binary
diff at `.turbo/staging-preparation-20261102-164621/`. Existing dirty work remains
uncommitted and was not reset, cleaned, discarded or automatically published.
Keep recovery archives private; environment files and credentials are not published.

Changes: paired Next/eslint-config upgrade, patched Vite/Vitest and selected
transitive dependencies; Node 22 engines; Vitest projects migration; synthetic test
environment setup before Nest module import; staging gateway middleware and test
account marker; consistent server-only API routing; build validation and security
headers; synthetic banners/watermarks and print/side-effect containment; non-deploying
provider templates and execution/recovery documentation. No database migration,
clinical dosage/wording, dispensing algorithm or stock-mode default changed.

Dependencies were installed/tested in an isolated source copy. Active development
node_modules and `.next` were not overwritten. Root manifests and promoted lockfile
describe the candidate; use Node 22 and a frozen install before root development
commands. Existing nested frontend lock/workspace files are retained; hosting
installation explicitly targets the repository root lockfile.

## Security/configuration gates

| Requirement | Status | Evidence / closure |
|---|---|---|
| Critical/high dependency findings | PASS at audit scope | Final lockfile: 0 critical, 0 high; full audit retains 17 moderate/3 low; production retains 3 moderate qs findings |
| API gateway authentication on every HTTP route | PASS local | New real-AppModule HTTP tests include login, health, unknown paths, wrong/Unicode tokens and data endpoints |
| User/role/pharmacy authentication retained behind gateway | PASS local | Existing boundary suite plus staging marker/invalid bearer/cashier tests |
| Synthetic staging startup/build fails closed on bad profile/policy/token/URLs/SMS | PASS local | Environment validation and frontend configuration tests |
| SMS, clinical printing and issuance | PASS local automated containment | Existing provider code retained; staged send/print handlers and API print/reprint/SMS routes blocked |
| Payments/onboarding routes | PASS local containment | Blocked route families; no payment integration enabled |
| Ordinary authorized synthetic CRUD | PASS regression scope | Existing API and DB workflows retained; no synthetic CRUD blanket ban |
| Dedicated Supabase staging project verified distinct from production | NOT VERIFIED | Actual project/access/content evidence required; matching URL configuration is insufficient |
| Vercel Authentication All Deployments with no bypasses | NOT VERIFIED | Account/plan settings, aliases/assets/actions and named testers must be verified by owner |
| Hosted Render origin/gateway/HTTPS/secret injection | NOT VERIFIED | No service created; probe every host/alias after authorization |
| Hosted Supabase signups disabled, RLS/grants/storage/Auth metadata | NOT VERIFIED | Provider settings and actual schema must be inspected/tested |
| Hosted backup/recovery and monitoring | NOT VERIFIED | Provision and witness staging-only backup/restore; TCP checks are not DB readiness |
| Reviewed release commit, remote and artifact | NOT VERIFIED | Dirty source needs review; no push or external publication authorized |
| API lint release quality | FAIL | Final exact count recorded below; no suppressed rules |

All external controls remain blocked until verified. Private access does not waive
vulnerability remediation. Residual qs advisories concern parsing/stringification;
the machine gateway does not prove those parser paths unreachable. See the dependency
report for conditions and available patches before expanding tester access.

## Executed checks

Local Node executable: 22.23.4; pnpm: 10.34.5. Commands run via
`scripts/staging-check.py` against the isolated candidate, with actual exit metadata
and raw logs in the private evidence directory. The table below contains completed results. Early runner iterations reused log names;
the final runner archives previous attempts before rerunning. Some early raw failed
logs were replaced; their summaries and tool execution records remain.

| Check | Completed result |
|---|---|
| Frozen isolated install with lifecycle scripts disabled | PASS |
| Full registry audit | 0 critical / 0 high / 17 moderate / 3 low; exit 1 for residual findings |
| Production-only registry audit | 0 critical / 0 high / 3 moderate; exit 1 for residual findings |
| API TypeScript | PASS |
| API unit tests | 488 passed / 0 failed |
| API E2E smoke | 2 passed / 0 failed; mocked services |
| API disposable PostgreSQL integration | 60 passed / 0 failed; fresh-only databases, verified local cluster path |
| API build | PASS |
| API lint | FAIL: 989 errors / 48 warnings; new middleware, auth and startup paths clean |
| Web unit | 2,198 passed / 0 failed, 77 files; final retry |
| Web lint | PASS, zero errors/warnings |
| Web production build and TypeScript | PASS; Next 16.4.3, isolated synthetic profile, exit 0 |
| Exact staging-only web launcher build | PASS; exit 0, 78.87 seconds; no deployment |
| Isolated client-bundle marker scan | PASS scoped probe: 71 static files, no synthetic gateway marker or privileged Supabase token pattern; hosted bundles unverified |
| Redacted source/history scan | PASS heuristic scan: 12 classified findings, zero unreviewed; no rotation claim |
| Hosted workflow tests | NOT RUN; no deployment authorized/performed |
| Built API startup/HTTP probes | PASS: 5 loopback HTTP checks, including unauthorized OPTIONS; test child stopped |
| Staging launcher fail-closed probes | PASS: missing profile refused before startup/build; valid marker combinations accepted |

Failed attempts retained: cached package metadata lacked suggested Vite patches;
registry verification selected available fixed 8.2.4. Initial offline install lacked
tarballs; approved isolated download succeeded. Vite/Next subprocesses hit sandbox
EPERM and were retried with approval. API tests initially depended on omitted local
.env files; explicit synthetic test setup corrected that. Gateway side-effect tests
caught Express mount-prefix stripping and led to originalUrl matching. The first
upgraded web run passed 2,197 tests and timed out on one DigitalLabel test across a
large workstation clock gap; it remains a failed attempt, with a full retry required.
No application validation or security rule was weakened to make tests pass.

Completed assertion-bearing suites total **2,748 passed / 0 failed**
(488 API + 2,198 web + 2 smoke + 60 database). The earlier failed attempts remain
in the execution record and are not counted as successful runs. The isolated source
tests include all 77 current web files; test-project migration did not drop the
original suites. SQL migration checks run inside the disposable database fixtures;
they are not hosted Supabase acceptance or clinical approval.

The staging API intentionally does not enable browser CORS: every request goes
through the server-only gateway. This prevents the bootstrap CORS handler from
answering unauthenticated OPTIONS before gateway middleware. The normal API profile
retains its existing CORS allowlist. A real built-process probe verified this behavior
without contacting Supabase, Auth, a database or an SMS provider. Staging startup
uses JSON logging and a redacted failure message; its synthetic credential marker
was absent from the captured log.

## Hosted acceptance — none claimed complete

| # | Check after authorized deployment | Current status |
|---|---|---|
| 1 | HTTPS frontend loads for named tester; anonymous/alias/static/action access blocked by provider | NOT VERIFIED |
| 2 | Gateway-authenticated backend /health and authorized /health/db work; anonymous health refused | NOT VERIFIED |
| 3 | Dedicated staging password account logs in with role/pharmacy/environment metadata | NOT VERIFIED |
| 4 | Wrong credentials fail; no local test bypass available | NOT VERIFIED |
| 5 | Admin/pharmacist/staff/cashier restrictions hold through direct and frontend requests | NOT VERIFIED |
| 6 | Create/search/edit TEST patient; data exists only in staging | NOT VERIFIED |
| 7 | Create/search TEST medicine/product without inventing real stock | NOT VERIFIED |
| 8 | Receive a fictional GRN; verify synthetic batch/product/movement values | NOT VERIFIED |
| 9 | Save a synthetic prescription and inspect only synthetic records; do not claim production stock integrity | NOT VERIFIED |
| 10 | Preview labels with TEST watermark; application and browser printing show no clinical label | NOT VERIFIED |
| 11 | Missing/wrong gateway, missing/invalid/expired user token and wrong role cannot access data | NOT VERIFIED |
| 12 | SMS blocked; provider credentials absent; no provider sends in logs | NOT VERIFIED |
| 13 | Verify actual Supabase project identity, synthetic data policy and migration hashes; no production egress | NOT VERIFIED |
| 14 | Inspect deployed client bundles and redacted logs for privileged secrets; verify secret storage/scopes | NOT VERIFIED |

## Remaining owner actions and rollback

Owner/infrastructure/security must authorize and provision dedicated resources,
verify provider access protection and signup controls, store staging secrets privately,
review the source release, accept residual risks/lint status and authorize the actual
staging deployment. Never send secret values in chat. No pharmacist production
approval is inferred from synthetic testing.

On any failure, close access/suspend staging first. Preserve logs and the reviewed
artifact/configuration references. Roll back only to a patched compatible staging
artifact, retaining gateway/private access. There are no new migrations to undo.
Restore synthetic backups only into a new staging target, verify data/security/Auth
metadata, and obtain approval before changing endpoints. Never repoint to production
or publish an unpatched prior build. Full manual sequence is in the deployment guide.

## Final evidence closure

Both direct and staging-launcher frontend builds completed with exit 0; frontend
TypeScript completed with exit 0. The built API passed five actual loopback HTTP
checks, including gateway-protected OPTIONS, and its process was stopped. The local
PostgreSQL cluster started for integration tests was also stopped successfully.
The final source/history scan has zero unreviewed findings. A 71-file isolated
client-asset probe found no synthetic gateway marker or privileged Supabase token
pattern; hosted bundles remain unverified.

The 43-file source change list, before/after hashes, session-only patch and delta
ZIP are retained privately as `session-files.json`, `session-only.patch` and
`session-delta.zip` under the staging evidence directory. No commit or push was made.
No hosted URLs are reported because no deployment occurred. Final decision remains
**BLOCKED ? SECURITY OR CONFIGURATION** pending independently verified private access,
dedicated synthetic Supabase/Auth configuration, source review and explicit external
resource/deployment authorization. API lint and residual qs findings remain disclosed.
