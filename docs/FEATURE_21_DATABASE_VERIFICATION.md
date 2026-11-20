# Feature #21 database verification and recovery

This runbook prepares a controlled verification. It does not authorize a remote connection, migration, assignment change, deployment, or use of production. No remote execution was performed while preparing it.

## Scope and prerequisites

Migration: apps/api/supabase/migrations/20261025000100_reasons_catalogue.sql.
It creates public.reasons, a restricted audit trigger/function, and grants, inside BEGIN/COMMIT. It relies on existing auth.users, audit_log and Supabase roles. It neither overwrites an existing reasons table nor migrates historical prescription data. Existing-table or function-name collisions must stop execution.

The catalogue is isolated by verified Auth app_metadata.pharmacy_id in the API. service_role bypasses RLS, so every operation must retain pharmacy_id filters. No pharmacy registry exists to reference; do not invent an FK to singleton pharmacy_settings. updated_by references auth.users with ON DELETE RESTRICT: catalogues retain a valid audit actor; deactivate an account instead of deleting a referenced identity without a separately reviewed archival plan. No FK links saved reasons to mutable catalogue rows.

Audit metadata uses existing audit_log atomically: actor, action, reason ID, and changed field names. It deliberately excludes reason wording, patient data, secrets and request bodies. The API injects updated_by from verified user.id. If the audit insert fails, the catalogue mutation fails in the same transaction.

## Checklist before remote execution

1. The owner independently identifies the **isolated staging** project and production project in the Supabase dashboard. Record non-secret project references and approver. They must differ. A name containing “staging”, a successful connection, localhost proxy, or matching URLs alone is insufficient.
2. Verify credentials belong to that staging project using the approved secret-manager/provider workflow. Never paste keys/passwords into this repository, chat, command history or logs.
3. Check key-rotation prerequisites in PHARMACY_STAGING_RUNBOOK.md. Only use synthetic, approved staging data.
4. Use apps/api/.env.staging.example and apps/web/.env.staging.example; inject values through the existing environment loader/secret manager. Do not replace development .env files with guessed values. UI testing mode must be false for database-backed verification.
5. Configure a libpq service called pharmacy_reasons_staging in a private pg_service.conf, and a restricted password file/secret mechanism. Its host/project identity must match the independent dashboard evidence. Commands below use PGSERVICE rather than printing connection strings.
6. Record a provider backup/PITR restore point, retention, timestamp, and operator. Create and validate a logical dump. Restore into a *different* disposable staging database/project and compare schema and counts. Auth users/config/secrets and required roles must be provisioned separately for a new Supabase project. A backup file without a successful restore test is insufficient.
7. Obtain explicit approval naming the project, migration version/hash, backup evidence, and change window. **Stop here without approval.**

## Project identity and migration history

Run from repository root, after independent verification and permission for read-only staging inspection. Enter actual approved non-secret references; never use placeholders as evidence.

```powershell
./scripts/verify-staging-env.ps1 -StagingProjectRef '<approved-staging-ref>' -ProductionProjectRef '<verified-production-ref>' -ExpectedStagingApiUrl 'https://<approved-staging-api>'
$env:PGSERVICE = 'pharmacy_reasons_staging'
Get-FileHash apps/api/supabase/migrations/20261025000100_reasons_catalogue.sql -Algorithm SHA256
psql -X -v ON_ERROR_STOP=1 -f apps/api/supabase/diagnostics/reasons_preflight.sql
psql -X -v ON_ERROR_STOP=1 -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
```

Compare the recorded migration history with every predecessor under apps/api/supabase/migrations, especially 20261010000200 (audit log) and 20261010000400 (RLS). An absent ledger or unrecorded manual migrations needs investigation before applying anything. Verify predecessor schemas too; ledger presence alone is insufficient. Local histories may not contain a Supabase ledger.

## Backup, approval, apply and schema verification

The paths below are private operator-selected directories outside the repository. These commands are preparation only; do not run before the prerequisites above.

```powershell
pg_dump -Fc -f '<private-backup-directory>/before-feature21.dump'
pg_restore --list '<private-backup-directory>/before-feature21.dump'
```

Test restore into a separately verified disposable target using its own libpq service, never the source or production. Record restore success and compare table counts/schema. Reconfirm PGSERVICE points to staging afterward.

After explicit approval and a successful preflight, apply **only the reviewed migration** with error-stop enabled. The migration owns its transaction; do not split statements or ignore errors.

