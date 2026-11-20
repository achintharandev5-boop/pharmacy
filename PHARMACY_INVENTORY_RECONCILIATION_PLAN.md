# Pharmacy Inventory Reconciliation Plan

**Date:** 19 October 2026  
**Scope:** Read-only diagnosis and controlled reconciliation planning. No live database was contacted or changed.  
**Decision:** Keep `PRESCRIPTION_WRITE_MODE=legacy` until a pharmacist approves the allocation policy and the owner approves a separately planned cutover.

## Current integrity model and verified mismatch

The relevant balances are:

- `products.stock_quantity`: aggregate product stock used by legacy dispensing and some screens.
- `product_batches.quantity_available`: current quantity recorded per batch.
- `inventory_movements`: signed stock events (`quantity`), product-level `stock_before`/`stock_after`, optional `batch_id`, and optional source references.

The default legacy prescription path decrements `products.stock_quantity` and writes a product-level `DISPENSE` movement, but does not decrement any `product_batches.quantity_available`. Repeated legacy dispensing can therefore make the product total lower than the sum of batch quantities. The movement ledger records what the application attempted; it is not proof of physical stock.

For each product, calculate `product_total - batch_available_sum`. A nonzero result is a discrepancy requiring investigation. It is not automatically “unbatched opening stock”: opening quantities, legacy batch entry, damaged goods, manual edits, and incomplete writes can produce similar results. Negative or fractional balances also require review; never round them silently.

Ledger movements can be checked for internal arithmetic (`stock_after = stock_before + quantity`), sequence continuity, and latest recorded balance versus the current aggregate. Net movement cannot establish current stock without a trusted opening balance/cutoff. Batch movement totals likewise cannot establish batch balances without a known batch opening quantity and complete movement history. Do not infer either baseline from the current balance.

## Read-only diagnostics

Run [`apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql`](apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql) against an isolated staging clone or a disposable local database with the expected migrations applied. It contains `SELECT` statements only. Review all result sets; it does not recommend or perform updates.

The queries report:

1. Aggregate product totals compared with summed batch availability, including positive/negative differences and batch-status totals.
2. Batch quantities beside receipt-item totals and linked movement summaries. Receipt and movement history are evidence, not an assumed complete opening baseline.
3. Movement arithmetic violations and per-product chronology continuity breaks.
4. Latest movement `stock_after` compared with the current product total.
5. GRN receipt-item totals compared with linked `STOCK_RECEIVED` movements where source references exist.

Any result can include historical legitimate exceptions or incomplete records. Have the pharmacy owner and pharmacist classify each discrepancy against source documents and physical counts before deciding what it means.

## Disposable-data checks

[`apps/api/supabase/tests/50_inventory_reconciliation_readonly_test.sql`](apps/api/supabase/tests/50_inventory_reconciliation_readonly_test.sql) creates fixture rows only in connection-local temporary tables, checks expected mismatch/arithmetic detection, then rolls the transaction back. It never inserts into application tables. Run it only on a disposable local PostgreSQL instance. **Verification update, 19 October 2026:** this fixture was run against a separately initialized disposable PostgreSQL 18.1 cluster; all assertions passed and the test transaction rolled back. See `PHARMACY_PHASE_1_5_VERIFICATION_REPORT.md`. This local result does not verify live inventory or staging.

The tests demonstrate that:

- product 100 versus batch sum 80 is surfaced as a 20-unit difference, not “fixed”;
- a signed dispense of -5 moves 100 to 95 under the ledger arithmetic;
- a malformed movement and a broken movement sequence are detectable;
- a missing opening baseline remains unknown rather than being manufactured.

## Safe operational reconciliation

1. **Prepare a controlled staging copy.** Verify its migration ledger, schema, roles and backup. Use masked/synthetic data unless an approved protected copy is necessary. Do not point diagnostic scripts at production.
2. **Capture evidence read-only.** Record UTC/local timestamp and timezone, query version, product/batch/movement exports, receipt references and application write mode. Restrict and protect exports because they may contain sensitive identifiers.
3. **Stop and count under pharmacy control.** At an owner-approved time, pause stock-changing activity for the affected scope. A pharmacist/stock manager counts sellable, expired, quarantined, damaged and undated stock separately by product and identifiable batch. Record counter, witness, time, source documents and uncertainty.
4. **Reconcile on paper first.** For each product/batch, compare physical counts, aggregate totals, batch rows, receipt documents, movement history and known historical adjustments. Explicitly label unknown or unbatched quantities; do not create opening balances to make totals match. Escalate irreconcilable or fractional amounts.
5. **Approve classifications.** The pharmacist approves clinical sellability, expiry/FEFO handling and treatment of undated stock. The owner/finance controller approves any accounting/stock correction and its audit reason. Record sign-off and the exact before/after evidence in a controlled reconciliation record.
6. **Prepare a separately reviewed write plan.** Only after approval, design idempotent, actor-attributed corrections using supported inventory operations. Preview row counts and before/after values; require a backup and rollback/recovery plan. This phase has not prepared or executed such writes.
7. **Exercise transactional dispensing in staging.** Use a restored disposable snapshot and the approved allocation rules. Verify FEFO, status/expiry exclusions, no-stock rejection, duplicate retry, simultaneous last-stock requests, rollback, movement rows, product/batch totals and prescription persistence.
8. **Cut over only by explicit approval.** A later release must set the mode explicitly in the approved environment, confirm the deployed code/migrations, have a staffed rollback plan that does not discard sales/dispensing records, and reconcile balances after each pilot shift. Do not switch mode as a side effect of a migration.

## Required approvals and blockers

- **Pharmacist:** physical count sign-off; expired/quarantined/undated handling; FEFO policy; approval of transactional dispensing behavior.
- **Owner/stock controller:** discrepancy classification, correction authority, staging access, and any eventual cutover window.
- **Security/operations owner:** backup/restore evidence and authorization for any protected staging copy.

Until these approvals and staging evidence exist, stock remains unreconciled for batch-level availability and transactional dispensing remains disabled. No adjustment SQL, migration, or production action is authorized by this plan.
