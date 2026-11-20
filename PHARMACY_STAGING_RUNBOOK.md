# Pharmacy Staging Runbook

**Status:** Preparation only. No remote project was inspected or changed.  
**Environment rule:** Staging only, explicitly selected and verified. Never use production credentials or a production database URL in these procedures.

## 1. Environment variable inventory

Set values only in the approved secret manager/provider or ignored local environment files. Never paste values into this runbook, source control, tickets or logs.

| Variable | Component | Use / handling |
|---|---|---|
| `SUPABASE_URL` | API server | Staging Supabase project URL. Must point to the approved staging project. |
| `SUPABASE_SERVICE_ROLE_KEY` | API server only | Secret key; bypasses RLS. Restricted to API runtime and operator secret storage. Never expose to browser, `NEXT_PUBLIC_*`, logs or source maps. Use the rotated staging key. |
| `PORT` | API server | API listen port; validated, defaults to 3001 in code. |
| `FRONTEND_URL` | API server | Approved staging web origin/CORS origin. |
| `PHARMACY_TIMEZONE` | API server | IANA timezone used by expiry/dashboard date behavior; currently defaults to `Asia/Colombo`. Confirm with owner. |
| `PRESCRIPTION_WRITE_MODE` | API server | Keep `legacy` or unset (defaults to legacy) until physical reconciliation and pharmacist approval. Do not turn on as part of staging deployment. |
| `NEXT_PUBLIC_API_URL` | Web build/runtime | Staging API base URL. Public value; must not point at production accidentally. |
| `NEXT_PUBLIC_SUPABASE_URL` | Web build/runtime | Staging project URL if web auth client needs it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web build/runtime | Publishable/anon key only. It is not a secret; RLS and API authorization must still protect data. Do not put the service-role key here. |
| `TEXT_LK_API_TOKEN` | SMS integration server action | Secret gateway token if staging SMS is enabled. Prefer disabled/mock mode. Live test messages need explicit owner approval, consent, test recipients and rate limits. |
| `TEXT_LK_SENDER_ID` | SMS integration server action | Approved staging sender ID. Do not use a production sender without approval. |
| `NEXT_PUBLIC_LABEL_WORDING` | Web build/runtime, optional | Optional wording selector. Use existing default unless pharmacist approves the alternative specified by repository docs. |

The exact mandatory variable validation is in `apps/api/src/config/env.validation.ts`; `.env.example` files list the integration variables. This inventory does not establish that any current environment is correctly configured.

The deployment guide also uses a database connection URL for operator-run dump/restore commands. Treat it as an ephemeral operator secret, not an application variable; provide it through an approved secure mechanism and never save it in this repository or shell history.

## 2. Credential and access gates

Before connecting tools to a remote staging project:

- Owner verifies the historically exposed Supabase secret/service-role key is rotated and the prior key revoked; if the project uses a legacy JWT service-role secret, follow the provider's rotation process and account for session invalidation.
- Owner changes the historically exposed administrator password, reviews Auth accounts/sign-in logs, removes unknown accounts, and reviews relevant patient/product/prescription changes for tampering.
- Owner confirms the old backup archive mentioned in `docs/DATABASE_SECURITY_AUDIT.md` is encrypted with restricted access or retired; do not inspect or publish its contents as part of this runbook.
- API key exists only in API runtime secret storage. Confirm web build output, browser responses, logs and source maps do not contain it.
- Create separate staging identities with minimum permissions. Never copy production credentials into staging.
- Record approver, environment/project identifier (non-secret), timestamp and evidence location; do not record key values.

**Gate:** If rotation/revocation or environment identity cannot be verified, stop. No migration or application smoke test proceeds.

## 3. Backup and restore procedure

Requires owner approval and a staging environment. Keep dumps outside the repository in encrypted restricted storage; patient data is sensitive. Prefer synthetic or masked records.

1. Confirm project identity and that the source is staging. Record database version, backup/PITR availability, retention and restore point.
2. Take provider backup/snapshot and a logical PostgreSQL dump (schema and data) using the approved operator's secure connection mechanism. Do not put the database URL/password in shell history, this repository or logs.
3. Verify the dump is readable with the provider tool (`pg_restore --list` for a custom-format dump) and record expected table/data counts without exporting patient values.
4. Restore into a separate isolated staging project/database, never over the source. Re-provision Auth/config/secrets separately; database dumps do not necessarily include provider-managed Auth users or secrets.
5. Compare schema, migration ledger, table counts, sequences/functions, RLS/grants and synthetic login/API behavior. Check representative synthetic prescription and stock rows for referential integrity.
6. Record restore duration, restore point, missing provider objects, errors, operator and independent reviewer. Delete temporary protected copies under the owner's retention policy after acceptance.
7. **Pass evidence:** independent reviewer signs that restore is usable and recovery objective is met. A successful backup job alone is not a restore test.

## 4. Migration dependency and apply procedure

Repository migration order from `docs/SUPABASE_DEPLOYMENT_GUIDE.md`:

| Order | Migration | Dependency / role |
|---:|---|---|
| Existing | `20260824000000_init.sql` | Initial schema. |
| Existing | `20261005000000_prescription_domain_upgrade.sql` | Initial schema. |
| Existing | `20261005010000_inventory_v2.sql` | Initial schema; inventory batches/ledger. |
| 1 | `20261010000100_schema_hardening.sql` | Three existing migrations; constraints, helpers/sequences. |
| 2 | `20261010000200_profiles_settings_sms_audit.sql` | 000100 and Supabase `auth.users`. |
| 3 | `20261010000300_transactional_functions.sql` | 000100 and 000200; transaction functions. |
| 4 | `20261010000400_row_level_security.sql` | Tables created by 000200 and earlier. Closes direct anon/authenticated REST access. |
| 5 | `20261010000500_returns_quarantine_dispensing.sql` | 000100–000400; replaces stock functions, quarantine/returns, transactional dispensing. |

