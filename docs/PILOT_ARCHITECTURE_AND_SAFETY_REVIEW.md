# Technical review: single-pharmacy pilot

Scope: current dirty source at baseline `e3c15e4`, plus targeted remediation tracked
in the evidence manifest. This review does not approve clinical or stock policy.

## Deployment and access boundary

The production API now requires `PILOT_PHARMACY_ID`, an independently approved
`PILOT_SUPABASE_URL` matching `SUPABASE_URL`, and explicit HTTPS frontend origins.
After remote token verification, AuthGuard rejects absent/different server-managed
`app_metadata.pharmacy_id`. RolesGuard still enforces admin/pharmacist/staff/cashier
permissions; token/header/body claims cannot assign a role. Stock managers remain
admin/pharmacist. Cashiers retain only POS catalogue/minimal phone lookup and their
own identity; no clinical histories, prescribing or stock mutation.

The web server requires its production API target to match `PILOT_API_URL`; it no
longer retries login credentials against local fallback APIs in production. Local
development fallback behavior is retained. Production SMS is disabled irrespective
of the legacy development switch. The original provider code is preserved.

The shared Supabase client still uses a server-only service credential and bypasses
RLS. Browsers must not receive that credential or query business tables directly.
Local SQL checks exercise anon/authenticated denial and service-role execution.
These controls are NOT full SaaS tenant isolation and do not prove actual project,
storage, secret-store, hosting or network separation. A wrong independently approved
configuration can still bind the wrong environment; owner evidence is mandatory.

Before future shared SaaS onboarding, scope patients, products, prescriptions and
items, labels/sessions, suppliers, GRNs/items, batches, movements, returns, settings,
audit logs, idempotency keys, searches/reports, POS lookups and storage by tenant.
Propagate verified identity through every query/RPC, composite FK/unique constraint,
transaction lock, ledger entry and idempotency namespace. Add cross-tenant negative
tests and direct-REST policies; review any service-role bypass. Reasons already has
a pharmacy predicate; that alone does not scope the other modules. No speculative
tenant migration was added.

## Stock workflow trace

| Stage | Current code / behavior |
|---|---|
| Product registration | `products.service.ts` / `productRow`; privileged product writes; existing initial totals preserved |
| GRN and batch creation | `inventory.service.ts` calls `receive_stock`; supplier/header/items/batches/ledger updated transactionally |
| Expiry | API validation and SQL `pharmacy_today()` / eligible batch predicates; recorded undated/quarantined/expired stock excluded by existing rules |
| Adjustment | Stock-manager routes call `adjust_stock`; database locks and rejects underflow; no policy changes here |
| Prescription validation | `prescriptions.service.ts::validateRequest` verifies patient/product, active status, whole units, instruction combinations and printed batch expiry |
| Legacy write mode | Default unchanged: application steps, product-total deductions and compensating rollback; batch quantities are not reduced |
| Transactional mode | Explicit existing `create_prescription` RPC; locks products in ID order and eligible batches in FEFO order; one transaction |
| Allocation | Known valid expiry; order expiry/receipt/ID; unbatched residual requires existing product expiry rules; not newly approved |
| Inventory ledger | Transactional functions record per-batch movement, before/after totals and authenticated actor |
| Failed transaction | SQL exception rolls back prescription/items/batches/product/movements/idempotency; sequence gaps are normal |
| Retry/concurrency | Transactional advisory idempotency lock and row locks; existing synthetic concurrency scripts executed by local drill |

The default legacy path remains a dispensing blocker. It can diverge product and
batch totals. Its idempotency completion update occurs after business writes; a
failure there releases the key after the prescription has already been saved.
This retry/error boundary needs an approved correction before legacy dispensing
can be considered safe; do not infer safety from a green happy-path unit suite.
Do not switch modes as an error-recovery shortcut.

Printed-expiry preflight is performed before the transactional RPC's product locks.
Review concurrent batch depletion between preflight and actual allocation before
approving printed batch matching. Local scenario coverage is not a proof that all
interleavings or reconciliation conditions are handled. No allocation function,
schema, stock default, dosage computation or clinical wording was modified.

