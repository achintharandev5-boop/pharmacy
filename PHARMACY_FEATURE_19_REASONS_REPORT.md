# Feature #21 — Reasons Catalogue Integration

Date: 25 October 2026.

**Code complete. Locally verified. Staging verification pending. Production verification pending.**

Feature #21 is prepared for live verification, but is **not marked fully complete** without real Supabase/staging evidence. Feature #22 was not started. No remote database was contacted; no production data or real assignments were modified. No deployment, commit, push, software installation, or unrelated API lint auto-fix occurred.

This report supersedes the earlier audit's missing-audit, transaction, recovery-documentation, and unavailable-local-database findings. Extensive pre-existing uncommitted changes were preserved.

## Readiness checklist

| Category | Item | Evidence/status |
| --- | --- | --- |
| Implemented and verified | Authenticated, pharmacy-scoped catalogue reads | Nest HTTP tests and real local PostgreSQL tests |
| Implemented and verified | Admin-only create/edit/deactivate | Pharmacist denial, forged/missing tokens, and cross-pharmacy mutation tests |
| Implemented and verified | Missing/invalid pharmacy assignment rejection | Verified Auth metadata fixtures; no client scope override |
| Implemented and verified | Validation and scoped duplicate prevention | API tests and actual PostgreSQL constraints |
| Implemented and verified | Atomic actor-attributed mutation audit | Trigger, actor FK, trusted API actor, and failed-audit rollback test |
| Implemented and verified | Historical exact wording | Saved JSON/final text unchanged after rename/deactivate, including trailing spaces |
| Implemented and verified | Admin/workstation selection, confirmation and print behavior | Full web suite and existing Reasons regressions |
| Implemented and verified | Database-free UI login, navigation, data isolation | UI-mode/proxy/server-action tests; local entries only; reset/logout cleanup |
| Implemented and verified | Schema, grants, RLS and recovery rehearsal | Fresh PostgreSQL cluster, SQL checks, dump/restore and exact data comparison |
| Implemented but unverified | Actual Supabase Auth assignments and PostgREST integration | Requires verified isolated staging project and approved accounts |
| Implemented but unverified | Complete browser → staging API → Supabase → saved label workflow | Local DOM/HTTP/SQL evidence does not establish this |
| Implemented but unverified | Physical printer acceptance with approved Sinhala content | Existing 70 × 50 mm output preserved; operational acceptance pending |
| Missing implementation | None identified in the requested local readiness scope | Known gaps addressed below; this does not certify staging behavior |
| External approval required | Staging identity, credential verification and recovery evidence | No verified staging configuration/owner evidence supplied |
| External approval required | Remote migration execution and synthetic staging account provisioning | Explicit approval for a named isolated target is still required |

## Verified catalogue source and routes

The original repository had selection helpers/state but no persistent dispensing-reason table or Admin catalogue API. Existing inventory adjustment/quarantine/return reasons, SMS failure reasons, and reprint justifications are different resources.

The prepared persistent source is **public.reasons**, loaded through the existing NestJS API and Supabase server client. No medical statements are seeded, translated, normalized or substituted.

| Endpoint | Authorization | Behavior |
| --- | --- | --- |
| GET /reasons | Authenticated with valid trusted pharmacy assignment | Active reasons in that pharmacy |
| GET /admin/reasons | Admin with valid trusted pharmacy assignment | Active/inactive reasons in that pharmacy |
| POST /admin/reasons | Admin with valid trusted pharmacy assignment | Create exact text |
| PATCH /admin/reasons/:id | Admin with valid trusted pharmacy assignment | Edit exact text |
| DELETE /admin/reasons/:id | Admin with valid trusted pharmacy assignment | Deactivate; no physical delete |

Existing UI: apps/web/app/label/ReasonsPanel.tsx, apps/web/store/labelStore.ts and apps/web/lib/reasons.ts. The API-backed loader is apps/web/components/ReasonCatalogueLoader.tsx. Server actions are apps/web/app/actions/reasons.ts.

Admin management is **System → Edit Reasons**, at /admin/reasons (apps/web/app/admin/reasons/page.tsx). Workstation users only select reasons.

## Completed changes in this readiness update

