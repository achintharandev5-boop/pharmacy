# Supabase Deployment Guide: migrations 20261010*

Status: **prepared, not applied. The application is NOT production-ready.**
Nothing in this guide has been run against the real Supabase project. Each step that changes the database needs the owner's go-ahead at the time it is run.

This guide is the runbook. `DATABASE_MIGRATION_PLAN.md` explains what each migration does and why; `DATABASE_SECURITY_AUDIT.md` covers the credential exposure.

**Never run on the real project:**
- `apps/api/supabase/seed.sql`. It inserts sample patients and medicines.
- `supabase db reset --linked`. It wipes the database and runs the seed.
- Any `INSERT` of patient, medicine, prescription, supplier or stock data that does not come from the pharmacy's real records.

---

## 0. Gates: do not start until all are true

| # | Gate | Who |
|---|---|---|
| G1 | The exposed Supabase **secret (service-role) key has been rotated**, and the old key is revoked (Dashboard → Project Settings → API Keys). The old key is not used for any step below. | Owner |
| G2 | The exposed **admin password has been changed** (Dashboard → Authentication → Users). | Owner |
| G3 | The new secret key is stored only in the API host's environment and in the operator's local `apps/api/.env`, which git ignores. It is never committed, pasted into chat or put in the web app. | Owner |
| G4 | A maintenance window is agreed. Label printing keeps working throughout, but receiving and adjustments only start working once 000300 is applied. | Owner + pharmacist |
| G5 | The pharmacist has answered the decisions in `STAGING_READINESS_REPORT.md` § 7. None blocks applying the migrations on staging. | Pharmacist |
| G6 | `PRESCRIPTION_WRITE_MODE` is `legacy` (or unset) in every environment's API configuration. It is switched to `transactional` only after the pharmacist signs off the batch-allocation rules (decision D1), and on staging first. | Owner + pharmacist |

---

## 1. Compatibility checks (read-only)

Run these in the Supabase SQL editor of the **real** project. They only read; nothing changes. Save the output: you need it for the go/no-go decision and for any rollback.

### 1.1 Postgres version and migration history

```sql
select version();
-- expect: PostgreSQL 15 or later

select version, name from supabase_migrations.schema_migrations order by version;
```

- **History lists `20260824000000`, `20261005000000`, `20261005010000`:** use path A in §4 (`supabase db push`).
- **The history table is missing or empty** (the tables were created by hand in the SQL editor): use path B in §4 (paste files). Do **not** run `db push`. The init migration uses plain `CREATE TABLE` and would fail on the tables that already exist.
- **Any `20261010…` version is already listed:** stop. Something was applied out of band; compare with the repository before going on.

### 1.2 Tables the new migrations depend on

```sql
select t, to_regclass('public.' || t) is not null as present
from unnest(array['customers','products','labels','label_sessions','prescriptions','prescription_items',
                  'prescription_events','inventory_movements','idempotency_keys','suppliers',
                  'product_batches','stock_receipts','stock_receipt_items']) t;
-- expect: present = true for all 13
```

### 1.3 Columns the new migrations reference

```sql
select r.tbl, r.col, c.column_name is not null as present
from (values
  ('products','stock_quantity'), ('products','retail_price'), ('products','purchase_cost'),
  ('products','minimum_stock'), ('products','reorder_level'), ('products','maximum_stock'),
  ('products','is_active'), ('products','expiry_date'), ('products','batch_number'),
  ('product_batches','quantity_available'), ('product_batches','quantity_received'), ('product_batches','status'),
  ('inventory_movements','stock_before'), ('inventory_movements','stock_after'), ('inventory_movements','quantity'),
  ('prescriptions','print_count'), ('prescriptions','status'), ('prescription_items','morning_qty'),
  ('idempotency_keys','created_at')
) r(tbl, col)
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col;
-- expect: present = true for every row
```

### 1.4 Objects the migrations create must not already exist in another shape

`CREATE TABLE IF NOT EXISTS` silently keeps an existing table even if its columns differ, so check first.

