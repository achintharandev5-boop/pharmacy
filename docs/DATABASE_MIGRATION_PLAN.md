# Database Migration Plan

Status: **prepared, not applied.** Nothing in this plan has been run against the Supabase project. Applying it requires the owner's approval.

## What the new migrations do

| File | Changes | Destructive? |
|---|---|---|
| `20261010000100_schema_hardening.sql` | Adds patient columns the app already writes (`age`, `gender`, `address`, `medical_notes`) and explicit allergy status; product columns the workstation reads (`pack_size`, `product_type`, `unit_of_measure`); CHECK constraints (as `NOT VALID`); indexes; `updated_at` triggers; number sequences | No. Adds only. Existing patients get `allergy_status = 'UNKNOWN'` |
| `20261010000200_profiles_settings_sms_audit.sql` | New tables `user_profiles`, `pharmacy_settings` (one row, no invented values), `sms_messages`, `audit_log`; audit triggers; `pharmacy_today()` | No. New objects only |
| `20261010000300_transactional_functions.sql` | Database functions `receive_stock`, `adjust_stock`, `create_prescription`; execute restricted to `service_role` | No |
| `20261010000400_row_level_security.sql` | Enables RLS on every application table, with no policies for `anon`/`authenticated` | No data change. **Changes access**: see below |

Every statement is idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded `ADD CONSTRAINT`). Re-running a file is safe; this is tested.

## Why it matters now

Until these are applied:

- **Stock receiving and adjustments return `503 SCHEMA_OUT_OF_DATE`.** They previously reported fake success; they now call `receive_stock` / `adjust_stock`, which only exist after migration 000300.
- **Creating a patient with age, gender, address or notes fails** on a database built only from the original migrations (the columns do not exist). Before Phase 1 this failure was hidden behind an invented record.
- **Every table is readable and writable by anyone holding the project's publishable key**, through the Supabase REST API, because RLS is off. The publishable key is public by design. This is the most urgent item.

## Prerequisites

1. **Confirm which earlier migrations the project has.** The three earlier files (`20260824…`, `20261005…`, `20261005010000…`) must be applied first. In the Supabase dashboard → Database → Migrations, or:
   ```sql
   select to_regclass('public.prescriptions'), to_regclass('public.product_batches'), to_regclass('public.suppliers');
   ```
   All three must be non-null.
2. **Take a backup.** Dashboard → Database → Backups, or `pg_dump` with the database password. Keep it outside the repository.
3. **Rotate the exposed Supabase secret key first** (see `DATABASE_SECURITY_AUDIT.md`). Migrations should be applied by someone holding the new credentials.
4. Deploy the Phase 1 API (this branch) at the same time as, or just after, the migrations.

## Applying

Run against a **staging copy first** (Supabase branch, or a restore of the backup into a new project).

```bash
# From apps/api, with the Supabase CLI linked to the project
supabase db push            # applies pending files in supabase/migrations in order
```

Or paste each file, in order, into the SQL editor. Each file is wrapped in a transaction: if any statement fails, that file changes nothing.

## Verifying

```sql
-- 1. RLS is on for every public table
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
-- expect: no rows

-- 2. Functions exist and are not callable by the public roles
select has_function_privilege('anon', 'public.adjust_stock(uuid,uuid,text,numeric,text,uuid,text)', 'execute');
-- expect: false

-- 3. Patients have an explicit allergy status
select allergy_status, count(*) from customers group by 1;
-- expect: UNKNOWN for all existing patients
```

Then in the web app: sign in, receive one test delivery to a test product, adjust it back out, and confirm both appear under Stock Movements.

**Check the publishable key is shut out** (from any machine):
```bash
curl "https://<project>.supabase.co/rest/v1/customers?select=id&limit=1" -H "apikey: <publishable key>"
# expect: []
```

## Validating the deferred constraints

The CHECK constraints are added `NOT VALID`: they apply to every new write immediately, but existing rows are not checked, so a bad historical row cannot block the migration. After applying, find any violating rows:

```sql
select id, stock_quantity from products where stock_quantity < 0;
select id, stock_before, quantity, stock_after from inventory_movements where stock_after <> stock_before + quantity;
select id, quantity_available, quantity_received from product_batches where quantity_available > quantity_received;
select id, status from prescriptions where status not in ('DRAFT','COMPLETED','CANCELLED');
```

Correct or explain any rows (do not delete them), then validate:

```sql
do $$ declare r record; begin
  for r in select conrelid::regclass t, conname from pg_constraint
           where not convalidated and connamespace = 'public'::regnamespace loop
    execute format('alter table %s validate constraint %I', r.t, r.conname);
  end loop;
end $$;
```

## Rolling back

The migrations add objects only, so the application keeps working if they are left in place. To undo:

- **RLS** (000400): `alter table <t> disable row level security;` for each table. This re-opens the public REST access described above. Prefer fixing forward.
- **Functions** (000300): `drop function receive_stock(jsonb,uuid,text); drop function adjust_stock(uuid,uuid,text,numeric,text,uuid,text); drop function create_prescription(jsonb,uuid,text);` Receiving and adjustments then return 503 again.
- **New tables** (000200): they hold only data created after the migration. Export before dropping.
- **Columns** (000100): leave in place. Dropping `allergy_status` would discard recorded allergy information.

Restoring the backup is the last resort, because it also discards prescriptions dispensed since the backup.

## How the migrations were tested

`apps/api/supabase/tests/run-migration-tests.sh` builds a throwaway local PostgreSQL 18 database with Supabase's roles and default grants, applies all seven migrations, re-applies the four new ones, and runs:

- 48 SQL checks: constraints, audit log contents, `receive_stock` (multi-line, idempotent replay, whole-receipt rollback, expired stock, batch/expiry mismatch), `adjust_stock` (over-removal, batch ownership, reason and user required, no silent clamping), `create_prescription` (FEFO order, expired batches never used, idempotency, no partial records), RLS (anon/authenticated cannot read, write or execute; service_role can), and validation of every `NOT VALID` constraint;
- a concurrency test: two sessions take 10 units each from 15 at the same moment. Exactly one succeeds, and the stock and ledger end up consistent.

Result on 2026-10-10: all passed. It never connects to Supabase and refuses a non-local host.

## Decisions needed (owner / pharmacist)

1. **Switch prescriptions to `create_prescription`.** Today the API writes a prescription as a sequence of checked steps and reverses them if one fails. The database function does it in one transaction and also deducts stock from **batches, earliest expiry first**, which the current code does not do (it only reduces the product total). This changes stock behaviour, so it needs sign-off before the API calls it.
2. **`RETURNED` adjustments add stock.** That was the existing behaviour and has been kept. Confirm whether "returned" means *returned by a patient to stock* (adds) or *returned to the supplier* (should remove).
3. **Receiving expired stock is now refused.** Confirm that is the desired rule.
4. **Reorder levels.** Products without `reorder_level`/`minimum_stock` are reported as "no threshold" rather than low or healthy. Set thresholds for products that need low-stock alerts.
5. `apps/api/supabase/seed.sql` contains sample patients and products for local development. Do not run it against the real project.