## Migration review

| Order | Migration | Dependency / review |
|---|---|---|
| 1 | `20260824000000_init.sql` | Initial products/customers/labels schema |
| 2 | `20261005000000_prescription_domain_upgrade.sql` | Prescription snapshots, items/events/stock references |
| 3 | `20261005010000_inventory_v2.sql` | Suppliers, receipts/items, batches and movement relationships |
| 4 | `20261010000100_schema_hardening.sql` | Existing schema, constraints/indexes, sequences and date helpers |
| 5 | `20261010000200_profiles_settings_sms_audit.sql` | Auth users, settings/SMS/audit; actor setting read by triggers |
| 6 | `20261010000300_transactional_functions.sql` | Prior tables/helpers; stock/prescription RPCs |
| 7 | `20261010000400_row_level_security.sql` | Business tables; deny direct access except own profile |
| 8 | `20261010000500_returns_quarantine_dispensing.sql` | Replaces earlier functions; returns/quarantine/FEFO and grants |
| 9 | `20261025000100_reasons_catalogue.sql` | Auth users/audit; pharmacy-scoped catalogue, immutable pharmacy assignment |

All nine were applied in order on a new PostgreSQL 18 cluster with minimal provider
stubs. The hardening series was reapplied in order with 000500 last, never leaving
older stock functions active. Reasons is a one-time migration, not generally rerunnable.
SQL tests check FK/quantity constraints, RLS and function execution; the restore drill
compares row counts and digests, canonical constraint definitions, RLS/policies,
function bodies/grants, table grants and sequence values. Evidence includes migration
SHA-256 values. Equivalent parentheses from PostgreSQL deparsing are normalized with
`pg_get_constraintdef(..., true)`; no business constraint was changed to pass.

These are fresh-schema/local checks. Existing hosted schema compatibility, migration
ledger drift, Supabase-managed Auth/storage and restore objectives remain NOT VERIFIED.
Use the existing staging runbook's read-only preflight and approval requirements.
Never run reset/drop scripts against live/shared databases or apply older function
definitions alone after the returns/dispensing migration. Recovery is a reviewed
forward repair or restore to a separate target, not ad hoc inverse SQL.

## Clinical and operational limits

Existing Sinhala text, dosage functions, wording modes, label snapshots and physical
70 × 50 mm layout were retained. The workstation recovery change only reopens the
existing validated editor after Cancel for a missing 5H/6H/8H quantity. It does not
assign a quantity or permit an incomplete print. English UI tests do not establish
complete approved English clinical wording; font network availability and actual
Sinhala glyph output require printer acceptance.

New login throttling is 10 attempts/minute per actual socket/Express IP, with a bounded
10,000-address in-memory map and `Retry-After`. It ignores arbitrary forwarded headers.
Behind a reverse proxy this can group users; approve an edge policy and provider Auth
settings. Restarts/replicas do not share this state. It is not a distributed brute-force
defense. Access-token expiry/re-login exists; refresh-token handling and provider
logout revocation are not implemented by the current cookie-only logout.

Supabase distinguishes session revocation from JWT lifetime; verify the actual hosted
provider behavior with copied-token tests rather than assuming immediate revocation
([provider sign-out guidance](https://supabase.com/docs/guides/auth/signout)).

Patient/product CRUD often uses direct service-role writes without setting the
transaction actor consumed by audit triggers. Some resulting `audit_log.actor_id`
values can therefore be NULL; reasons and transactional stock paths explicitly carry
actors. Full patient/prescription/stock attribution remains a release gate. Fixing
this comprehensively requires reviewed API/RPC changes, not trusting a client actor.

`/health` is liveness only. No verified provider/edge alerts, DB readiness probe,
backup schedule, incident contacts, remote restore, physical count or printer approval
is established by source inspection. POS checkout/payment/invoice persistence remains
unimplemented and is not counted as an operational feature.