```sql
select 'table' kind, t name, to_regclass('public.' || t) is not null as exists_already
from unnest(array['user_profiles','pharmacy_settings','sms_messages','audit_log','patient_returns']) t
union all
select 'sequence', s, to_regclass('public.' || s) is not null
from unnest(array['grn_number_seq','prescription_number_seq']) s
union all
select 'function', p, exists (select 1 from pg_proc where proname = p and pronamespace = 'public'::regnamespace)
from unnest(array['receive_stock','adjust_stock','create_prescription','quarantine_batch','release_batch',
                  'set_updated_at','audit_row_change','pharmacy_today']) p;
-- expect: exists_already = false for all, except possibly set_updated_at
```

If any is `true`, compare it with the definition in the migration before continuing.

```sql
-- Existing triggers the migrations will replace (they drop and recreate trg_<table>_updated_at / trg_<table>_audit)
select tgrelid::regclass, tgname, pg_get_triggerdef(oid)
from pg_trigger where not tgisinternal and tgname ~ '^trg_.*_(updated_at|audit)$';

-- Existing RLS policies (000400 enables RLS; policies that already exist would start to apply)
select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';
```

### 1.5 Data that the new CHECK constraints would flag

The constraints are added `NOT VALID`, so these rows do **not** block the migration. Record the counts now; they decide whether the constraints can be validated in §5.4.

```sql
select 'negative product stock' issue, count(*) from products where stock_quantity < 0
union all select 'negative price', count(*) from products where retail_price < 0 or coalesce(purchase_cost,0) < 0
union all select 'max < reorder level', count(*) from products where maximum_stock is not null and maximum_stock < coalesce(reorder_level,0)
union all select 'unbalanced movement', count(*) from inventory_movements where stock_after <> stock_before + quantity
union all select 'zero-quantity movement', count(*) from inventory_movements where quantity = 0
union all select 'batch available > received', count(*) from product_batches where quantity_available > quantity_received
union all select 'unknown prescription status', count(*) from prescriptions where status not in ('DRAFT','COMPLETED','CANCELLED')
union all select 'item quantity <= 0', count(*) from prescription_items where quantity <= 0
union all select 'blank patient name', count(*) from customers where btrim(name) = '';
```

### 1.6 Direct REST access in use today

After 000400, the publishable/anon key can no longer read or write any table. The web app in this repository never calls Supabase directly (checked: no `@supabase/*` dependency in `apps/web`). Confirm that nothing else does: another app, a spreadsheet or a script using the publishable key. Dashboard → Logs → API, filter on `/rest/v1/` requests that are not from the service role.

### 1.7 Data affected by the dispensing and threshold rules (migration 000500 and the new API)

None of these blocks the migration, and nothing here is changed automatically. Give the results to the pharmacist **before** the new API is deployed, because they decide which units can still be dispensed.

```sql
-- a) Batches with stock but no expiry date. After the new API is deployed these units are not
--    dispensed (unknown expiry). The pharmacist enters the expiry from the pack, or writes them off.
select p.name, b.batch_number, b.quantity_available, b.status
from product_batches b join products p on p.id = b.product_id
where b.quantity_available > 0 and b.expiry_date is null order by p.name;

-- b) Batches with stock whose expiry has passed (never dispensed; write off or quarantine).
select p.name, b.batch_number, b.expiry_date, b.quantity_available
from product_batches b join products p on p.id = b.product_id
where b.quantity_available > 0 and b.expiry_date < current_date order by b.expiry_date;

-- c) Batch records out of step with the product total. The current (legacy) dispensing path
--    reduces the product total but not the batches, so batch quantities drift upward.
select p.name, p.stock_quantity, coalesce(sum(b.quantity_available), 0) as batch_units
from products p left join product_batches b on b.product_id = p.id
group by p.id, p.name, p.stock_quantity
having coalesce(sum(b.quantity_available), 0) <> p.stock_quantity order by p.name;

-- d) Thresholds that may have come from the old column defaults (reorder 15 / minimum 5 /
--    maximum 500) rather than from a person. 000500 removes the defaults; it does not change
--    these rows. The pharmacist decides, product by product, which to keep.
select name, reorder_level, minimum_stock, maximum_stock from products
where reorder_level = 15 and minimum_stock = 5 and maximum_stock = 500 order by name;

-- e) Historical RETURNED adjustments (kept; new ones are refused).
select count(*) from inventory_movements where movement_type = 'RETURNED';
```