1. Added trusted actor attribution to catalogue mutations using verified user.id. Pharmacy scope is resolved before obtaining a database client.
2. Added an atomic metadata-only audit trigger using existing public.audit_log. Records contain actor, operation, reason ID and changed field names; they do not copy clinical wording, patient data or request bodies. A failed audit insert rolls back the catalogue write.
3. Strengthened the prepared migration with BEGIN/COMMIT, explicit PUBLIC/anon/authenticated/service_role privilege reset, SELECT/INSERT/UPDATE-only service access, an updated_by actor FK, and a trigger invariant rejecting pharmacy changes.
4. Fixed a demonstrated historical-wording bug: prescription serialization previously trimmed submitted final instruction text. Nonblank text now retains its original bytes, including statement padding; the existing blank-input fallback remains. The new regression failed before the fix and passed afterward.
5. Added real PostgreSQL integration tests using the existing Nest/PgSupabase harness and explicit test Auth metadata for pharmacies A/B, Admin/pharmacist, and absent/invalid assignments.
6. Added fresh-only test database creation and a validated optional DB_TEST_RUN_ID. Verification used fresh-only mode throughout; no existing developer database was dropped. Startup failures now close the pool.
7. Added temporary catalogue validation and cleanup on UI test reset/logout, including the normal shell logout. Corrupt temporary records produce an error; they do not produce invented reasons.
8. Added read-only migration preflight/schema diagnostics, a staging and recovery runbook, and comments/settings in the existing credential-free staging examples.

Multiple selection, blue selected states, Enter confirmation, Back restoration, per-label state, Selected Instructions, Sinhala preview, Digital/administration locks, DONE/review/Save/Print guards, and the 70 × 50 mm print area were retained.

## Security verification

AuthGuard obtains the user through Supabase auth.getUser and reads role and pharmacy_id from **app_metadata**, not user_metadata or request fields. ReasonsService requires a UUID-shaped pharmacy assignment. Every catalogue read/edit/deactivation filters by that scope; creation injects it. Caller-supplied pharmacy_id and updated_by cannot override trusted values. Production validation strips unknown properties; tests verified the actual persisted pharmacy and actor.

AdminReasonsController has class-level Roles(Admin), enforced by the existing global AuthGuard then RolesGuard. Tests verify pharmacist mutation denial, missing/forged authentication, invalid UUID/payloads, missing/invalid assignments, and pharmacy A versus B.

**Service-role connections bypass RLS.** Pharmacy isolation therefore depends on these backend scope filters; it is not provided by a service-role RLS tenant policy. RLS plus denied browser grants closes direct anon/authenticated access. Local tests verified actual permission denial and that service_role has no DELETE privilege.

No pharmacy registry exists in the current schema. A syntactically valid trusted assignment is treated as authorized membership; the authorized provisioning operator must establish the correct UUID. No FK to singleton pharmacy_settings was invented. Existing unrelated application tables were not retrofitted with tenancy.

## Migration readiness

Prepared migration: **apps/api/supabase/migrations/20261025000100_reasons_catalogue.sql**.

SHA-256 of the reviewed local file:
`716D9EE99156C6D38A7DD00C0D477B055135C9AB15C6690EE7742BE8DE7FDF2F`.

Recompute the hash at approval time if line endings or source change.

- New reasons table: UUID primary key, mandatory pharmacy_id/text/is_active/created_at/updated_by.
- Text constraints: 1–200 PostgreSQL characters, nonblank, no CR/LF.
- Primary-key index and UNIQUE (pharmacy_id, text) index. The composite index supports scoped catalogue reads; identical wording in different pharmacies is allowed.
- updated_by references auth.users(id) with ON DELETE RESTRICT. Account deletion while referenced is deliberately blocked; use deactivation or a separately reviewed archival procedure.
- No FK links saved prescription wording to mutable catalogue entries.
- Audit trigger/function and table creation are in one transaction. Existing-table/function collisions fail rather than overwrite data.
- No unrelated existing table/schema/data is rewritten. Existing audit_log receives metadata for new catalogue mutations.
- A migration replay was tested to fail safely without replacing existing catalogue data.
- The source migration was applied **only to fresh local test databases**. It was not applied to Supabase.

Read-only diagnostics:
- apps/api/supabase/diagnostics/reasons_preflight.sql
- apps/api/supabase/diagnostics/reasons_schema_verify.sql

The schema verifier and apps/api/supabase/tests/60_reasons_catalogue_tests.sql passed locally. The SQL fixture uses separate identifiers and rolls back its records. It is **local-only**, since its auth fixture targets the test auth stub.

