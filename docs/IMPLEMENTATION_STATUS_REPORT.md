# Implementation Status Report — Backend Repair, Database and UI/UX

Date: 2026-10-10 · Branch: `feature/ui-ux-redesign`

**Status: not production-ready.** Every code-side item below is done and tested locally. Going live still needs four things only the owner can do: rotate the exposed credentials, approve and apply the database migrations, set user roles, and run an end-to-end check against the real Supabase project. See §8.

Related documents: `PHASE0_SAFETY_AND_SECURITY_FINDINGS.md`, `DATABASE_SCHEMA.md`, `DATABASE_ERD.md`, `DATABASE_MIGRATION_PLAN.md`, `SUPABASE_DEPLOYMENT_GUIDE.md` (step-by-step runbook), `DATABASE_SECURITY_AUDIT.md`.

---

## 1. Where each phase stands

| Phase | State | Where |
|---|---|---|
| 1 Audit | Done | `PHASE0_SAFETY_AND_SECURITY_FINDINGS.md` |
| 2 Fabricated data removed | Done (frontend and backend) | commits `23bcf6d`, `2c61e1d`; inventory in §3 |
| 3 Database schema | Migrations written and tested on a throwaway local database. **Not applied to Supabase.** | `apps/api/supabase/migrations/20261010*`, commit `9035829` |
| 4 Authentication and security | Done in code. Credential rotation is still an owner action. | commit `2c61e1d`; SMS fix in this stage (§2) |
| 5 Backend business operations | Done | commit `2c61e1d`; medicine create/edit in this stage |
| 6 Frontend–backend integration | Done; matrix in §4 | — |
| 7 Unified UI/UX | Done for the admin pages and the label workstation | this stage; §5 |
| 8 Label workstation | STAT flow and number-pad backspace fixed (`25b5e8d`); tablet dosage layout fixed in this stage | §5 |
| 9 Testing | Unit, integration and SQL tests run locally (§6). No end-to-end run against Supabase. | — |

## 2. Changes in this stage

Commits: `260f89e` backend and security · `bd2423a` database migration and deployment guide · `6735323` design system and admin pages · `935e617` label workstation styling · `10f977e` demo product list deleted · this report in the commit that follows. Not pushed, merged or deployed.

1. **SMS could be sent without signing in (security, High).** `sendClientSms` is a Next.js server action, which means it is a public POST endpoint. The only check in front of it was the middleware, and that only confirms a cookie named `sb-access-token` *exists*; it never checks the value. Anyone who could reach the web server could send any text to any number through the pharmacy's Text.lk account. The action now verifies the session with the API (`GET /auth/me`, which validates the token with Supabase Auth) before it reads the SMS configuration or contacts the gateway. Tests: `app/actions/sms.test.ts`.
2. **Medicine create/edit (`POST /products`, `PATCH /products/:id`).** Accepts catalogue fields only. Stock, batch and expiry change only through receiving, adjustments and dispensing. Restricted to stock managers. A schema that is missing the new columns, or that still requires an expiry date on the medicine, now produces an explicit "apply migration 20261010000100" error. Nothing is invented to satisfy it.
3. **Label workstation on the shared design tokens.** About 840 hand-written colours, radii and shadows replaced with the tokens in `globals.css`. Gradients, backdrop blur and indigo accents removed. Layout, behaviour and clinical text unchanged.
4. **Tablet layout of the dosage rows.** At 1024 px the period name overlapped the QTY column and the "1 / 1" fraction wrapped onto three lines. Sizes now step up at the `xl` breakpoint (1280 px) instead of `lg`.
5. **Lint:** a helper misnamed `useLabelStoreStateCustomer` (not a React hook) was renamed. Behaviour is unchanged.
6. **Demo product list deleted.** `apps/web/constants/products.ts` (`HARDCODED_PRODUCTS`, 21 items with invented stock and expiry dates) and its test were removed with the owner's approval. Nothing else imported it. The items were **not** imported into Supabase. Real medicines come only from the database.

## 3. Fabricated-data inventory