Only if the pharmacist confirms, in writing, that the thresholds listed in (d) were never set by anyone, clear them (one transaction, after the backup in §2):
```sql
-- begin;
-- update products set reorder_level = null, minimum_stock = null, maximum_stock = null
--  where reorder_level = 15 and minimum_stock = 5 and maximum_stock = 500 and id in (<ids the pharmacist listed>);
-- commit;
```

**Go / no-go:** continue only if 1.2 and 1.3 are all `true`, 1.4 has no unexplained `true`, and 1.6 shows no legitimate direct users. The results of 1.7 go to the pharmacist; they do not block staging.

---

## 2. Backup

Take both, and keep them **outside the repository** (for example an encrypted drive). They contain patient data.

1. **Platform backup.** Dashboard → Database → Backups. Note the time of the latest automatic backup. On a plan with point-in-time recovery, note the current timestamp as the restore point.
2. **Logical dump**, using the database connection string from Dashboard → Connect (session pooler or direct), with the database password:
   ```bash
   pg_dump "$DB_URL" --schema=public --format=custom --no-owner --file=pharmacy_pre_20261010_$(date +%Y%m%d_%H%M).dump
   pg_dump "$DB_URL" --schema=public --schema-only --file=pharmacy_pre_20261010_schema.sql
   ```
   Supabase CLI equivalent: `supabase db dump --linked -f schema.sql` and `supabase db dump --linked --data-only -f data.sql`.
3. **Check the dump** before going on:
   ```bash
   pg_restore --list pharmacy_pre_20261010_*.dump | grep -c "TABLE DATA"   # expect 13 before any 20261010 migration
   ```
4. Write down the row counts so they can be compared after the migration:
   ```sql
   select 'customers', count(*) from customers union all select 'products', count(*) from products
   union all select 'prescriptions', count(*) from prescriptions union all select 'prescription_items', count(*) from prescription_items
   union all select 'product_batches', count(*) from product_batches union all select 'inventory_movements', count(*) from inventory_movements
   union all select 'suppliers', count(*) from suppliers union all select 'labels', count(*) from labels;
   ```

---

## 3. Migration order

Apply strictly in this order. Each file runs in its own transaction: if a statement fails, that file changes nothing.

| Order | File | Depends on |
|---|---|---|
| (existing) | `20260824000000_init.sql` | — |
| (existing) | `20261005000000_prescription_domain_upgrade.sql` | init |
| (existing) | `20261005010000_inventory_v2.sql` | init |
| **1** | `20261010000100_schema_hardening.sql` | the three above |
| **2** | `20261010000200_profiles_settings_sms_audit.sql` | 000100 (`set_updated_at`) and `auth.users` |
| **3** | `20261010000300_transactional_functions.sql` | 000100 (sequences), 000200 (`pharmacy_today`, audit) |
| **4** | `20261010000400_row_level_security.sql` | all tables from 000200 |
| **5** | `20261010000500_returns_quarantine_dispensing.sql` | 000100–000400 (replaces the three stock functions, adds `patient_returns` with RLS) |

000400 closes public REST access. Apply it in the **same session** as the others; it is the most important of the five.

**Never re-run 000300 on its own after 000500.** 000300 would replace the hardened `receive_stock`, `adjust_stock` and `create_prescription` with their older versions (which accept `RETURNED` as a stock increase and can reactivate a quarantined batch). If 000300 must be re-run, re-run 000500 straight after it.

---

## 4. Applying

**Staging first.** Do everything in this section on a staging copy (a Supabase branch, or the §2 dump restored into a separate project), run §5 and §6 there, then repeat on the real project.

### Path A: migration history present (§1.1)

