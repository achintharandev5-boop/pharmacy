# Pharmacy POS — Implementation Plan

**Date:** 2026-10-30
**Status:** PLAN ONLY. No POS code, schema or migration has been written. Implementation of any financial or clinical rule waits for the decisions in §4.
**Code state inspected:** branch `codex/phase1-safety-fixes`, HEAD `e3c15e4` plus uncommitted work from other sessions (≈268 changed/untracked paths; none will be overwritten).
**Builds on:** `PHARMACY_POS_TECHNICAL_DESIGN.md` (design), `PHARMACY_ACCOUNTING_DECISIONS.md` (decision register), `PHARMACY_FULL_SYSTEM_AUDIT_2026.md`, `PHARMACY_DEVELOPMENT_ROADMAP.md`, `docs/DATABASE_SCHEMA.md`.

---

## 1. What exists today (verified in source)

| Area | Finding | Evidence | Consequence for POS |
|---|---|---|---|
| POS | Nothing: no sale, payment, invoice, refund or shift table, route or page | `docs/DATABASE_SCHEMA.md` "Not modelled"; no matches in `apps/api/src`, `apps/web/app` | Whole module is new |
| Prices | `products.retail_price` and `product_batches.retail_price` (numeric, nullable, ≥ 0). Both are set by a GRN line when a retail price is entered (`receive_stock`) | migrations `20261005010000`, `20261010000500` | Two candidate price sources; many products may have **no price**. POS must refuse to sell an unpriced item, never default one (D-01) |
| Stock | `products.stock_quantity` (integer base units) + `product_batches.quantity_available`; append-only `inventory_movements` with before/after | `20261010000300`, `000500` | Reusable ledger; needs a `SALE` movement type and sale reference columns |
| Batch-level deduction | `create_prescription` does FEFO over eligible batches (expiry known and not passed, not QUARANTINED/EXPIRED), locks products in id order, advisory-locks the idempotency key | `20261010000500` §8 | Proven pattern; POS checkout function will follow it exactly |
| Dispensing mode | Default `PRESCRIPTION_WRITE_MODE=legacy` deducts the **product total only**; batch totals drift | `prescriptions.service.ts:79`, roadmap P0-06 | A batch-level POS deduction on drifted batch data will refuse sales or mis-allocate. **Blocker for live use** (§6) |
| Units | Stock is integer base units; `pack_size` is a free integer; no unit/conversion table | `DATABASE_SCHEMA.md` | v1 sells base units only unless D-07 approves packs |
| Patient returns | `patient_returns` table, `HELD_FOR_REVIEW → DISPOSED`, never restocked | `20261010000500` §4 | POS returns reuse this hold-for-review rule; no automatic restock |
| Idempotency | `idempotency_keys(key, response_payload)`, namespaced (`rx:`, `grn:`, `adj:`) | `DATABASE_SCHEMA.md` | POS uses `sale:` / `refund:` namespaces plus a request hash |
| Roles | `admin`, `pharmacist`, `staff` in `app_metadata.role`; `STOCK_MANAGERS = admin, pharmacist`; routes **without** `@Roles` admit role-less users | `auth/roles.ts`, `roles.guard.ts:17` | Every POS route gets an explicit `@Roles`; no cashier/manager role exists (D-10) |
| Pharmacy identity | `pharmacy_settings` single row (name/address/phone null until entered), **no API**; label footer uses env (`lib/pharmacyBranding.ts`) | `20261010000200`, audit §I | Receipt header source must be decided (D-13); never invented |
| Tenancy | None (only `reasons` has `pharmacy_id`); service-role key bypasses RLS | audit S-1 | POS is single-pharmacy-per-deployment, matching roadmap option P0-03(a) |
| Patients | `customers` table, search by phone; walk-in = null `customer_id` | `customers.service.ts` | Optional customer on a sale; walk-in allowed |
| UI kit | `components/ui` (Button, DataTable, Dialog, Toast, States, Tabs, Page…), `AppShell` + `nav.ts`, tokens in `globals.css` | `apps/web/components` | POS screens reuse these; no new design system |
| Web → API | Server actions in `app/actions/*.ts` → `lib/api/server.ts` with the session token | audit §2 | POS actions follow the same pattern |
| DB tests | `apps/api/supabase/tests/run-migration-tests.sh` on a throwaway **local** PostgreSQL (refuses non-local hosts); PostgreSQL 18 installed locally | file header; `C:\Program Files\PostgreSQL\18` | POS SQL + concurrency tests run there only |

