# Pharmacy POS — Development Report

**Date:** 2026-10-30 · **Branch:** `codex/phase1-safety-fixes` (uncommitted; nothing committed, pushed or deployed)
**Plan:** `PHARMACY_POS_IMPLEMENTATION_PLAN.md` · **Tests:** `PHARMACY_POS_TEST_REPORT.md` · **Integration:** `PHARMACY_POS_INTEGRATION_REPORT.md`

## 1. Status in one paragraph

Milestone 1 (POS foundation and sales UI) is implemented and tested. Milestones 2–10 are **blocked, not started**: on 2026-10-30 the owner chose to wait for the accountant on the financial rules (price authority, currency/rounding, tax, discounts, invoice numbering, payment methods, shifts). Every later milestone records, totals, invoices, refunds or reconciles money, so building it now would mean inventing those rules. The clinical rules (D-08, D-09, D-12, D-14) and the `cashier` role (D-10) were approved and are applied where they need no financial rule. **The POS module is not complete and is not ready for staging or production.**

## 2. Milestone status

| # | Milestone | Status | Blocked by |
|---|---|---|---|
| 1 | POS foundation and sales UI | **Done** (read-only; no checkout) | — |
| 2 | Cart and pricing engine | Partial: cart, quantity and exact cents subtotal at recorded prices. No discount, tax or rounding | D-02, D-03, D-04 |
| 3 | Checkout and transaction persistence | Not started | D-01, D-05, D-06, D-11 |
| 4 | Batch-level inventory integration | Read side done (sellable stock by the approved rule); deduction not started | Needs checkout (3) |
| 5 | Invoices and receipt printing | Not started | D-05, D-13, D-18 |
| 6 | Sales history | Not started | Needs persisted sales (3) |
| 7 | Returns and refunds | Not started | D-15, D-16 + sales |
| 8 | Cashier shifts | Not started | D-11 |
| 9 | Reports and dashboard | Not started | Needs persisted sales; D-19 |
| 10 | Final regression | Regression run for Milestone 1 only | — |

## 3. What was built

### Backend (NestJS)

| File | Change |
|---|---|
| `apps/api/src/auth/roles.ts` | New `Role.Cashier` (`cashier`). `ALL_ROLES` unchanged, so a cashier is **not** admitted to label, prescription, inventory or admin routes protected by `@Roles(...ALL_ROLES)`. New `KNOWN_ROLES` (used by `parseRole`) and `POS_SELLERS` (admin, pharmacist, staff, cashier) |
| `apps/api/src/pos/pos.module.ts`, `pos.controller.ts`, `pos.service.ts`, `dto/pos.dto.ts` | `GET /pos/catalog?q=` or `?barcode=`. Class-level `@Roles(...POS_SELLERS)`: a role-less account gets 403. Search matches name, generic name and brand name; inactive medicines excluded; 25 results. Returns recorded price (null when none, never defaulted), recorded stock, **sellable** stock and earliest sellable expiry. Batch numbers and quantities returned only to stock managers (admin, pharmacist). Read-only: no write of any kind |
| `apps/api/src/app.module.ts` | Registers `PosModule` |

**Sellable stock (D-08, approved):** identical to `create_prescription` and the existing `isDispensableBatch` helper, which is reused rather than copied. A batch counts when it has stock, a known expiry not yet passed, and a status other than QUARANTINED/EXPIRED. Units recorded without a batch count only when the medicine's own expiry is known and valid. The result is never more than `products.stock_quantity`.

### Frontend (Next.js)

| File | Change |
|---|---|
| `apps/web/app/pos/page.tsx` | New full-screen route `/pos` (protected by the existing proxy, like `/label`) |
| `apps/web/components/pos/PosWorkstation.tsx` | Workstation: search box (auto-focus, 56 px), barcode scanner support, results, cart, customer, totals, disabled **Pay** with its reason shown |
| `apps/web/components/pos/PosCatalogResults.tsx` | Results with price or "No price recorded", sellable/recorded stock, earliest expiry, Rx-only badge, batches (stock managers only); idle/loading/error-with-Retry/empty states |
| `apps/web/components/pos/PosCart.tsx` | Lines with − / quantity / + / remove (48 px targets), line totals, Rx warning |
| `apps/web/components/pos/PosCustomerDialog.tsx` | Patient search by phone (existing action), or walk-in |
| `apps/web/lib/pos/cart.ts` | Pure cart engine: integer cents; quantities capped at sellable stock and 9,999; whole units only; unpriced or over-precise prices flagged, never rounded |
| `apps/web/app/actions/pos.ts` | `searchPosCatalog`, `lookupPosBarcode` server actions |
| `apps/web/components/shell/nav.ts` | "Point of sale" in the Workspace section |
| `AppShell.tsx`, `app/admin/settings/page.tsx`, `app/actions/auth.ts` | `cashier` role label and type; Settings role list explains it |

**Keyboard and scanner:** F2 search · F4 customer · F9 clear cart (asks first) · Esc clears the search · Enter adds. Digit-only input of 6 or more characters is treated as a barcode and looked up exactly once on Enter; names search as you type (250 ms). The box clears as soon as a scan is submitted, and each scan's result is added even if a later scan finishes first, so fast consecutive scans never lose an item (tested).

**What the screen deliberately does not do:** sell, take payment, deduct stock, print, apply discounts or tax. Pay is disabled and says why. The subtotal is labelled "at recorded prices", and the screen states that the server recalculates totals at checkout.

## 4. Safeguards kept

- Label printing, Sinhala wording, clinical rules and prescription write paths: **untouched**.
- No migration, no database write, no remote database access, no real patient data.
- Edits to files other sessions had already changed are additive (one nav item, one role label, one type member, one settings paragraph). Line endings preserved.
- No commit, push or deploy.

## 5. Known limitations of Milestone 1

1. **Cashiers can still reach routes without `@Roles`** (for example `GET /customers/search`, used by the customer picker). This is the existing P0-04 behaviour for any signed-in account; it is not new, and adding `@Roles` to those routes is roadmap item P0-04.
2. The admin shell shows all navigation to a cashier; the pages they cannot use return 403 from the API. Role-based navigation is not built.
3. Sellable stock is computed from batch records that are known to drift while dispensing runs in `legacy` mode (P0-06). The screen can show fewer sellable units than are physically present until stock is reconciled.
4. Search uses `ilike '%term%'` with no trigram index (same as the existing product search).
5. Not verified in a browser against a real API and database, or on a touchscreen or physical scanner.

## 6. Financial decisions pending approval (blocking)

D-01 price source and missing-price rule · D-02 currency, precision, rounding · D-03 tax treatment and receipt vs tax invoice · D-04 discounts · D-05 invoice numbering · D-06 payment methods · D-11 shift rules · D-13 receipt identity · D-15 refund method · D-17 void policy · D-19 costing/margin. Details and proposed defaults: plan §4; register: `PHARMACY_ACCOUNTING_DECISIONS.md`.

## 7. Next steps

1. Accountant and owner decide D-01 – D-06 and D-11 (they can approve or amend the proposed defaults in the plan).
2. Then: Milestone 3 migration (`pos_checkout` with FEFO, idempotency, immutability) tested on the local throwaway PostgreSQL, followed by Milestones 4–10 in order.
3. In parallel, outside POS: P0-06 stock reconciliation and transactional dispensing, P0-04, P0-09 and B7 (pharmacy settings endpoint), all prerequisites for live POS use.