| Item | Was | Now |
|---|---|---|
| Dashboard counts (`admin.service`) | `count \|\| 124` etc.; constant "+12.4%" texts | Real counts; errors return 503 |
| Dashboard activity chart | `Math.random()` per day | Aggregated from prescriptions and print events |
| Inventory summary | Invented totals (1,284 products, LKR 6.32M) | Real counts; no valuation without price data |
| `/admin/health` | Always "healthy" | Real API and database checks |
| Patients | 4 hardcoded people merged into every list and search | Removed |
| `/labels` | `SAMPLE_LABELS` on failure | Error returned |
| `POST /prescriptions` | Fabricated "saved" record on DB failure | Success only after confirmed persistence; failed saves are rolled back |
| Receipts and adjustments | `{ success: true, '(simulated)' }` on any error | Transactional database functions; real errors |
| Supplier create | Invented `sup_<timestamp>` record on failure | Error returned |
| Product search and dispensing validation | 21 hardcoded products with invented expiry and stock | Removed from runtime |
| Label expiry | "today + 1 year" when unknown | Only from the batch record or entered by the pharmacist |
| UI | Fake notifications, user identity, health bars, printer status | Removed, or replaced with live checks |

`apps/web/constants/products.ts` (21 demo items) has been deleted (§2.6). `apps/api/supabase/seed.sql` still holds sample patients and medicines for local development only and must never be run against the real project. The `Math.random()` in `labelStore.ts` generates client-side label IDs, not business data.

## 4. Frontend–backend integration matrix

Every server action calls a real API route. All routes need a valid Supabase JWT unless marked public. Write routes marked *stock* are limited to admin and pharmacist roles.

| Screen | Server action(s) | API route(s) | Access |
|---|---|---|---|
| Login | `handleLogin`, `getCurrentUser` | `POST /auth/login`, `GET /auth/me` | public / auth |
| Dashboard | `getAdminSummary`, `getAdminActivity`, `getAdminStatusBreakdown`, `getAdminTopProducts`, `getAdminAlerts`, `getAdminRecentActivity` | `GET /admin/dashboard/*` | auth |
| Patients | `getAllCustomers`, `searchCustomersByPhone`, `createNewPerson`, `deletePersonRecord`, `getPatientProfileData` | `GET/POST /customers`, `GET /customers/search`, `DELETE /customers/:id`, `GET /admin/patients/:id` | auth; delete: admin |
| Prescriptions | `getAdminPrescriptions`, `getAdminPrescriptionById`, `reprintAdminPrescription` | `GET /admin/prescriptions[/:id]`, `POST /admin/prescriptions/:id/reprint` | auth |
| Label workstation | `searchProducts`, `getProductByBarcode`, `getProductById`, `createPrescriptionRecord`, `logPrescriptionPrint`, `logPrescriptionSms`, `createLabelRecord` | `GET /products/*`, `POST /prescriptions`, `POST /prescriptions/:id/print`, `POST /prescriptions/:id/sms`, `POST /labels` | auth |
| SMS send | `sendClientSms` | `GET /auth/me`, then the Text.lk gateway | auth (verified, §2) |
| Label history | `getAdminLabelLogs`, `getRecentLabels` | `GET /admin/labels/logs`, `GET /labels` | auth |
| Medicines | `getAdminProducts`, `getAdminProductById`, `getProductMovementsData`, `createProduct`, `updateProduct` | `GET /admin/products[/:id][/movements]`, `POST /products`, `PATCH /products/:id` | auth; write: stock |
| Inventory | `getInventorySummary`, `getInventoryAlerts`, `getInventoryBatches`, `getInventoryMovements`, `getInventoryExpiryMatrix`, `getInventoryLowStock`, `getInventoryAnalytics`, `getAdminInventoryDashboard` | `GET /inventory/*`, `GET /admin/inventory/summary` | auth |
| Receiving (GRN) | `receiveStock` | `POST /inventory/receipts` | stock |
| Adjustments | `adjustStock` | `POST /inventory/adjustments` | stock |
| Suppliers | `getSuppliers`, `getSupplierById`, `createSupplier`, `updateSupplier` | `GET/POST /suppliers`, `GET/PATCH /suppliers/:id` | auth; write: stock |
| Settings | `getSystemStatus`, `getAdminHealth` | `GET /health` (public), `GET /health/db`, `GET /admin/health` | — |

**Disabled, with the reason shown in the UI:** editing pharmacy details in Settings. The `pharmacy_settings` table is in the pending migrations; the endpoint and form come after they are applied.

Every page distinguishes four states: loading, error with Retry, empty, and data. A failed request is never shown as zero.

## 5. Design system