```bash
cd apps/api
supabase link --project-ref <project-ref>      # prompts for the database password
supabase migration list --linked               # the five 20261010 files must show as "local only"
supabase db push --linked --dry-run            # must list exactly the five 20261010 files
supabase db push --linked
```

Do **not** pass `--include-seed`.

### Path B: no migration history (§1.1)

In the SQL editor, open each of the five files from the repository, paste the **whole file** and run it, in the order in §3. After each one, check that the editor reports success before opening the next.

Then record them as applied so a later `db push` does not try again:
```bash
supabase migration repair --linked --status applied 20260824000000 20261005000000 20261005010000 \
  20261010000100 20261010000200 20261010000300 20261010000400 20261010000500
```
(Only after §1.2 and §1.3 confirmed the first three are effectively in place.)

### Then deploy the API

Deploy the API from this branch with the **new** `SUPABASE_SERVICE_ROLE_KEY` and `PRESCRIPTION_WRITE_MODE=legacy` (gate G6). Until the API is deployed, the old API keeps working against the migrated database, with two exceptions caused by 000500: an adjustment of type `RETURNED` is refused (the old Adjustments screen offers it), and receiving into a quarantined batch is refused. The service role bypasses RLS throughout.

---

## 5. Post-migration verification

### 5.1 Objects exist

```sql
select to_regclass('public.user_profiles'), to_regclass('public.pharmacy_settings'),
       to_regclass('public.sms_messages'), to_regclass('public.audit_log'), to_regclass('public.patient_returns');
-- expect: five non-null values

select proname, pg_get_function_identity_arguments(oid)
from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('receive_stock','adjust_stock','create_prescription','quarantine_batch','release_batch',
                  'pharmacy_today','set_updated_at','audit_row_change')
order by 1;
-- expect: eight rows

select column_name, column_default from information_schema.columns
where table_name = 'products' and column_name in ('reorder_level','minimum_stock','maximum_stock');
-- expect: column_default NULL on all three (no invented thresholds for new medicines)

select count(*) from pharmacy_settings;
-- expect: 1, with name/address/phone NULL (nothing invented)
```

### 5.2 Existing data unchanged

Re-run the row counts from §2 step 4. **Expect identical numbers.** Then:

```sql
select allergy_status, count(*) from customers group by 1;
-- expect: every existing patient UNKNOWN (an empty allergy field never becomes "no known allergies")

select count(*) from products where expiry_date is null;
-- expect: the same as before (0 on a database that required it); the migration only removes the NOT NULL
```

### 5.3 Function permissions

```sql
select p, has_function_privilege('anon', p, 'execute') anon,
          has_function_privilege('authenticated', p, 'execute') authenticated,
          has_function_privilege('service_role', p, 'execute') service_role
from unnest(array['public.receive_stock(jsonb,uuid,text)',
                  'public.adjust_stock(uuid,uuid,text,numeric,text,uuid,text)',
                  'public.create_prescription(jsonb,uuid,text)',
                  'public.quarantine_batch(uuid,text,uuid)',
                  'public.release_batch(uuid,text,uuid)']) p;
-- expect: anon = false, authenticated = false, service_role = true on every row
```

### 5.4 Constraints

```sql
select conrelid::regclass, conname, convalidated
from pg_constraint where connamespace = 'public'::regnamespace and contype = 'c' order by 1, 2;
```

New constraints show `convalidated = false`. If the counts in §1.5 were all 0, validate them now with the block in `DATABASE_MIGRATION_PLAN.md` § "Validating the deferred constraints". Otherwise give the pharmacist the rows from §1.5 to correct or explain (never delete them), and validate afterwards.

### 5.5 Application smoke test (staging, then production)

With a user who has the `pharmacist` role (§7):

1. Sign in to the web app; the dashboard shows real counts.
2. Label workstation: find a real medicine, build a label, save, print. The prescription appears under Prescriptions.
3. Receiving: record a delivery the pharmacy has **actually** received (a real invoice). It appears under Stock Movements, and the batch shows the expiry date from the box.
4. Adjustments: record a real stock count correction if one is due. Do not create test stock on the real project.
5. Returns: the Adjustments screen no longer offers "customer return to stock"; patient returns are recorded under Inventory → Returns and do not change stock.
6. `select action, entity_type, count(*) from audit_log group by 1, 2;` shows the changes above.

