# Pharmacy Stock Reconciliation SOP

**Purpose:** controlled comparison of recorded stock with physical stock before any batch-level transactional dispensing or POS work.  
**Authority:** read-only exports and diagnostics do not authorize balance changes. Any adjustment needs a separate, approved, actor-attributed stock operation.

## Safety rules

- Work from an owner-approved staging copy/restore or an explicitly approved read-only source. Never run diagnostics or exports against production without a separately approved, controlled procedure.
- Keep `PRESCRIPTION_WRITE_MODE=legacy` or unset during this SOP. Do not enable transactional mode as a test shortcut on real data.
- No automatic updates, inferred opening balances, silent rounding, batch merging, or deletion of movements.
- Protect exports as sensitive pharmacy data. Store them encrypted outside the repository, restrict access, and retain only under the owner’s approved policy.
- A pharmacist determines clinical sellability and FEFO/expiry policy. The owner/stock controller authorizes financial inventory corrections. Record both approvals where relevant.

## Roles and records

- **Owner / controller:** approves scope, reconciliation time, authorized readers/counters, correction authority and record retention.
- **Pharmacist:** determines sellable, expired, quarantined, undated and returned-stock treatment; approves batch allocation policy.
- **Counter and independent witness:** two-person physical count; neither changes database balances during count.
- **Engineer/database reviewer:** prepares read-only export/diagnostic and validates proposed changes in a disposable clone.

Create a reconciliation packet with scope, pharmacy/branch, product identifier, batch identifier, count date/time/timezone, counter/witness, source records, before values, physical values, discrepancy class, resolution evidence, approver, action reference (if any), and after-verification. Do not put patient identifiers in the packet unless essential and approved.

## Procedure

### 1. Freeze scope and record configuration

1. Owner selects a staging project/copy and count window. Schedule a quiet period and pause receiving, dispensing, adjustment, transfer and returns for the counted scope, or record a precise cutoff with every subsequent event separately.
2. Verify environment identity and migration version. Record API version and `PRESCRIPTION_WRITE_MODE` without secrets. If the environment cannot be unambiguously identified as staging/read-only, stop.
3. Agree product scope and count method. Preserve existing unrelated work; do not stage or deploy changes for the count.

### 2. Capture recorded totals (read-only)

Export, without personally identifying patient data where possible:

- Product ID/SKU/barcode/name, active flag, `stock_quantity`, unit/pack notes and current price/cost fields only if approved.
- Every batch ID/product ID/batch number, `quantity_received`, `quantity_available`, status, expiry, supplier and receipt reference.
- Inventory movement ID/product/batch, type, signed quantity, `stock_before`, `stock_after`, timestamp, actor/reference and source link.
- Stock receipt headers/items and linked batch/movement IDs.
- Prescription headers/items or dispensing-event counts/references needed to identify legacy `DISPENSE` movements; minimize patient details and use stable IDs only if permitted.
- Schema migration version, query timestamp/timezone, diagnostic SQL version/hash, export row counts and read-only confirmation.

Use `apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql` on the isolated copy. It only selects. Review every result set: product vs batch aggregate, absent batches, negative balances, batch status/expiry, movement arithmetic/continuity/latest product balance, receipt line vs movement references, and unbatched dispense evidence. Save summarized result counts and discrepancy IDs, not sensitive raw exports in source control.

### 3. Identify legacy dispensing discrepancies

The legacy prescription path reduces `products.stock_quantity` and writes product-level dispense movements but does not reduce a selected batch. Therefore a product-minus-batch difference can include legacy dispensing, opening/unbatched stock, missing/incomplete receipts, manual edits, compensation failures, or migration history gaps. The diagnostic cannot distinguish these causes conclusively.

For each product, compare the cutoff product total with summed batch quantities. For each batch, compare received quantity, receipt items, linked movements and any known opening quantity. Inspect unbatched dispense movement evidence and reconcile it to prescription transaction timestamps/references. Mark the cause **unknown** when evidence is incomplete. Never allocate the unexplained difference to a batch or declare it valid opening stock by assumption.

### 4. Physical count

1. Count each item by product and identifiable batch; keep active/sellable, expired, quarantined, damaged, returned/held, and undated stock separate.
2. Record sealed packs and loose units in an explicitly approved base unit. Two people independently verify conversions and recount differences. Do not infer pack conversion from product text or historical defaults.
3. Record expiry exactly as printed; photograph/package evidence only under owner privacy policy. Note unreadable/missing labels and uncertain counts separately.
4. Compare physical count to both batch quantity and product aggregate at the same cutoff. Record duplicate/missing batch labels, unidentified stock and damaged packaging without adjusting records.
5. Have the pharmacist classify clinical sellability and quarantine/expiry handling. Escalate controlled medicines and any locally regulated handling to the pharmacy’s approved procedure.

### 5. Classify and approve discrepancies

Permitted classifications include: product/batch mismatch; missing batch record; candidate unbatched/opening stock (baseline unverified); legacy unbatched dispense evidence; expired quantity; quarantined/damaged quantity; receipt mismatch; negative aggregate/movement; incomplete movement chain; unknown. A category is not itself authority to correct.

For each discrepancy, attach source documents and physical-count evidence. Pharmacist signs sellability and batch/expiry decisions. Owner/controller signs valuation/correction authority and reason. Unresolved items stay explicitly unresolved and are excluded from batch-level sellable availability until policy and system behavior permit safe handling. No opening balance may be invented to force totals to match.

### 6. Separately prepare any correction (not part of this SOP)

Only after approvals, a database reviewer prepares a proposed correction using supported transactional inventory operations, never direct table updates. Include exact IDs, before/after values, movement reason/reference, actor, idempotency plan, row counts, backup, rollback/recovery plan and independent review. Test the operation on a disposable restored copy first. The owner approves the exact change set before any staging write; production requires a separate approval.

### 7. Validate FEFO and prepare transactional cutover in staging

On synthetic or restored disposable data, verify earliest eligible expiry allocation, deterministic concurrent requests, idempotent duplicate retry, no-stock rejection, expired/quarantined/undated exclusion, batch/product balance changes, movement arithmetic and prescription persistence. Compare before/after snapshots. Run negative cases and force a late transaction error to confirm rollback.

Before a staging mode change, require: completed discrepancy register; physically witnessed counts; pharmacist-approved FEFO, undated-stock and partial-fill rules; owner-approved correction evidence; applied staging migrations and RLS/role tests; successful backup/restore; API compatibility; rollback owner; explicit staging-only configuration approval. Staging cutover is not production authorization. Production cutover requires a separate signed change and post-shift reconciliation plan.

## Evidence and sign-off

| Product/batch scope | Recorded quantity | Physical quantity | Difference | Evidence / classification | Pharmacist | Owner/controller | Action ref / verification |
|---|---:|---:|---:|---|---|---|---|
| | | | | | | | |

**Disposition:** unresolved discrepancies remain unresolved. No adjustment is performed by this SOP. Current inventory is **NOT RECONCILED** until the pharmacy signs and validates the complete packet.
