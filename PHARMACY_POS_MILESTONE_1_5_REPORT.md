# Pharmacy POS — Milestone 1.5 Report

**Date:** 2026-10-30 · **Branch:** `codex/phase1-safety-fixes` (uncommitted; nothing committed, pushed or deployed)
**Companion reports:** `PHARMACY_POS_UI_UX_VERIFICATION.md` · `PHARMACY_POS_CASHIER_SECURITY_REPORT.md` · `PHARMACY_POS_REMAINING_WORK.md`

## 1. Outcome

Milestone 1.5 is complete against its ten completion criteria (§7). The POS is a responsive, touch-friendly cart workstation with reliable barcode handling. Cashier accounts are now limited to the POS on both the server and the interface, and routes without an explicit role policy no longer admit any signed-in account. **Checkout remains disabled**: no sale, payment, invoice, tax, discount, refund or stock deduction exists. **Not production-ready:** accountant decisions, the existing P0 blockers, physical scanner testing and touch-device testing are still open.

## 2. Phase A — safety and baseline

| Item | Finding |
|---|---|
| Branch / HEAD | `codex/phase1-safety-fixes` at `e3c15e4`; about 290 uncommitted or untracked paths (other sessions' work plus POS) |
| Active sessions | No source file was edited by another session after 01:33 today; every later change is this POS work. A Next.js dev server for this project runs on port 3002 (PID 3152/28296, using `.next`). It was **not** stopped, restarted or rebuilt |
| Baseline | API 268 / 268, web 2,023 / 2,023 (Milestone 1 report, same tree) |
| Preservation | Edits to files other sessions changed are additive and keep their line endings. One existing test of another session's was **tightened** (§5) |
| Build isolation | The production build ran on a copy of `apps/web` in the session scratch directory (no `.env` files copied, `node_modules` linked), never in the shared `.next` |

## 3. Implemented features

### Phase B/F — POS interface and cart
- Two columns from 1024 px (search and results beside the cart), stacked below 1024 px with a fixed **View cart** bar that shows the item count and subtotal and jumps to the cart.
- Two-row header: account email, role and **Sign out** (cashiers have no other way out of `/pos`); customer selector. Staff also get a link back to the dashboard.
- Every control is at least 44 × 44 px (measured, §UI report). Visible focus rings. Loading, empty and error-with-Retry states.
- Cart: add, remove, + / −, typed quantity (applied on Enter or blur, so a transient "0" can never delete a line), − stops at 1 (only **Remove** deletes), capped at sellable stock with an explanation, "All sellable stock in cart" badge, clear with confirmation (F9 or button).
- **Cart kept across ordinary navigation and reloads** in this tab's `sessionStorage`. It holds medicines and quantities only, **never the customer**. On return, price and stock are rechecked: quantities are reduced, unavailable lines removed, and price changes reported. The cart is cleared on sign-out (shared till). A warning appears before closing or reloading with items in the cart.
- Fixed a design-system defect found in the browser: `IconButton` squeezed its icon to 6 px wide (padding conflict, because `cn` does not merge classes). This affected every icon-only button, including Receive Stock's **Remove line**. Fixed once in `components/ui/Button.tsx`.

### Phase C — barcode scanner
- Keyboard-wedge scanners are supported. When no field has focus, typed characters go to the search box, so a scan always lands.
- One scan is processed once: the second Enter of a CR+LF pair, or an auto-repeated Enter, is ignored (`lib/pos/scanner.ts`, 60 ms duplicate window). Deliberate repeat scans of the same pack are counted.
- Rapid consecutive scans: the box clears immediately, and each scan's result is applied to the current cart even when responses arrive out of order (tested with three scans).
- Clear feedback: "Added X (now n in cart)", unknown barcode, lookup failure.
- **Out-of-stock and unpriced products are shown but never added** (the cart engine refuses them). Prescription-only products are added with a warning, because D-09 applies at checkout.
- Manual entry is unchanged: names search as you type; Enter on a barcode looks it up once.

### Phase D — cashier navigation and authorization
- **API fails closed:** a route without `@Roles` now admits only `admin`, `pharmacist` and `staff`. A cashier, an account without a role, and an unrecognised role are refused before any database access. The only exceptions are `@Public()` (`/health`, `/auth/login`) and the new `@AnyAuthenticatedUser()`, used only on `GET /auth/me`.
- Cashier reach: `GET /pos/catalog`, `GET /pos/customers`, `GET /auth/me`. Everything else returns 403 (verified route by route).
- Sidebar shows only items for the role: a cashier sees **Point of sale** only, and the admin search, stock alerts and Settings link are hidden. An unknown role sees no links.
- Server-side convenience redirect: a cashier opening `/`, `/admin/*` or `/label` is sent to `/pos`.
- Details: `PHARMACY_POS_CASHIER_SECURITY_REPORT.md`.

### Phase E — product and stock display
Results show name, generic name, brand (when different from the name), strength and form, barcode, recorded price or **No price recorded**, sellable quantity or **Out of stock**, recorded stock when different, earliest sellable expiry, and **Prescription only**. Batches are shown to admin and pharmacist only. The sellable-stock rules are **unchanged**.

### Phase G — customer selection
New `GET /pos/customers?phone=` returns **id, name, last four digits and registration date only**. It needs at least 7 digits and returns at most 10 results. It does not match on names, has no listing, and never returns address, age, allergies, notes or history. The dialog masks the number (`••• 4567`), tells apart same-name patients by registration date with a warning, and handles no-match and error states. Walk-in stays the default. No registration workflow was added.

### Phase H — checkout placeholder
The cart footer states **"Checkout is pending accountant approval."**, says that no sale, payment or stock deduction happens, and lists the open decisions (selling price source, currency and rounding, tax, discounts, invoice numbering, payment methods, cashier shift rules). The **Pay** button was removed. No control implies a payment or a completed sale (tested).

## 4. Changed files

**API (NestJS)**

| File | Change |
|---|---|
| `src/auth/roles.guard.ts` | Fail closed: no `@Roles` means `ALL_ROLES`; honours `@AnyAuthenticatedUser`; typed request |
| `src/auth/decorators.ts` | New `AnyAuthenticatedUser()`; typed `CurrentUser` |
| `src/auth/auth.controller.ts` | `@AnyAuthenticatedUser()` on `GET /auth/me` |
| `src/auth/roles.ts` | Doc comment updated |
| `src/pos/pos.service.ts`, `pos.controller.ts`, `dto/pos.dto.ts` | Minimal patient lookup; catalogue `ids` parameter (cart recheck, at most 50) |
| `src/auth/auth.guard.spec.ts` | Fail-closed tests; typed supertest (now lint-clean) |
| `src/auth/route-authorization.spec.ts` | **New:** whole-application role matrix |
| `src/pos/pos.service.spec.ts` | Lookup and ids tests |
| `src/reasons/reasons.spec.ts` | One assertion tightened (§5) |

**Web (Next.js)**

| File | Change |
|---|---|
| `lib/roles.ts` | **New:** role list, labels, helpers |
| `lib/server/roleRedirect.ts` (+ test) | **New:** cashier → `/pos` |
| `app/admin/layout.tsx`, `app/page.tsx`, `app/label/layout.tsx` (new) | Cashier redirect; home page gains a Point of sale tile |
| `components/shell/nav.ts` (+ new `nav.test.ts`), `AppShell.tsx`, `AppShell.test.tsx` | Role-aware navigation and header |
| `components/ui/Button.tsx` | `IconButton` padding fix (`iconOnly` sizes) |
| `components/pos/PosWorkstation.tsx`, `PosCatalogResults.tsx`, `PosCart.tsx`, `PosCustomerDialog.tsx`, `PosWorkstation.test.tsx` | Phases B, C, E, F, G and H |
| `lib/pos/cart.ts`, `cart.test.ts` | Refuses unpriced items; reconcile; session storage; placeholder text |
| `lib/pos/scanner.ts`, `scanner.test.ts` | **New:** duplicate-scan gate |
| `app/actions/pos.ts` | `recheckPosCart`, `lookupPosCustomers` |

Not touched: label printing, `PrintableLabel`, Sinhala wording, instruction engine, prescription write paths, inventory functions, migrations.

## 5. Behaviour changes to note

1. **Accounts without a role lose access** to everything except sign-in and `GET /auth/me`, including the label workstation, which they could use before. **Assign a role to every existing account before deploying** (`scripts/set-user-role.js`).
2. `GET /health/db` and `GET /reasons` now need a pharmacy staff role (previously any signed-in account).
3. Another session's test, `apps/api/src/reasons/reasons.spec.ts`, asserted that an **unrecognised** role could read `GET /reasons` (200). That is exactly the access the brief requires removing, so the line now expects 403 for an unknown role and still 200 for staff and pharmacist. The assertion is stricter, not weaker.
4. `/`, `/admin/*` and `/label` render dynamically (their layouts check the role), adding one `GET /auth/me` per page load.

## 6. Tests

| Suite | Result |
|---|---|
| API (Jest), full | **29 suites, 302 / 302** (+34) |
| Web (Vitest), full, `--testTimeout=30000` | **66 files, 2,071 / 2,071** (+48) |
| Real browser (Edge, headless, Playwright) on the isolated production build | **141 / 141 checks**, 6 viewports, 4 roles |
| Production build (isolated copy, webpack) | Pass, including Next's own type check |
| TypeScript, API and web source | Pass |
| ESLint, whole web project | 0 problems |
| ESLint, every new or changed API file | 0 problems |
| `git diff --check` | Pass |
| SQL migration tests | Not run: no schema change |

Running the API and web suites **at the same time** caused timeout failures (7 API, 5 web, including two existing label tests). Each failing file passed when rerun alone, and the final numbers above come from running the suites one after another. The POS component test now allows 5 s for async UI. Details are in the UI/UX report.

**Existing API lint debt (separate from this work):** 683 errors and 44 warnings in 44 files (the audit recorded 724 / 60). 432 are `prettier/prettier`, and most of the rest are `no-unsafe-*`. None are in the POS or new or changed auth files.

## 7. Completion criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Responsive, touch-friendly POS UI | ✓ 6 viewports, no overflow, all targets ≥ 44 px |
| 2 | Reliable barcode workflows (automated) | ✓ unit, component and browser tests |
| 3 | Cart behaviour fully tested | ✓ |
| 4 | Role-aware cashier navigation | ✓ |
| 5 | Sensitive cashier API access restricted | ✓ fail-closed guard and route matrix |
| 6 | Patient lookup appropriately scoped | ✓ minimal fields, at least 7 digits, at most 10 results |
| 7 | Existing workflows unaffected | ✓ for staff, pharmacist and admin; role-less accounts intentionally lose access (§5) |
| 8 | Relevant automated tests pass | ✓ |
| 9 | Browser and hardware gaps documented | ✓ UI/UX report §5 |
| 10 | Checkout safely disabled | ✓ |

## 8. Remaining accountant decisions and next milestone

Open decisions: D-01 price source, D-02 currency and rounding, D-03 tax, D-04 discounts, D-05 invoice numbering, D-06 payment methods, D-11 shift rules (also D-13, D-15, D-17, D-19). **Recommended next milestone:** Milestone 3 (checkout and persistence), but only once these are approved. Until then, the work that can usefully proceed is the non-POS P0 items: role assignment, stock reconciliation, refresh tokens, and staging. See `PHARMACY_POS_REMAINING_WORK.md`.
