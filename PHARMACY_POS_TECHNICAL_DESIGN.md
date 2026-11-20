# Pharmacy POS Technical Design (Preparation Only)

**Status:** Design proposal only. No POS schema, route, UI, migration or checkout code was implemented.  
**Prerequisite:** Establish tenant/branch authorization and reconcile stock before any POS data is written. Product pricing, pack rules, prescription policy and tax treatment require owner, pharmacist and accountant decisions.

## 1. Goals and invariants

The first POS release should support a single approved branch cash sale, auditable invoice/receipt, product-unit conversion, atomic stock allocation and optional prescription-linked dispensing. It should build on the current Next.js/NestJS/Supabase stack.

Invariants:

1. API derives `organization_id`, `branch_id`, user and permissions from verified membership, never an unrestricted client-supplied scope.
2. Checkout recalculates price, permissions, stock and batch allocation on the server. A quote/cart is advisory.
3. One PostgreSQL transaction creates the sale, lines, invoice number/snapshot, cash tender, batch allocations, stock ledger movements, product totals and prescription links.
4. A retry with the same scoped idempotency key returns the original result and never deducts stock twice; a different request using that key is rejected.
5. Completed sale, invoice snapshot and payment records are immutable. Void/return/refund are new linked records and compensating stock movements, never edits to the original sale.
6. A dispensed/sold unit is deducted once. Label printing reads a persisted sale/dispense snapshot and never causes another deduction.
7. A browser print-dialog call is recorded as an attempt, not as proof of physical output.

## 2. Proposed relational model

All business rows carry `organization_id`; branch inventory and cashier activity also carry `branch_id`. Use UUID primary keys, `timestamptz` event times, explicit `Asia/Colombo` business-date handling and restrictive foreign keys. Add tenant/branch support before sales launch, not after multiple pharmacies have data.

### Tenant and access foundation

- `organizations(id, name, status, timezone, currency, created_at)`
- `branches(id, organization_id, name, code, status, address_snapshot, created_at)` with unique `(organization_id, code)`
- `organization_memberships(id, organization_id, user_id, status)`
- `branch_memberships(id, organization_id, branch_id, user_id, role, status)` with organization/branch consistency constraints
- Backfill existing rows to one explicitly approved pilot organization/branch; audit FK completeness and every API query before enabling any shared tenancy.

### Catalogue and units

- Extend/products split by policy: organization-owned `products` and branch-specific `product_prices`/availability if branches can price differently.
- `product_units(id, organization_id, product_id, code, display_name, base_unit, base_units_per_sale_unit, barcode, active)`; conversion ratio is positive and immutable once referenced by a sale.
- Store `base_quantity` as the stock decrement quantity. Sale line preserves `sale_unit_id`, conversion numerator/denominator snapshot, entered sale quantity and resulting base quantity. Do not infer conversion from free text `pack_size`.
- Price rows should include currency, sale unit, unit price, effective interval, tax category/rate snapshot and approver. Price changes create new history; completed sale snapshots never change.

### Checkout records

`sales`

- `id, organization_id, branch_id, sale_number, cashier_user_id, customer_id nullable, status, currency`
- subtotal, discount, tax and total amounts in fixed-precision numeric/minor units; `created_at`, `completed_at`, timezone/business date
- `idempotency_key`, canonical request hash, response snapshot; unique `(organization_id, branch_id, idempotency_key)` and sale-number scope
- Optional `cashier_shift_id`; status transitions constrained (`DRAFT` only if later cart persistence is approved, `COMPLETED`, `VOIDED`, `PARTIALLY_RETURNED`, `RETURNED`).

`sale_items`

- `id, organization_id, branch_id, sale_id, line_number, product_id`
- immutable product name/strength/form/SKU/barcode and unit/pack snapshots
- entered quantity, conversion ratio, `base_quantity`, unit price, line discount/tax, extended total, currency
- optional `prescription_item_id`; unique mapping policy prevents a prescription item being dispensed and charged twice
- store price/tax rule identifiers and snapshots for reprint/audit; no live catalogue joins required to reconstruct an invoice.