- **Tokens** (`apps/web/app/globals.css`, `@theme`): white page, slate surfaces (`surface`, `surface-2`), one blue primary (`#2563eb`), semantic success/warning/danger/info colours with soft and border variants (AA contrast for text), radii of 6, 8 and 10 px, two shadows (`card`, `pop`), Geist Sans and Geist Mono. Sinhala label text keeps Gemunu Libre / Noto Sans Sinhala.
- **Components** (`apps/web/components/ui`): Button; Input, Select, Textarea, FormField (`Form.tsx`); Card; DataTable and Pagination; Dialog and ConfirmDialog; ToastProvider/`useToast`; Skeleton, EmptyState, ErrorState (`States.tsx`); Badge; TabNav and SegmentedControl (`Tabs.tsx`); Charts; page scaffolding with PageHeader (with breadcrumbs), PageBody, StatTile and SearchInput (`Page.tsx`).
- **Shell** (`components/shell`): one sidebar, header, search and account menu for every admin page. No invented notifications.
- **Label workstation:** keeps its touch-first layout and now uses the same tokens. Left as before, on purpose: the purple, teal and orange colours that mark instruction categories (Take, Before, After, and so on), which pharmacists may rely on to recognise them, and `PrintableLabel` (the printed 70 × 50 mm label).
- **Checked visually** with headless Edge at 1366, 1280 and 1024 px (workstation) and at 1366 and 820 px (admin).

## 6. Test results (re-run 2026-10-10 on the final commits, Node 20.17)

| Suite | Result |
|---|---|
| API unit and integration tests (Jest), including auth guard (missing, invalid, expired JWT), roles, persistence failures and stock services | **144 / 144 passed** (17 suites) |
| Web tests (Vitest), including server actions, the STAT workflow, the number pad and dosage logic | **91 / 91 passed** (10 files). Previously 97 / 11: the six tests of the deleted demo product list went with it |
| SQL migration tests on a disposable local PostgreSQL 18 cluster: constraints, foreign keys, rollback of a failed receipt line, adjustment atomicity, RLS (anon and authenticated denied; every table RLS-enabled), audit log, re-running every migration | **49 / 49 checks passed** |
| Concurrent stock update (two sessions on one batch) | **Passed**: stock never negative, ledger balanced |
| TypeScript, API and web | Clean |
| `nest build` (API) | Succeeds |
| `next build` | Succeeds (24 routes) |
| ESLint, web | **25 errors**, all in older label-workstation files (`any` types; setState inside effects in search inputs). None in the redesigned code. Not fixed: they sit in clinical dosage code and need a reviewed refactor. |

**Not run:** an end-to-end test against the real Supabase project (no credentials in this environment), real printing, a real SMS delivery, and automated accessibility audits.

## 7. Production-readiness checklist

- [x] Authentication fails closed; public routes explicitly allowlisted (`/health`, `/auth/login`)
- [x] Server-side roles on stock-changing and destructive routes
- [x] No hardcoded credentials in the source; environment variables validated at startup
- [x] No fabricated data in runtime code paths
- [x] Prescription success returned only after confirmed persistence
- [x] Receiving and adjustments are transactional; negative stock is prevented
- [x] SMS sending requires a verified session
- [ ] **Rotate the Supabase secret key and the admin password** (`DATABASE_SECURITY_AUDIT.md` §A1)
- [ ] **Approve and apply the migrations** following `SUPABASE_DEPLOYMENT_GUIDE.md` (compatibility checks, backup, staging, RLS verification)
- [ ] Assign roles to existing users, each confirmed by the owner (`SUPABASE_DEPLOYMENT_GUIDE.md` §7)
- [ ] End-to-end check on staging: sign in, create a prescription, print, receive stock, adjust stock, send SMS
- [ ] Upgrade Node to 22 LTS on all machines (jsdom is pinned to 26 because of Node 20)

## 8. Remaining blockers and follow-ups

| # | Item | Owner |
|---|---|---|
| B1 | Credential rotation | Owner |
| B2 | Apply the migrations. Until then, medicine creation fails with a clear "apply migration" message, and the transactional stock functions are unavailable, so receiving and adjustments return errors. | Owner approval |
| B3 | Move SMS sending into the NestJS API and record each message in `sms_messages` (needs B2). Add rate limiting on SMS. | Engineering |
| B4 | The middleware checks only that the session cookie exists. API calls are protected by the API itself, but pages render their shell before the first API call fails. Consider verifying the token in `proxy.ts`. | Engineering |
| B5 | 25 ESLint errors in the label workstation (§6). Deferred to a separate, controlled cleanup with clinical review. Rules are not suppressed, and dosage logic is not changed to satisfy the linter. | Engineering, with clinical review |
| B6 | ~~Decide what to do with `constants/products.ts`~~. Done: deleted, not imported (§2.6) | — |
| B7 | Pharmacy-details settings endpoint and form (needs B2) | Engineering |