## 2. Scope and non-goals

**In scope (per brief):** sales UI, cart/pricing engine, checkout, cash + externally processed card, invoices/receipts (58/80 mm + A4 preview), batch-level inventory integration, returns/refunds with approval, sales history, cashier shifts, reports, admin settings, tests, four reports.

**Not in scope without separate approval:** online payment gateway; storing card data (only method, amount and an optional terminal reference/last-4 are stored — never PAN or CVV); multi-tenant/branch model (P0-03b); a local print agent / silent printing; applying migrations to Supabase; deployment; commits.

**Must not change:** 70 × 50 mm label printing (`PrintableLabel.tsx`, `labelFit.ts`), Sinhala wording and instruction engine, prescription write paths and clinical rules, existing inventory functions' behaviour (new migration only *adds*).

## 3. Architecture

### 3.1 Database (one new migration, `20261101000100_pos_core.sql`, additive and re-runnable)

| Table | Purpose / key constraints |
|---|---|
| `pos_settings` (single row) | currency, decimal places, rounding mode, enabled tender methods, invoice prefix, receipt width (58/80), receipt footer, tax mode, max cashier discount, refund window. Every financial field defaults to the approved value only; null = feature blocked |
| `cash_shifts` | `cashier_id`, `opened_at`, `opening_float`, `closed_at`, `counted_cash`, `expected_cash` (computed), `variance`, `variance_reason`, `status OPEN→CLOSED→REVIEWED`, `reviewed_by`. Partial unique index: one OPEN shift per cashier |
| `sales` | `invoice_number` U, `status COMPLETED / PARTIALLY_RETURNED / RETURNED / VOIDED`, `cashier_id`, `shift_id` FK, `customer_id` nullable + name/phone snapshot, `prescription_id` nullable, subtotal/discount/tax/total `numeric(14,2)`, `business_date`, `request_hash`, `idempotency_key` U, `snapshot jsonb` (immutable receipt view model) |
| `sale_items` | `line_number`, `product_id`, name/generic/strength/form/barcode snapshot, `quantity` (integer base units), `unit_price`, `line_discount`, `line_tax`, `line_total`, `prescription_item_id` nullable, `stock_deducted bool` (false for prescription-linked lines already dispensed — prevents double deduction), `returned_quantity` ≤ `quantity` |
| `sale_item_allocations` | `sale_item_id`, `batch_id` nullable, batch number + expiry snapshot, `quantity`; sum = line quantity (checked in function) |
| `sale_payments` | `method` (CHECK against approved list), `amount`, `tendered`, `change_given`, `external_reference` (≤ 64 chars, free text; never a card number — rejected by a 13–19 digit CHECK), `status` |
| `sale_returns` / `sale_return_items` | `REQUESTED → APPROVED → REFUNDED` or `REJECTED`; reason; requested_by / approved_by (must differ, per D-16); item qty ≤ remaining returnable; `disposition` always `HELD_FOR_REVIEW` (writes a `patient_returns` row) |
| `refunds` | `return_id`, `method`, `amount`, `shift_id`, `processed_by` |
| `print_jobs` | `document_type (RECEIPT/INVOICE/RETURN_NOTE)`, `sale_id`, `attempt`, `reason` (required for reprint), `requested_by`, `outcome` — records a dialog invocation, never "printed" |
| sequences | `pos_invoice_seq`, `pos_return_seq` — gaps allowed only on rollback, documented (D-05) |
| `inventory_movements` | add movement types `SALE`, `SALE_RETURN_HELD`; add nullable `sale_id`, `sale_item_id` FKs |