`sale_item_batch_allocations`

- `id, organization_id, branch_id, sale_item_id, batch_id nullable, base_quantity`, batch number and expiry snapshots
- allocations sum exactly to the sale item's `base_quantity`; batch foreign key must belong to same product/branch
- nullable batch only for an explicitly approved unbatched legacy/opening stock policy; do not silently consume it.

`payments` / `payment_tenders`

- `id, organization_id, branch_id, sale_id, method, amount, currency, state, received_by, received_at, external_reference nullable`
- initial cash-only flow: accepted cash amount and change due/change given are explicit; tender total reconciles to amount paid.
- Treat gateway card/mobile authorization/capture as an external saga/outbox with idempotent provider references; external settlement cannot be atomic with PostgreSQL.

### Invoices, returns and print records

`invoices(id, organization_id, branch_id, sale_id, invoice_number, document_type, immutable_snapshot jsonb, issued_at)` with unique invoice number in the approved legal/business scope. Keep invoice content separate from the counter receipt's visual template. Accountant must decide receipt versus statutory tax invoice and numbering rules.

`sale_returns`, `sale_return_items`, `refunds` reference original sale/item/payment. Restocking requires a separate authorized decision and inspection; a patient-returned medicine must not automatically become sellable. Original invoice remains immutable; issue a linked credit/return document per approved rules.

`print_jobs(id, organization_id, branch_id, document_id, document_type, requested_by, reason, attempt_number, requested_at, browser_dialog_invoked_at, outcome, workstation_id nullable)` records invocation/error/reprint. Avoid a `printed=true` field unless a trusted printer agent confirms device completion.

### Prescription and label links

Keep the existing `prescriptions` / `prescription_items` as the clinical source of truth. Link a sold/dispensed prescription item from `sale_items.prescription_item_id` (or a dedicated `sale_item_prescription_links` table if one sale line can fulfill multiple prescription items). Persist the batch allocation on the sale item and connect it to dispensing history. A label is rendered from the completed prescription/sale item snapshot. Existing `prescription_events` can record print attempts; add a dedicated print-job record only when event semantics and retention are reviewed. Do not create a second prescription/label quantity deduction path.

## 3. Atomic cash checkout sequence

1. Web sends product/unit/quantity selections, optional customer/prescription link, tenders and `Idempotency-Key`; it sends no trusted totals or unrestricted tenant IDs.
2. API authenticates the user, loads active organization/branch membership and checks cashier/discount/prescription permissions.
3. SQL transaction claims a scoped idempotency key with canonical payload hash. Existing matching key returns stored completed response; hash mismatch returns conflict.
4. Lock affected product and batch rows in deterministic `(product_id, batch_id)` order. Recheck active status, expiry/quarantine, unit conversion and permitted stock policy.
5. Recompute effective prices, discount/tax permissions and totals from trusted catalog/price snapshots. Verify a submitted cash tender and change calculation.
6. Allocate eligible batches FEFO according to the pharmacist-approved policy. Reject insufficient eligible stock without partial sale. Store every allocation and immutable conversion snapshot.
7. Insert sale, lines, allocations, cash payment, invoice sequence/snapshot and any prescription/dispense links. Update batch balances, aggregate product total and append stock movement rows with before/after and sale reference.
8. Assert constraints: allocations equal base quantity; all totals balance; product total remains nonnegative; branch/product/batch scope matches; one prescription item isn't sold/dispensed twice.
9. Persist response in the idempotency record and commit. Any exception rolls the whole transaction back.
10. Return immutable receipt/invoice and label payloads. Printing occurs after commit; failure never rolls back a paid sale or restores stock. Reprint references the same document and never mutates inventory.

