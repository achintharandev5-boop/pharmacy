# Pharmacy POS — Cashier Security Report

**Date:** 2026-10-30 · **Scope:** what a `cashier` account (and any account without a recognised role) can reach, before and after Milestone 1.5.

## 1. Model

Roles live in Supabase Auth `app_metadata.role`, which users cannot write. The API verifies every token with Supabase (`AuthGuard`), then `RolesGuard` checks the role. The web interface only decides what to **show**. Hiding a link or redirecting a page is not a security control, and none is relied on as one.

## 2. Finding F-1 (High, fixed): routes without `@Roles` admitted any signed-in account

**Before:** `RolesGuard` returned `true` when a route had no `@Roles`. An audit of all 62 routes found **31 without `@Roles`**, reachable by a cashier, by an account with no role, and by an account with an unrecognised role. They included:

| Exposure | Routes |
|---|---|
| Entire patient table, unpaginated, all columns | `GET /customers` |
| Patient search returning every column (allergies, medical notes, address) | `GET /customers/search` |
| Patient profile and history | `GET /admin/patients/:id` |
| Prescriptions and detail | `GET /admin/prescriptions`, `GET /admin/prescriptions/:id` |
| **Writes** | `POST /admin/prescriptions/:id/reprint`, `POST /customers`, `POST /labels` |
| Stock, batches, movements, suppliers, label logs, analytics | 18 further `GET` routes |

**Fix:**
- `RolesGuard` now **fails closed**: a route without `@Roles` admits only `admin`, `pharmacist` and `staff` (`ALL_ROLES`).
- `cashier` is not in `ALL_ROLES`, so it reaches only routes that name it.
- An account with no role, or an unrecognised role, is refused everywhere.
- The two exceptions are explicit decorators: `@Public()` (`GET /health`, `POST /auth/login`) and `@AnyAuthenticatedUser()`, used only on `GET /auth/me`, which returns the caller's own identity.

**Cashier allowlist after the fix:** `GET /pos/catalog`, `GET /pos/customers`, `GET /auth/me`.

**Verification:** `apps/api/src/auth/route-authorization.spec.ts` boots the real `AppModule` and calls **every registered route**.
- **Refused accounts:** with cashier, no-role and unknown-role tokens, every route outside the allowlist returns 403, and the test asserts the database was never reached.
- **Named cases:** 13 explicit cashier cases are refused, among them the patient list, patient search, patient profile, prescriptions, reprint, label writes, dispensing batches, stock adjustments and receipts, and the reasons catalogue.
- **Staff access:** routes without their own `@Roles` stay open to staff, pharmacist and admin.
- **Guard tests:** `auth.guard.spec.ts` adds fail-closed cases at the guard level.

## 3. Finding F-2 (Medium, fixed): POS patient lookup exposed full patient records

**Before:** the Milestone 1 POS customer picker used `GET /customers/search`, which:
- matches on phone **or name**, so partial input was enough
- returns up to 50 rows of `select('*')`, including allergies, medical notes, age and address

**Fix:** new `GET /pos/customers?phone=` (cashier and staff roles). It:
- matches on phone digits only
- requires at least **7 digits**
- returns at most **10** results
- returns only `id`, `name`, `phoneLast4` and `registeredOn`

The dialog shows `••• 1234`. Tests assert that address, allergies, notes and the full number never appear in the response. The POS no longer calls `/customers/search`, which a cashier cannot reach anyway.

## 4. Finding F-3 (Low, fixed): cart state on a shared till

The cart is kept in `sessionStorage` (tab-scoped) so it survives navigation. It holds medicines and quantities only; **the customer is never stored**. The cart is cleared on sign-out and on Clear. Stored data is validated on read: anything malformed is discarded, and prices and stock are rechecked from the API.

## 5. Interface controls (display only)

- **Sidebar:** shows only the items the role may use. A cashier sees Point of sale only; an unknown or failed identity shows nothing.
- **Cashier header:** the admin search, stock alerts (no alert call is made) and Settings link are hidden.
- **Redirects:** a cashier opening `/`, `/admin/*` or `/label` is redirected to `/pos` by a server layout using the API-verified identity. If the identity cannot be checked, the page renders and its API calls are refused as usual.
- Batch numbers are returned only to stock managers. This is enforced by the API, not the UI.

## 6. Residual risks and recommendations

| # | Risk | Severity | Recommendation |
|---|---|---|---|
| R-1 | A cashier can still probe phone numbers 7 digits at a time and learn which numbers belong to patients, and their names. There is no rate limit and no audit record of lookups | Medium | Add per-user throttling on `GET /pos/customers` and log lookups (actor, time, result count, no number) once the audit work (P1-02) lands. Consider requiring the full number |
| R-2 | **Existing accounts without a role are now refused** everywhere except `/auth/me` (intended). If production has such accounts, they lose label-workstation access | Operational | Assign a role to every account before deploying (`scripts/set-user-role.js`), confirmed by the owner (roadmap P0-04, O2/O3) |
| R-3 | The web proxy still checks only that the session cookie exists (B4 / P0-09). Pages may render their shell before API calls fail | Low (data stays protected by the API) | P0-09 server-side session verification and refresh |
| R-4 | No tenant isolation (S-1); service-role key bypasses RLS | Critical (existing) | Single pharmacy per deployment (P0-03a) |
| R-5 | `GET /pos/catalog` reveals recorded price and sellable stock of every active medicine to a cashier | Accepted | Needed for the POS |
| R-6 | Login has no throttling (S-6) | High (existing) | P1-08 |

## 7. Not changed

Authentication (`AuthGuard`), token verification, `@Public` routes, the stock-manager and admin-only policies, RLS and all database functions are unchanged. No route became more permissive.