All tables: RLS enabled with no policies (same as existing), audit triggers (`audit_row_change`), `updated_at` triggers, ON DELETE RESTRICT from financial rows. Completed sales/payments are immutable: an `UPDATE`/`DELETE` guard trigger permits only status/returned-quantity transitions made by the POS functions.

**Functions (SECURITY INVOKER, service_role only, HINT error codes like the existing ones):**

- `pos_checkout(payload, user_id, idempotency_key)` — one transaction: advisory lock on key → replay if same hash / `IDEMPOTENCY_MISMATCH` if different → require OPEN shift for the cashier → lock products in id order → recompute prices from the approved source, discounts and tax from `pos_settings` → FEFO allocation over eligible batches (same rule as `create_prescription`) → reject `INSUFFICIENT_STOCK` / `EXPIRED_BATCH` / `PRICE_MISSING` / `PRODUCT_INACTIVE` / `RX_REQUIRED` without partial sale → insert sale, lines, allocations, payments, movements → update batch and product totals → verify tendered ≥ total and change ≥ 0 → store response → commit.
- `pos_request_return`, `pos_approve_return` (manager; writes `patient_returns` HELD_FOR_REVIEW, `SALE_RETURN_HELD` movement with quantity recorded but **no stock increase**), `pos_record_refund`.
- `pos_open_shift`, `pos_close_shift` (computes expected cash = float + cash sales − cash refunds − change), `pos_review_shift`.

### 3.2 API (NestJS module `apps/api/src/pos/`)

| Route | Roles (pending D-10) | Notes |
|---|---|---|
| `GET /pos/catalog?q=&barcode=` | cashier+ | name, generic, brand, barcode; price, sellable stock (eligible batches only), nearest expiry; batch list only for stock managers |
| `POST /pos/quote` | cashier+ | advisory totals; no writes |
| `POST /pos/sales` | cashier+ | `Idempotency-Key` required; returns immutable receipt model |
| `GET /pos/sales` | cashier (own) / manager (all) | paginated; filters invoice, date range, cashier, method, status |
| `GET /pos/sales/:id` | same | detail + payments + returns + print history |
| `POST /pos/sales/:id/print-jobs` | cashier+ | records attempt/reprint (reason required on reprint) |
| `POST /pos/returns`, `POST /pos/returns/:id/approve`, `/reject`, `/refund` | request: cashier; approve/refund: manager | |
| `GET/POST /pos/shifts`, `POST /pos/shifts/:id/close`, `/review` | cashier own; review: manager | |
| `GET /pos/reports/*` | manager | daily/weekly/monthly, by product, by cashier, tender summary, discounts, returns, shift reconciliation, sale movements |
| `GET/PATCH /pos/settings` | read: cashier+; write: admin | only approved fields editable |

DTOs with class-validator (`whitelist`), `ParseUUIDPipe`, money as strings/decimals validated to the approved precision; errors via `toHttpError`; pagination `page`/`pageSize` (max 100).

### 3.3 Web (Next.js)

- `app/pos/page.tsx` — full-screen touch workstation (outside the admin sidebar, like `/label`): search + barcode field (scanner = keyboard wedge, Enter-terminated, auto-focus), result grid with price/stock/expiry, cart with ± and number-pad quantity, remove/clear, customer picker (reuses `CustomerSearchPanel`), totals panel, Pay dialog (cash: tendered + quick-amount buttons + change; card: amount + optional terminal ref). Shortcuts: `F2` search, `F4` customer, `F8` pay, `F9` clear (confirm), `Esc` close, `+/-` qty. 1024–1920 px responsive; 44 px touch targets.
- Cart engine `lib/pos/cart.ts` (pure, integer minor-unit arithmetic; mirrors server rules for display only — server is authoritative).
- `components/pos/Receipt.tsx` with 58/80 mm `@page` and A4 preview; separate stylesheet scoped so it cannot affect the label `@page`.
- Admin: `app/admin/pos/sales`, `sales/[id]`, `returns`, `shifts`, `reports`, `settings`; nav entries in `components/shell/nav.ts`; dashboard sales tiles in `app/admin/page.tsx` (additive).
- Server actions `app/actions/pos.ts`; UI-test mode returns "unavailable", never sample sales.