The migration is intentionally not silently idempotent. If reasons already exists remotely, stop and inspect schema/history instead of dropping or replacing it.

## Historical wording and audit evidence

Saved values remain in prescription_items.instructions_json.reasons and prescription_items.final_instruction_text, not mutable catalogue-ID lookups.

Local tests performed: Admin creates two exact statements → pharmacist lists/selects the catalogue → API saves a synthetic prescription → Admin renames/deactivates a statement → active catalogue changes → saved JSON and final text remain exact → historical record remains readable. DOM tests separately verify selection, preview/print text and the shared builder. Real database assertions include trailing spaces.

Audit tests verify actor attribution and INSERT/UPDATE field metadata. Direct pharmacy reassignment is rejected. Revoking local audit insertion within a test transaction causes the catalogue write to fail and roll back; permissions are restored by rollback.

## Database-free UI testing

The existing non-production NEXT_PUBLIC_UI_TEST_MODE=true gate remains authoritative. Test login uses the separate local cookie/session and does not contact the API. Admin opens with an empty catalogue; temporary reasons exist only when entered by the tester.

Temporary reasons use dedicated sessionStorage key pharmacy-ui-test-reasons-v1. API operations are bypassed in this mode; backend server actions also refuse operations. Production cannot enable the local mode. No fictional catalogue is generated and no database-save success is claimed.

Reset and both logout interfaces clear temporary reason storage. Malformed stored entries are rejected with a visible loading error. Real API mode does not read the temporary catalogue. Existing UI-mode label persistence restrictions remain in place.

## Local database and recovery results

Used **installed PostgreSQL 18.1**, with a fresh initdb directory under the private OS temp directory, bound only to **127.0.0.1:55421**. The developer's existing port-5432 server and remote .env project were not used. Docker was unnecessary; its default daemon access was unavailable. No software was installed.

The existing database harness applied every repository migration and ran actual SQL as service_role. Supabase Auth was a test stand-in; PgSupabase was a PostgreSQL adapter, **not actual Supabase/PostgREST**.

Final run:
- 3 database suites, **50 tests passed**, including 8 Reasons database tests.
- Separate SQL constraint/grant/deactivation fixture passed.
- Read-only resulting-schema verifier passed.
- pg_dump custom-format backup and pg_restore --list passed.
- Restore into another fresh local database passed.
- Ordered full-row comparison hashes matched for reasons, prescription_items and audit_log, including exact trailing-space wording.
- Original verification data included 4 catalogue rows, 1 historical prescription item and 6 reason audit entries.
- The temporary server was stopped after verification. Synthetic cluster data/dumps remain in the temp directory; its location is recorded in the ignored .feature21-pg-path.log. No test database was dropped for reruns.

An initial standalone SQL fixture collided with integration fixture identifiers; separate IDs fixed it. A test-harness dynamic-import attempt failed under Jest's VM configuration; compatible typed delayed imports were restored. Final reruns passed, and startup cleanup prevents that failure from leaking a pool.

Local restore evidence does **not** prove that a future staging project's backups, PITR, credentials or recovery process are ready.

## Staging configuration, commands and recovery procedure

See **docs/FEATURE_21_DATABASE_VERIFICATION.md** for the complete command sequence and safeguards.

Credential-free examples:
- apps/api/.env.staging.example — explicitly documents trusted Auth metadata and approval requirements.
- apps/web/.env.staging.example — explicitly disables frontend-only UI testing for database-backed staging verification.

The runbook covers:
1. Independently identifying staging/production project references and verifying the target is non-production.
2. Existing scripts/verify-staging-env.ps1 checks and private libpq service configuration, without exposing connection strings or secrets.
3. Migration history/predecessor inspection and collision checks.
4. Backup/PITR evidence and restore into a separate disposable target.
5. Applying only the reviewed migration after named-target approval, using error-stop and the migration's explicit transaction.
6. Verifying resulting schema, effective grants, RLS, actor FK/indexes and audit trigger.
7. Pharmacy A/B, role/assignment, historical wording and UI testing isolation verification.
8. Recovery: roll back failed transactions; inspect ambiguous connection outcomes before retrying; retain the additive table on application rollback; restore to a separate recovery target before any approved cutover.