**Critical order rule:** never re-run `20261010000300_transactional_functions.sql` by itself after `20261010000500_returns_quarantine_dispensing.sql`; the older function definitions can weaken newer return/quarantine protections. If explicitly needed, reapply 000500 immediately after 000300 and verify definitions/privileges. Never run `seed.sql` or `supabase db reset --linked` against a real project.

### Preflight — read-only, stop on mismatch

1. Owner identifies the staging project and grants time-limited access. Confirm project ref, database host and API URL independently. Ensure the current shell/tool context cannot accidentally target production.
2. Review existing migration history before selecting the procedure. Existing migration ledger versus manually applied schema determines CLI `db push` versus SQL-editor path; do not mix the two.
3. Check required tables/columns and whether objects created by the new migrations already exist in another shape. Review existing triggers/policies and constraint-violating row counts using the checks in the deployment guide.
4. Review direct REST users/integrations because the RLS migration denies public/authenticated table access except the profile policy. Resolve legitimate direct clients first.
5. Run the read-only inventory diagnostic and capture current aggregate/batch/ledger evidence. No stock discrepancy blocks reading the migration plan, but pharmacist review is required before deploying code that changes dispensing behavior.
6. Confirm verified backup and restore point, approved maintenance window, API compatibility plan, and rollback owner. Confirm `PRESCRIPTION_WRITE_MODE` is `legacy` or unset in every deployment.
7. Owner, security reviewer and database reviewer approve the exact plan and project in writing.

### Apply and verify

1. Apply only to the confirmed staging project. Use the documented history path; in CLI path, ensure dry-run lists exactly the intended five `20261010*` migrations before applying.
2. Apply sequentially in the table above; stop on first error. Do not continue to later migrations after partial failure.
3. Verify migration ledger, expected tables/functions/sequences, constraints, RLS flags/policies, grants, function signatures and execute privileges using deployment guide sections 5–6.
4. Compare before/after row counts and representative data invariants. Confirm expected settings records remain empty/null rather than fabricated, and ensure no production records were inserted.
5. Deploy compatible API/web only to staging, with staging secrets and legacy mode. Exercise health, login, roles, prescription persistence, stock receiving/adjustment on synthetic fixtures, error paths and logs.
6. Do not enable transactional dispensing until SOP reconciliation and pharmacist sign-off. Do not send live SMS unless independently approved.

Review compatibility effects documented by the deployment guide: migration `20261010000500_returns_quarantine_dispensing.sql` rejects legacy `RETURNED` stock adjustments and rejects receiving into a quarantined batch. Confirm the deployed UI/API flow communicates these outcomes safely and staff have an approved return workflow before pilot use.

## 5. Rollback and failure handling

Migrations are not to be rolled back by deleting business rows or running ad hoc inverse SQL. The files are applied in separate transactions, but completed earlier files remain if a later file fails.

- On any unexpected preflight result or migration error: stop, preserve error output, record the exact migration and database transaction outcome, and do not retry blindly.
- If the failed migration transaction rolled back cleanly and no later migration ran, have the database reviewer diagnose and approve a corrected forward-only migration or a controlled retry. Verify the migration ledger first.
- If schema is partially/out-of-band changed, stop and compare the actual schema to source; do not reset or force-repair the linked project.
- For staging only, restoration from the verified pre-change snapshot into a separate isolated project is the preferred recovery drill. Validate application compatibility and data counts before redirecting staging. Do not restore over production or use a destructive reset.
- If a migration was recorded as applied but objects/data are inconsistent, use a reviewed additive repair migration with explicit transaction/rollback plan. Never modify migration history merely to make CLI output green.
- Any production rollback or migration requires a separate owner-approved change plan. This runbook authorizes none.

## 6. Authentication, roles, tenant and branch tests

Before pilot sign-off, test staging accounts with approved roles for valid, missing, malformed, expired, revoked tokens; auth provider outage; login/logout; no-role/deactivated users; allowed and denied route matrix; and audit actor attribution. API route tests must show 401/403 behavior as approved. The web proxy checks cookie presence only; it is not an authorization control.

Prior local security documentation records API tests for absent/malformed/invalid/expired tokens and Auth outage behavior, application-wide unauthenticated/forged-token checks, and role guard tests. Treat these as local code evidence only. Staging must still verify actual Supabase user metadata, revocation, role assignments, CORS/API routing and the pharmacist-approved dispense rule. The current prescription controller does not consistently restrict creation/dispensing to a clinical role.

Before POS or multi-pharmacy hosting, add organization, branch, organization-membership and branch-role records. Derive scope only from verified membership; never trust client-supplied organization/branch IDs. Because the API service-role client bypasses RLS, scope every API query/RPC and add database-enforced same-tenant/branch relationships and cross-tenant/wrong-branch negative tests. Review membership revocation, support access, catalog ownership, stock branch scoping and audit identity.

## 7. Staging acceptance record

| Item | Record |
|---|---|
| Staging project identifier (no secrets) | |
| Backup/restore evidence reference | |
| Migration list and reviewer | |
| Security/credential rotation confirmation | |
| Role matrix and test evidence | |
| Inventory reconciliation/SOP reference | |
| Pharmacist sign-off reference | |
| Printer model/test evidence | |
| Rollback owner and incident contact | |
| Owner decision: GO / NO-GO / date | |

**Current state:** staging procedure prepared; no remote staging checks completed. Current release decision remains **NO-GO** until the required sign-offs and evidence exist.