### 3.4 Avoiding double deduction with prescriptions

A prescription's items are deducted when the prescription is saved (existing path, unchanged). A POS line created from a prescription item (`prescription_item_id` set) is **charged but not deducted** (`stock_deducted = false`, no allocation, no movement); a unique index on `sale_items(prescription_item_id) WHERE status not voided` prevents charging the same item twice. Standalone POS lines deduct via `pos_checkout`. Tested explicitly (§7).

## 4. Decisions required (blocking items marked ●)

Defaults below are **proposals**, not approvals. Nothing marked ● is implemented until approved.

### Decision record (owner response, 2026-10-30)

| Group | Items | Outcome |
|---|---|---|
| Financial | D-01 – D-06, D-11 (and so D-04, D-13, D-15, D-17, D-19 that depend on them) | **NOT APPROVED: wait for accountant.** Only work using no financial rule may proceed: read-only catalogue and cart UI, no checkout |
| Clinical / inventory | D-08, D-09, D-12, D-14 | **Approved as proposed** (still subject to pharmacist sign-off before live use) |
| Roles | D-10 | **Approved:** add a POS-only `cashier` role; managers = admin + pharmacist |
| Session scope | — | All milestones, stopping where a blocked decision or a data-integrity failure prevents progress |

Effect: Milestone 1 can be built. Milestones 2–10 all record, total, invoice, refund or reconcile money, so they are **blocked** until D-01 – D-06 and D-11 are approved. D-08/D-09/D-12/D-14 are applied wherever they need no financial rule (sellable-stock display, prescription-only flag).

| # | Decision | Proposed default | Approver |
|---|---|---|---|
| ● D-01 | Price source | `products.retail_price` (latest GRN retail price) is the selling price; null price ⇒ item cannot be sold (`PRICE_MISSING`); no price override in v1 | Owner |
| ● D-02 | Currency / precision / rounding | LKR, 2 decimals, half-up at line total; no cash rounding | Accountant |
| ● D-03 | Tax | v1 records **no tax lines**; prices are final; receipt says "Receipt" not "Tax invoice". Tax engine fields exist but are disabled until an accountant approves rates/treatment | Accountant |
| ● D-04 | Discounts | Disabled in v1. If enabled: line discount %, cashier max X %, above that manager approval, reason required | Owner + accountant |
| ● D-05 | Invoice numbering | `INV-YYYYMMDD-nnnnnn`, one global sequence per deployment (single pharmacy), Asia/Colombo business date, gaps only from rolled-back transactions (documented); reprint marked "REPRINT n" | Accountant + owner |
| ● D-06 | Payment methods | Cash; Card (recorded as processed on the external terminal, optional reference ≤ 64 chars, no card data); no split tender in v1 | Owner |
| ● D-07 | Sale units | Base units only (tablets/bottles as stocked); no pack conversion in v1 | Owner + pharmacist |
| ● D-08 | Batch allocation for POS | Automatic FEFO over eligible batches (same rules as `create_prescription`); expired/quarantined/undated never sold; cashier cannot pick a batch | Pharmacist |
| ● D-09 | Prescription-only medicines (`rx_required`) | Cannot be sold standalone at POS; only via a linked prescription, or by a pharmacist-role user (recorded) | Pharmacist |
| ● D-10 | Cashier / manager roles | Add `cashier` role (POS only) to the existing enum; manager = `admin` or `pharmacist`; `staff` may also sell | Owner |
| ● D-11 | Shifts | A sale requires an OPEN shift; one open shift per cashier; variance reason required when ≠ 0; manager review required | Owner + accountant |
| ● D-12 | Prescription ↔ sale | Prescription lines can be charged at POS without a second deduction (§3.4) | Pharmacist + owner |
| ● D-13 | Receipt identity | Receipt header from `pharmacy_settings` (requires the settings endpoint, roadmap B7); POS refuses to print a receipt with a blank name | Owner |
| ● D-14 | Returns window and condition | Returns allowed within 7 days, original invoice required, partial returns allowed, returned medicines always HELD_FOR_REVIEW (never restocked) | Pharmacist + owner |
| ● D-15 | Refund method | Same method as original payment; cash refund from the current shift | Owner + accountant |
| ● D-16 | Approval separation | Return approver ≠ requester; managers may not approve their own | Owner |
| D-17 | Void | No void after completion in v1; corrections only through returns | Accountant |
| D-18 | Receipt width / printer | 80 mm default, 58 mm option, A4 preview; browser print only | Hardware owner |
| D-19 | Cost / margin reporting | Out of v1 (costing method undecided); reports show sales value only | Accountant |
| D-20 | Retention | Financial records never deleted by the application | Accountant |