Direct psql execution does not automatically record Supabase migration history. The approved operator must reconcile the ledger through the project's release process only after successful schema verification. Do not push unrelated pending migrations.

No destructive down migration is supplied. Removing the catalogue would lose its records. Preserve catalogue/audit/prescription data; prefer application rollback or reviewed forward recovery. Never drop historical labels or use cascading removal.

## Automated verification

| Check | Current result | Prior baseline |
| --- | --- | --- |
| Full web Vitest, 2 workers, 30-second timeout | **50 files, 1,763 passed** | 1,761 passed |
| Full API Jest, runInBand, 30-second timeout | **27 suites, 236 passed** | 234 passed |
| API end-to-end | **1 suite, 2 passed** | 2 passed |
| Real local PostgreSQL integration | **3 suites, 50 passed** | Previously unverified for Reasons |
| Standalone Reasons SQL + schema checks | Passed | Previously unverified |
| Backup/restore and exact data comparison | Passed on fresh local databases | Previously unverified |
| Web and API TypeScript | Passed | Passed |
| Full web ESLint | Passed | Passed |
| Reasons/auth/module/database-harness scoped API lint | Passed, no warnings | Passed for earlier feature files |
| All changed API files including existing prescription service | **69 existing errors, 2 warnings**, confined to prescription service | In-memory comparison: 70 errors, 2 warnings before narrow fix; **no new issues** |
| Full API ESLint, diagnostic without --fix | **1,036 errors, 63 warnings** | 1,057 errors, 63 warnings |
| Web and API production builds | Passed | Passed |
| git diff --check | Passed | Passed |

The API lint reduction comes from necessary edits/formatting in the changed test harness and serialization expression. Unrelated lint files were not auto-fixed. Existing lint debt remains and is not reported as clean.

Web code was unchanged after its final full test/build/lint run. The later serialization fix was verified by a new failing-then-passing regression, the complete API rerun, real PostgreSQL rerun, TypeScript and API build.

Logs: .feature21-web-final.log, .feature21-api-regression-final.log, .feature21-api-e2e-final.log, .feature21-db-wording-final.log, .feature21-sql-wording.log, .feature21-schema-wording.log, .feature21-recovery-wording.log, .feature21-prescription-lint-comparison.log and other .feature21-*.log artifacts. Expected database failure-path messages are test evidence, not live incidents.

## Files changed in this readiness update

- apps/api/src/reasons/reasons.service.ts
- apps/api/src/reasons/reasons.spec.ts
- apps/api/src/reasons/historical-wording.spec.ts
- apps/api/src/prescriptions/prescriptions.service.ts (narrow exact-text preservation fix)
- apps/api/supabase/migrations/20261025000100_reasons_catalogue.sql
- apps/api/supabase/tests/60_reasons_catalogue_tests.sql
- apps/api/supabase/diagnostics/reasons_preflight.sql
- apps/api/supabase/diagnostics/reasons_schema_verify.sql
- apps/api/test/db/harness.ts
- apps/api/test/db/reasons.db-spec.ts
- apps/api/.env.staging.example
- apps/web/.env.staging.example
- apps/web/lib/localReasons.ts
- apps/web/components/UiTestControls.tsx
- apps/web/components/shell/AppShell.tsx
- apps/web/components/ReasonCatalogueLoader.test.tsx
- docs/FEATURE_21_DATABASE_VERIFICATION.md
- PHARMACY_FEATURE_19_REASONS_REPORT.md

## Exact external steps remaining

1. Owner supplies independently verified isolated staging and production project references and securely provisions staging credentials. The configured remote development .env project remains unidentified and unused.
2. Verify real staging backup/PITR/restore evidence and inspect migration history/predecessor schema with the prepared read-only checks.
3. Obtain explicit approval naming the isolated project, migration version/hash and recovery evidence. No remote execution is authorized by this report.
4. Authorized operator provisions approved synthetic staging accounts with trusted role/pharmacy assignments; do not modify production or real pharmacy assignments.
5. Execute the reviewed migration and schema checks in the approved target, then verify the complete authenticated browser/API/Supabase workflow, A/B isolation, historical labels, UI-mode isolation, and applicable physical print acceptance.
6. Reassess Feature #21 completion only after those results are recorded. Production verification is separately pending and was not requested or authorized for execution.

**Final status: code complete; locally verified; staging verification pending; production verification pending. Feature #21 is not fully complete. Stop before Feature #22.**