Use one narrowly scoped SQL RPC/transactional service entry point, with deterministic row locking and database uniqueness constraints. A saga/outbox is needed for external payment providers; do not claim the database transaction includes remote capture.

## 4. API and modules

Proposed modules: `organizations/branches/memberships`, `catalog/units/prices`, `sales/quote`, `sales/checkout`, `payments`, `invoices`, `returns/refunds`, `cashier-shifts`, `print-jobs`, and `reports`.

Initial endpoints:

- `GET /catalog/search?q=&barcode=` (branch availability/authorized prices)
- `POST /sales/quote` (advisory only; no stock mutation)
- `POST /sales` (atomic checkout; `Idempotency-Key` required)
- `GET /sales`, `GET /sales/:id`, `GET /invoices/:id`
- `POST /invoices/:id/print-attempts` (records dialog/job request; no inventory effect)
- Later: `POST /sales/:id/returns`, `POST /returns/:id/refunds`, `POST /shifts`, `POST /shifts/:id/close`.

Every route and RPC must derive and validate organization/branch membership server-side. Add cross-tenant and wrong-branch negative tests for list, detail, quote, checkout, print, return and reports. Because the current API uses a service-role Supabase client that bypasses RLS, do not rely on RLS alone; minimize service-role access, scope every query, and enforce scope in database functions/constraints as defense in depth.

## 5. Thermal receipt printing

Create a shared immutable invoice/receipt view model and separate 58 mm, 80 mm and A4 templates. The thermal version should have explicit printable width, safe margins, pharmacy identity, invoice number/date, cashier/branch, product/unit/quantity/price/discount/tax/total, tender/change, and legally approved footer. Content and tax fields are accountant-approved; do not call a generic receipt a tax invoice.

Browser printing is the first confirmation-based path: set paper size/margins, invoke `window.print`, record invocation and allow reasoned retry/reprint from the same snapshot. It cannot reliably choose a printer silently or confirm paper movement/cut. If unattended printing is necessary, separately evaluate a signed local print agent with enrolled workstation, authenticated bounded jobs, status callbacks, safe retries, versioning and no Supabase service secret. Test exact printer/driver/roll width, Sinhala/English fonts, cutter, margins, line wrapping and reprints on physical hardware.

## 6. Reuse and new work

**Reuse:** current Next.js App Router/server-action boundary, NestJS authentication/DTO validation, Supabase/PostgreSQL constraints and RPC patterns, products/barcode search, customer/patient records, `product_batches`, movement ledger, stock-receipt functions, idempotency table/pattern, prescription records/events, Sinhala label composer, 70 × 50 mm fit guard, browser print flow, and existing API/database test harnesses.

**New:** organization/branch/membership model and scoped authorization; sale and immutable line snapshots; explicit units/conversion and price history; atomic checkout/allocations; payments/tenders and cashier shift; invoice numbering/snapshots; return/refund/credit-note domain; audited print jobs; receipt templates; sales reconciliation/report definitions; tenant-negative, concurrency, idempotency, tax/rounding, pack-conversion and hardware acceptance tests.

## 7. Decisions required before implementation

- Owner: organization/branch ownership, pilot scope, customer walk-in handling, price/discount approvals, cashier permissions and invoice numbering scope.
- Pharmacist: prescription-only catalog policy, when sale links to dispense, required clinical review, FEFO eligibility, undated/opening stock and returned medicine disposition.
- Accountant/tax advisor: currency precision, discounts/tax inclusive/exclusive rules, receipt versus tax invoice, numbering, credit notes, retention and reporting definitions.
- Security/operations: tenant migration/backfill, identity/role model, database authorization strategy, backup/restore and payment provider secret handling.
- Hardware owner: supported receipt printers, workstation/browser/driver matrix and whether browser-confirmed printing is sufficient.

No POS implementation should start until these decisions, tenant/branch foundation, staging baseline and physical stock reconciliation are accepted.