## 5. Milestones

| # | Milestone | Depends on | Exit criteria |
|---|---|---|---|
| 1 | POS foundation and sales UI (read-only catalogue, cart UI, no checkout) | D-01, D-10 | Search/barcode/stock/price from DB; empty/error/loading states; tests |
| 2 | Cart and pricing engine | D-02, D-03, D-04, D-07 | Unit tests: totals, qty, rounding, discount, tax off |
| 3 | Checkout + persistence (migration, `pos_checkout`, API, Pay dialog) | D-05, D-06, D-11 | Idempotent, atomic; duplicate/failed checkout tests; SQL tests on local PG |
| 4 | Batch-level inventory | D-08, D-09, D-12 | FEFO, expiry, negative-stock and concurrency tests; no double deduction with prescriptions |
| 5 | Invoices and receipts | D-13, D-18 | 58/80 mm/A4 templates; reprint log; label print tests still green |
| 6 | Sales history | — | Filters, pagination, detail, reprint |
| 7 | Returns and refunds | D-14, D-15, D-16 | Approval flow; held-for-review; refund in shift |
| 8 | Cashier shifts | D-11 | Open/close/variance/review tests |
| 9 | Reports and dashboard | D-19 | Reports from persisted rows only |
| 10 | Regression + integration | all | Full web/API/SQL suites; four reports |

Milestone rule: stop if a data-integrity failure (stock, money, idempotency) remains open.

## 6. Blockers outside POS that affect go-live (not fixed by this work)

1. **P0-06 batch drift:** while prescriptions use `legacy` mode, batch quantities diverge from product totals; POS FEFO can refuse sales or allocate wrongly. Live POS needs physical reconciliation and `transactional` dispensing, or an approved interim rule.
2. **P0-05:** existing migrations are not on staging; the POS migration comes after them.
3. **P0-04:** role-less accounts — POS routes avoid it with explicit `@Roles`, but the wider issue remains.
4. **P0-09:** ≈1 h session expiry interrupts a cashier shift.
5. **B7:** no pharmacy settings endpoint (needed for receipt identity).
6. No physical receipt-printer test.

## 7. Test plan (summary)

- **Web (Vitest):** cart maths, qty edits, remove/clear, change calculation, barcode input, shortcuts, states, receipt rendering at 58/80 mm, label print tests unchanged.
- **API (Jest, fake Supabase):** DTO validation, role matrix per route (role-less → 403), idempotency header required, error mapping, pagination, shift rules.
- **SQL (local throwaway PostgreSQL via `run-migration-tests.sh`, synthetic data only):** checkout success; rollback on failure; duplicate key replay; key with different payload; insufficient stock; expired/quarantined/undated batches; FEFO order; negative-stock prevention; prescription-linked line not deducted; invoice sequence uniqueness; return approval and held-for-review; refund ≤ paid; shift expected-cash; immutability triggers; card-number CHECK. Concurrency script: two sessions selling the last units.
- Existing suites (web 1,994, API 253, SQL 10–60) re-run after each milestone.

## 8. Safeguards

No commits, pushes, deploys, remote migrations or real patient data. Files modified by other sessions are touched only where POS must hook in (nav, dashboard, roles), with additive edits. No change to Sinhala wording, clinical rules or label printing.