```powershell
psql -X -v ON_ERROR_STOP=1 -f apps/api/supabase/migrations/20261025000100_reasons_catalogue.sql
psql -X -v ON_ERROR_STOP=1 -f apps/api/supabase/diagnostics/reasons_schema_verify.sql
```

Check the process exit code after each command. Stop immediately on failure. Direct psql execution does not update Supabase's migration ledger; the approved migration owner must reconcile version 20261025000100 through the project's established release bookkeeping, only after successful schema verification. Do not mark failed execution applied. Do not run a generic push of all unrelated pending migrations.

Read-only schema verification checks effective role privileges (including inherited grants), RLS, actor FK, indexes, and the audit trigger. An unexpected grant is a stop condition. Do not disable RLS or expand browser grants to make tests pass.

## Controlled functional verification

Have the authorized operator provision only synthetic staging accounts: Admin A, pharmacist A, Admin B, and an unassigned account. Trusted app_metadata must contain role and pharmacy_id for the assigned accounts; preserve unrelated metadata. This runbook does not create or modify assignments.

Using authenticated sessions:
1. Admin A creates two exact tester-entered statements; Admin B creates its own statement (the same text may exist in both pharmacies).
2. Pharmacist A loads GET /reasons and selects both A statements in the workstation. Verify selected blue states, Enter confirmation, Selected Instructions, preview and unchanged 70 × 50 mm print area.
3. Save a synthetic prescription and compare instructions_json.reasons and final_instruction_text with preview/print output.
4. Admin A renames and deactivates one reason. Verify current selection availability and the original saved prescription wording/readability. Audit rows must identify the real actor and changed fields without copying wording.
5. Confirm A cannot list/edit/deactivate B IDs; pharmacist cannot call any Admin mutation; forged/missing tokens, invalid UUIDs/payloads, caller-supplied pharmacy/actor IDs, and absent/invalid assignments cannot bypass authorization.
6. In a separate non-production frontend session enable UI testing mode. Start empty, enter local reasons explicitly, navigate Admin → workstation, and verify no real API requests or database-save success. Reset/logout must clear temporary catalogue data.

Never run apps/api/supabase/tests/60_reasons_catalogue_tests.sql against remote Supabase: it creates auth fixtures for the local auth stub. Remote tests must use actual approved Auth accounts.

## Disposable local verification (no remote access)

Use installed PostgreSQL tools only. Initialize a *new* directory under a private temp directory with a unique name. Bind only 127.0.0.1 to an unused port. Trust authentication is acceptable only for this short-lived synthetic-data local test cluster, and it must be stopped afterward. Never point this workflow at the developer's existing database.

```powershell
# After starting the NEW disposable cluster on port 55421:
$env:DB_TEST_URL = 'postgres://postgres@127.0.0.1:55421/postgres'
$env:DB_TEST_FRESH_ONLY = 'true'
$env:DB_TEST_RUN_ID = 'verification1'
Push-Location apps/api
pnpm exec jest --config ./test/jest-db.json --runInBand --testTimeout=30000
Pop-Location
psql -X -h 127.0.0.1 -p 55421 -U postgres -d pharmacy_f21_reasons_verification1 -v ON_ERROR_STOP=1 -f apps/api/supabase/tests/60_reasons_catalogue_tests.sql
```

Fresh-only mode refuses existing database names instead of dropping them. On a repeat run use a new validated DB_TEST_RUN_ID (letters, digits, underscores, up to 20 characters) or a completely fresh cluster; do not delete an unknown database. The adapter uses real PostgreSQL as service_role with a test Auth stand-in; it is not a Supabase/PostgREST or browser end-to-end acceptance test.

## Recovery without dropping historical data

- Failed apply before COMMIT: error-stop ends the session and rolls back the transaction. Reconnect read-only and inspect the schema/ledger. Diagnose and fix forward; do not replay blindly if a reasons object already exists.
- Interrupted connection after COMMIT may have succeeded: inspect schema and ledger before retrying. The migration intentionally fails on an existing table rather than replacing data.
- Failed application release after successful migration: revert the application release; leave the additive reasons table, audit metadata and prescription snapshots intact. Avoid setting up new reason-bearing work until the approved application is restored.
- Incorrect catalogue data: use scoped Admin edit/deactivate with audit history, not direct broad SQL updates.
- Restore needed: restore the verified backup into a separate isolated recovery target first. Compare reasons, audit entries and historical prescription counts/text before an operator-approved cutover. Restoring a pre-feature backup loses later writes unless reconciled; preserve/export them securely.
- There is no automatic destructive down migration. Any table removal would lose catalogue records and needs separate review/approval. Never drop historical prescriptions or use cascading removal.

