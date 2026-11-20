# Pharmacy POS — Remaining Work

**Date:** 2026-10-30 · **After:** Milestone 1.5 · **Plan:** `PHARMACY_POS_IMPLEMENTATION_PLAN.md`

## 1. Done so far

| Area | Status |
|---|---|
| Catalogue search, barcode scanning, sellable stock (approved rule D-08) | Done |
| Cart (quantities, limits, warnings, persistence with recheck) | Done; no financial rules applied |
| Customer selection (minimal lookup, walk-in) | Done |
| Cashier role, fail-closed API authorization, role-aware navigation | Done |
| Responsive and touch UI, verified in a browser at 6 viewports | Done |
| Checkout placeholder | Done; checkout disabled |

## 2. Blocked on the accountant (and owner)

No checkout, payment, invoice, tax, discount, refund, shift or stock-deduction code will be written until these are approved. Proposed defaults are in the plan, §4.

| # | Decision | Blocks |
|---|---|---|
| D-01 | Selling price source; rule for missing price | Checkout |
| D-02 | Currency, precision, rounding | Totals, receipts |
| D-03 | Tax treatment; receipt vs tax invoice | Totals, receipts, reports |
| D-04 | Discounts and approval limits | Cart pricing |
| D-05 | Invoice numbering scope and format | Invoices |
| D-06 | Payment methods (cash, card recorded externally, others) | Checkout |
| D-11 | Cashier shift rules (open/close, float, variance) | Checkout, reconciliation |
| D-13, D-15, D-17, D-19 | Receipt identity, refund method, void policy, costing | Receipts, returns, reports |

## 3. Milestones still to build (after approval)

| # | Milestone | Main work |
|---|---|---|
| 2 | Pricing engine | Server-side totals under D-02/D-03/D-04 |
| 3 | Checkout and persistence | Migration (`sales`, `sale_items`, allocations, payments, idempotency, immutability), `pos_checkout` function, API, Pay dialog; SQL and concurrency tests on the throwaway local PostgreSQL only |
| 4 | Batch-level deduction | FEFO allocation (approved D-08), no double deduction for prescription lines (D-12), Rx-only rule (D-09) |
| 5 | Invoices and receipts | Numbering, immutable snapshot, 58/80 mm and A4 templates, reprint log; physical printer test |
| 6 | Sales history | List, filters, detail, reprint |
| 7 | Returns and refunds | Approval workflow; returned medicines always held for review (D-14) |
| 8 | Cashier shifts | Open/close, expected vs counted cash, manager review |
| 9 | Reports and dashboard | From persisted sales only |
| 10 | Final regression | All suites plus staging |

**Recommended next milestone:** Milestone 3 (checkout and persistence) together with Milestone 2, **as soon as D-01 – D-06 and D-11 are approved**. Do not start it before then.

## 4. Verification still outstanding

| Item | Owner |
|---|---|
| Physical barcode scanner test (suffix, speed, repeat scans) | Pharmacy plus engineering |
| Touchscreen device test (tap targets, on-screen keyboard on load) | Pharmacy |
| Staging run against the real API and Supabase with real roles | Engineering, after P0-05 |
| Screen reader pass; Firefox and Safari spot checks | Engineering |

## 5. Prerequisites outside POS (from the roadmap)

| Item | Why it matters for POS |
|---|---|
| **Assign roles to all existing accounts** (P0-04) | Accounts without a role are now refused by the API |
| P0-06 stock reconciliation and transactional dispensing | Batch quantities drift while dispensing is `legacy`; POS sellable stock and future deductions depend on accurate batches |
| P0-05 apply migrations to staging | No end-to-end test is possible without it |
| P0-09 refresh tokens and server-side session check | Cashiers would be signed out mid-shift after about 1 h |
| B7 pharmacy settings endpoint | Receipt header (D-13) |
| P1-02 audit actor; P1-08 throttling | Audit and rate-limit POS patient lookups (security report, R-1) |

## 6. Known limitations to carry forward

- Search uses `ilike '%term%'` without a trigram index.
- A cashier can probe patient phone numbers 7 digits at a time (no throttling yet).
- The cart is per tab: closing the tab loses it (with a warning first), by design for shared tills.
- API lint debt: 683 errors and 44 warnings in existing files (none in POS code).