On staging, test receiving and adjusting with clearly named test records (`TEST — delete`), and never copy them to production.

---

## 6. RLS verification

Run in the SQL editor. Each block runs in a transaction that is rolled back.

```sql
-- 6.1 RLS is enabled on every application table
select c.relname, c.relrowsecurity
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
-- expect: relrowsecurity = true on every row

-- 6.2 The only policy is a staff member reading their own profile
select tablename, policyname, roles, cmd, qual from pg_policies where schemaname = 'public';
-- expect: exactly one row: user_profiles / user_profiles_self_read / {authenticated} / SELECT / (id = auth.uid())
```

```sql
-- 6.3 anon reads nothing
begin;
set local role anon;
select 'customers' t, count(*) from public.customers
union all select 'products', count(*) from public.products
union all select 'prescriptions', count(*) from public.prescriptions
union all select 'audit_log', count(*) from public.audit_log
union all select 'patient_returns', count(*) from public.patient_returns;
rollback;
-- expect: 0 on every row, even though the tables hold data
```

```sql
-- 6.4 anon cannot write (expect: ERROR 42501 "new row violates row-level security policy")
begin;
set local role anon;
insert into public.customers (phone_number, name) values ('0000000000', 'rls-check');
rollback;
```

```sql
-- 6.5 a signed-in user (authenticated) also reads nothing through REST
begin;
set local role authenticated;
select count(*) from public.customers;
rollback;
-- expect: 0
```

```sql
-- 6.6 anon cannot call the stock functions (expect: ERROR 42501 "permission denied for function")
begin;
set local role anon;
select public.adjust_stock(null, null, 'ADJUSTMENT_IN', 1, 'rls-check', null, null);
rollback;
```

**From outside**, with the publishable key (any machine):

```bash
curl -s "https://<project-ref>.supabase.co/rest/v1/customers?select=id&limit=1" -H "apikey: <publishable key>"
# expect: []
curl -s -X POST "https://<project-ref>.supabase.co/rest/v1/customers" -H "apikey: <publishable key>" \
  -H "Content-Type: application/json" -d '{"phone_number":"0000000000","name":"rls-check"}'
# expect: error code 42501
```

If 6.4 or the POST unexpectedly succeeds, delete the `rls-check` row and stop: RLS is not in effect.

---

## 7. User role assignment

Roles live in Supabase Auth `app_metadata.role` (values `admin`, `pharmacist`, `staff`). Only the service-role key can write `app_metadata`; users cannot change their own role. Nothing assigns roles automatically.

| Role | Can |
|---|---|
| `admin` | Everything, including deleting patient records |
| `pharmacist` | Labels and prescriptions; receive and adjust stock; create and edit medicines and suppliers |
| `staff` | Labels and prescriptions; create patients; record patient returns; read records. No stock, supplier, medicine or delete actions |
| *(none)* | Sign in, read records, create patients, **and create and print prescriptions (which deducts stock)**. Stock, supplier, medicine, return and delete actions are refused with "no role assigned". This is deliberate so accounts are not locked out before roles are assigned; once every account has a role, the owner can decide to require a role for prescriptions too (`STAGING_READINESS_REPORT.md`, decision O2). |

**Procedure:**

1. **List the accounts** (Dashboard → Authentication → Users) and write down every email address.
2. **The owner confirms, in writing, the role for each person.** Give each the least role they need; normally only the owner is `admin`. Accounts nobody recognises are disabled, not given a role.
3. Assign each role, from `apps/api`, with the **new** service-role key in `apps/api/.env`:
   ```bash
   node --env-file=.env scripts/set-user-role.js <email> <admin|pharmacist|staff>
   ```
   The script changes only `app_metadata.role` and keeps the user's other metadata.
4. Check the result:
   ```sql
   select email, raw_app_meta_data->>'role' as role, last_sign_in_at
   from auth.users order by role nulls first, email;
   ```
   Every row should match the owner's list from step 2.
