# Pharmacy POS — Test Report

**Date:** 2026-10-30 · **Machine:** local development machine, Node 20 · **Scope:** Milestone 1 (read-only catalogue, cart UI) plus full regression.

## 1. Results

| Suite | Command | Result |
|---|---|---|
| API, all (Jest) | `apps/api: npx jest` | **28 suites, 268 / 268 passed** (baseline 253 + 15 new POS tests) |
| Web, all (Vitest) | `apps/web: npx vitest run --testTimeout=30000` | **63 files, 2,023 / 2,023 passed** (baseline 1,994 + 29 new POS tests) |
| API TypeScript | `npx tsc --noEmit -p tsconfig.json` | Pass |
| Web TypeScript | `npx tsc --noEmit -p .` | Pass |
| API ESLint, new/changed files (`src/pos`, `src/auth/roles.ts`) | `npx eslint src/pos src/auth/roles.ts` | **0 problems** (no new API lint debt) |
| Web ESLint, new/changed files | `npx eslint components/pos lib/pos app/pos app/actions/pos.ts components/shell/nav.ts` | 0 problems |
| Route protection (every route needs a token, enumerated) | `app.security.spec.ts` | Pass, including the new `GET /pos/catalog` |
| SQL migration and concurrency tests | `run-migration-tests.sh` | **Not run:** no schema change in this milestone |
| `next build` | — | **Not run:** it would rewrite `.next`, which another session's dev server may be using |
| End-to-end, browser, touchscreen, scanner, printer | — | **Not run / not available** |

The existing label, prescription and inventory tests are included in the full runs above and all pass. The label print-fit tests ("a label that does not fit 70 × 50 mm is not printed") are among them.

## 2. New tests

### API: `apps/api/src/pos/pos.service.spec.ts` (15)

- A search term or barcode is required; an empty request returns 400.
- Generic-name matching works; inactive medicines are excluded; exact barcode lookup works; an unknown barcode returns an empty list.
- Sellable stock counts only eligible batches: quarantined, expired and undated batches are excluded; a batch expiring today counts and one that expired yesterday does not.
- Units recorded without a batch are counted only when the medicine's own expiry is valid; the sellable quantity never exceeds the product total.
- A missing, negative or non-numeric price is reported as null, never defaulted; a price of 0 is kept.
- Batches are listed earliest expiry first, and only to stock managers (admin, pharmacist), not to staff or cashiers.
- A database failure on products or batches is reported as 503, never as an empty catalogue.
- Roles: `cashier` is recognised but not in `ALL_ROLES`; admin, pharmacist, staff and cashier reach the catalogue; an account without a role gets 403.

### Web: `apps/web/lib/pos/cart.test.ts` (17)

Exact cents conversion; over-precise or invalid prices refused, not rounded; add and merge lines; multiple lines; no-stock refusal; cap at sellable stock with a notice; whole-unit quantity edits; zero removes the line; 9,999 maximum per line; remove; no mutation of earlier carts; exact subtotal (0.1 × 3 + 0.2 = LKR 0.50); unpriced lines flagged and left out of the subtotal; prescription-only count; empty cart; barcode detection; LKR formatting.

### Web: `apps/web/components/pos/PosWorkstation.test.tsx` (12)

The search box starts focused and Pay is disabled, with its reason shown. A scan adds the item and clears the box. **Two scans resolving out of order keep both items.** An unknown barcode shows a message and adds nothing. A name search lets you tap to add. A search failure shows an error with Retry, never "no results". The empty state appears when nothing matches. Quantity +/−/typed input is capped at stock, and a line can be removed. An unpriced or prescription-only item shows its warning and is left out of the subtotal. F9 clears the cart only after confirmation. F4 selects a patient, and the sale can go back to walk-in. F2 returns focus to the search box.

## 3. Brief test list (Step 12): coverage status

| Area | Status |
|---|---|
| Cart calculations, quantity changes | **Covered** |
| Pricing | Covered for display at recorded prices; server pricing not built (D-01, D-02) |
| Insufficient stock, expired batches (display/cart level) | **Covered** |
| Permissions (catalogue) | **Covered** |
| Discounts, taxes | Not built (D-03, D-04) |
| Cash change, checkout success/failure, duplicate checkout, concurrent sales, stock deduction | Not built (Milestone 3–4, blocked by financial decisions) |
| Invoice numbering, receipt generation | Not built (D-05, D-13) |
| Refunds, shift reconciliation | Not built (D-11, D-15) |

## 4. Notes

- The web suite needs `--testTimeout=30000` on this machine; the cause is load, not failures (known issue P1-10).
- Test data is synthetic and in-memory; no database was contacted.
