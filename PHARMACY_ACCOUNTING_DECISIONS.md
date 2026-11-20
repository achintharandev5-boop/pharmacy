# Pharmacy Owner and Accountant Decision Register

**Status:** unresolved decision worksheet; no tax, invoice or accounting treatment is assumed. Obtain advice applicable to the pharmacy’s registration, jurisdiction and transaction types. Do not label a generic receipt a statutory tax invoice without confirmation.

Record a decision, approver, date, evidence/advice reference, effective date and version. Blank or “pending” means **BLOCKED** for the dependent POS feature.

## Decision register

| Topic | Decision required | Questions to resolve | Approver / evidence | Status |
|---|---|---|---|---|
| Receipt vs tax invoice | Document types, mandatory fields and when each is issued | Which sales require a statutory tax invoice given registration/supply type? What is the approved wording/footer? Which details and retention rules apply? | Accountant/tax advisor + owner | **BLOCKED** |
| Invoice numbering | Legal/business scope, format and uniqueness | Per organization, branch, till or document type? Sequence gaps on rolled-back/void sales? Reset policy? Timezone/business date? How are duplicate/reprint/cancelled documents represented? | Accountant + owner | **BLOCKED** |
| Currency and precision | Stored/calculated/displayed precision | Currency, minor unit, rounding method and rounding point for line, tax and invoice totals? | Accountant | **BLOCKED** |
| Product sale price | Price authority and effective history | Organization or branch price? Price change approvals, effective time, sale-unit price, promotions, price override authority and immutable sale snapshot? | Owner + accountant | **BLOCKED** |
| Unit/pack conversion | Commercial and inventory units | Base unit per pack/strip, permitted fractions, rounding, barcode per package, conversion change after historical sales, sale and prescription quantity relationship? Pharmacist review required for dispense units. | Owner + pharmacist + accountant | **BLOCKED** |
| Tax | Tax category, inclusive/exclusive and rounding | Applicable tax categories/rates, exempt/zero-rated cases, inclusive/exclusive pricing, discount allocation, tax rounding and invoice presentation? Must be confirmed against current professional advice. | Accountant/tax advisor | **BLOCKED** |
| Discounts | Authority and accounting treatment | Line/order discount, maximum cashier discount, manager approval, tax base, promotional price and audit record? | Owner + accountant | **BLOCKED** |
| Cash tender | Amount received, applied, change | Does POS record amount tendered separately from amount applied? How is change funded/recorded, negative change prohibited, drawer cash counted, shortage/overage explained? | Owner + accountant | **BLOCKED** |
| Card/mobile tender | Provider integration and settlement | Launch scope cash-only? If card/mobile later, authorization/capture/refund states, provider fees, reconciliation and idempotency? External payment is not atomic with database transaction. | Owner + accountant | **BLOCKED** |
| Returns/refunds/voids | Documents, approvals and tender reversal | Partial return cap, return window/condition, refund method, void versus return, credit note requirements, tax reversal, restocking versus quarantine, manager/pharmacist approvals? | Owner + accountant + pharmacist | **BLOCKED** |
| Inventory costing | Cost and margin basis | FIFO, weighted average or other approved method; landed costs, supplier discounts, expiry/write-off and return cost treatment; when cost is recognized? | Accountant + owner | **BLOCKED** |
| Daily reconciliation | Source and close procedure | Reconcile sale totals, invoice sequence, cash tender/change, card/mobile settlements, refunds, voids, stock ledger and cashier shift? Who reviews exceptions and by what deadline? | Owner + accountant | **BLOCKED** |
| Retention and audit | Record retention and access | Required period for invoices, returns, sale snapshots, audit events, user attribution and export; privacy/data deletion constraints? | Accountant + privacy advisor + owner | **BLOCKED** |

## Proposed minimum POS accounting invariants (for review)

- A completed sale has one immutable sale snapshot and invoice/receipt document record; printing/reprinting does not create a second sale or stock deduction.
- Server recalculates totals from approved current price/tax rules; client-supplied totals are not trusted.
- Cash tender, applied amount and change are separately representable and reconcile to the due amount under the approved policy.
- Returns/refunds/credit documents reference original sale lines and payments; original records are not overwritten.
- Daily totals can be independently reconciled to immutable sale, tender, refund, invoice and inventory movement records.
- Reporting definitions specify timezone and treatment of discounts, tax, returns, voids and cost of goods sold.

These are design constraints, not an accounting opinion or approval.

## Approval record

- Pharmacy legal/business name: ______________________________
- Registration/tax status reviewed by: ______________________________
- Accountant/tax advisor: ______________________________
- Owner: ______________________________
- Decision register version/date: ______________________________
- Open decisions/exclusions: ______________________________
- Signed: ______________________________