5. Each person signs out and back in. In the web app the account menu shows their role. A `staff` user who submits a goods receipt is refused with "forbidden".

To remove a role, edit the user's `app_metadata` (service-role access) or ask an engineer to extend the script. Then ask the person to sign out and back in.

---

## 8. Rollback and recovery

All five migrations add objects and leave existing rows alone, so **fixing forward is preferred**. 000500 also replaces three functions and removes three column defaults; neither changes stored data. Decide by symptom:

| Symptom | Action |
|---|---|
| A migration file fails while running | Nothing to undo: the file's transaction rolled back. Read the error, fix the cause (often a §1.4 conflict), and re-run the file. All files are idempotent. |
| Receiving/adjusting fails after deploy | Check the API logs. If the functions are wrong, `drop function` them (statements in `DATABASE_MIGRATION_PLAN.md` § "Rolling back"); the API returns 503 for receiving and adjustments, and the rest keeps working. |
| Something legitimate relied on direct REST access (§1.6) | Add a narrowly scoped policy for that table and role. Disabling RLS re-opens every table to the public key; do it only as a short emergency step, per table, and re-enable it. |
| New tables cause a problem | They hold only data created after the migration. Export them, then drop them. |
| New columns | Leave them. Dropping `allergy_status` discards recorded allergy information. |
| 000500 functions misbehave | Re-running 000300 restores the older functions (see §3), which re-allows `RETURNED` as a stock increase. Prefer fixing forward; the API refuses `RETURNED` itself either way. Patient returns stay in `patient_returns`. |
| Data damaged | Last resort: restore. On point-in-time recovery, restore to the timestamp from §2. Otherwise restore the §2 dump into a **new** project, compare, and copy back only what is needed: `pg_restore --data-only --table=<t>`. A full restore discards every prescription and stock movement since the backup, so first export those (`pg_dump --data-only --table=prescriptions --table=prescription_items --table=prescription_events --table=inventory_movements`). |

After any rollback, re-run §6.1 and the external `curl` check to make sure public access has not been re-opened by accident.

### 8.1 ⚠ Steps that re-open public access to patient data

Each of the following leaves tables readable and writable by anyone holding the public (publishable) key. None of them may be used without the owner's explicit decision, and each must be followed **immediately** by re-applying `20261010000400_row_level_security.sql` (and 000500, which enables RLS on `patient_returns`) and re-running §6:

| Step | Why it re-opens access |
|---|---|
| `alter table … disable row level security` (listed as the 000400 rollback in `DATABASE_MIGRATION_PLAN.md`) | Directly removes the protection. Never as a fix for an application error: the API uses the service role and is not affected by RLS. |
| Restoring the §2 backup, or point-in-time recovery to a moment before the migrations | The restored database is the pre-migration one, where RLS is off on every table. |
| Restoring the §2 dump into a new project | The dump was taken with RLS off, and a new Supabase project grants `anon` and `authenticated` full table privileges by default. |
| `supabase db reset` (any project) | Rebuilds from migrations and runs `seed.sql`, inserting sample patients and medicines. Never on a real project. |
| Creating a new table by hand in the dashboard or SQL editor | New tables get Supabase's default grants and start with RLS off. Enable RLS on it in the same transaction. |
| Dropping `patient_returns` and recreating it without 000500 | Same as above. |

---

## 9. Sign-off record

| Step | Done by | Date / time | Notes |
|---|---|---|---|
| G1–G6 gates | | | |
| §1 compatibility output saved | | | |
| §2 backup taken and checked | | | |
| Staging: §4–§6 passed | | | |
| Production: §4 applied | | | |
| Production: §5 and §6 passed | | | |
| §7 roles assigned and confirmed by owner | | | |
| API deployed with new key, `PRESCRIPTION_WRITE_MODE=legacy` | | | |
| §1.7 results reviewed by the pharmacist | | | |

The application stays **NOT production-ready** until every row is complete and the staging end-to-end check in `STAGING_DEPLOYMENT_CHECKLIST.md` has passed.
