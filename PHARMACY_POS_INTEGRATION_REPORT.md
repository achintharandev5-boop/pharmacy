# Pharmacy POS — Integration Report

**Date:** 2026-10-30 · **Scope:** how the POS work so far connects to the existing system, and what is still unconnected.

## 1. Integration summary

| Existing module | Integration now | Status |
|---|---|---|
| Authentication | `/pos/catalog` behind the global `AuthGuard` (no token → 401, checked by the route-enumeration test) | **Integrated** |
| Roles | New `cashier` role, class-level `@Roles(POS_SELLERS)` on the POS controller; `ALL_ROLES` unchanged so cashiers gain no clinical access | **Integrated** |
| Products | Read from `products` (name, generic, brand, barcode, `retail_price`, `rx_required`, `is_active`) | **Integrated, read-only** |
| Inventory (batches) | Sellable stock computed from `product_batches` with the shared `isDispensableBatch` rule | **Integrated, read-only** |
| Inventory (ledger, deduction) | None. No `SALE` movement, no stock write | **Not integrated:** needs checkout (blocked) |
| Patients | Customer picker uses the existing `searchCustomersByPhone` action and `GET /customers/search` | **Integrated, read-only** |
| Prescriptions | None. Prescription-only items are flagged in the cart; linking a sale to a prescription item without a second deduction (D-12) is designed but not built | **Not integrated** |
| Label printing (70 × 50 mm) | Untouched; POS has no print path yet | **Unaffected** |
| Admin shell | "Point of sale" nav item; cashier role label in the header menu and Settings | **Integrated** |
| Dashboard / reporting | None (no persisted sales exist) | **Not integrated** |
| Settings (`pharmacy_settings`) | None (receipt identity, D-13; settings API missing, B7) | **Not integrated** |

## 2. Inventory integration status

| Requirement (brief, Step 5) | Status |
|---|---|
| Batch-level stock allocation | Eligibility rule applied for display; allocation not built |
| Expiry validation | **Done for display:** expired, undated and quarantined batches are never counted as sellable; a batch expiring today counts (same as `create_prescription`) |
| Available quantity verification | **Done for display/cart:** cart caps each line at sellable units. Server-side verification belongs to checkout (not built) |
| Atomic deduction, negative-stock prevention, concurrency, duplicate checkout, rollback | **Not built** (Milestone 3–4, blocked) |
| Stock movement history | Not built (needs `SALE` movement type) |
| No double deduction with prescriptions | Design in plan §3.4 (`stock_deducted = false` on prescription-linked lines, unique prescription-item link); not built |

**Data-integrity caveat (unchanged, outside POS):** while `PRESCRIPTION_WRITE_MODE=legacy`, dispensing deducts product totals but not batches, so batch quantities drift (roadmap P0-06). The POS shows sellable stock from batch records and caps at the product total. That is safe (it under-reports, never over-reports), but it may refuse stock that physically exists. A live POS needs reconciliation and transactional dispensing first.

## 3. Receipt printing verification

**Not applicable yet:** no receipt, invoice or print code exists. The 70 × 50 mm label print path was not modified, and its tests pass (see test report). Thermal receipt templates wait for D-05, D-13 and D-18 and need a physical printer test.

## 4. Data flow (as built)

```
/pos (PosWorkstation, client)
  └─ server action searchPosCatalog / lookupPosBarcode   (app/actions/pos.ts)
       └─ GET /pos/catalog  (Bearer token from the httpOnly session cookie)
            ├─ AuthGuard: Supabase token verified
            ├─ RolesGuard: admin | pharmacist | staff | cashier
            └─ PosService: products (+ product_batches) → price, sellable stock, expiry
                                                         (batches only for stock managers)
```

No POS request writes to the database.

## 5. Verification not yet possible

- End-to-end against a real API and Supabase (no staging; migrations P0-05 unapplied).
- Touchscreen and physical barcode scanner behaviour.
- `next build` (skipped so as not to disturb another session's dev server sharing `.next`; TypeScript and lint pass).
