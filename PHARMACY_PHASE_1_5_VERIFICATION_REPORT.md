# Pharmacy Phase 1.5 Staging and Inventory Safety Verification

**Verification date:** 19 October 2026  
**Branch:** `codex/phase1-safety-fixes`  
**Scope:** Local source review, synthetic PostgreSQL diagnostics/migration tests, web/API checks, and POS design review. No Supabase, production database, deployment, SMS gateway, payment processor, or physical printer was accessed. No stock balances were automatically reconciled or changed outside disposable test databases. No POS implementation was started.

## Executive decision

**Phase 1.5 technically verified locally: PARTIAL. Phase 2/POS: NOT READY.** The read-only inventory diagnostic fixture, migration/dispensing SQL suite, concurrent checkout-like dispensing cases, API tests, web tests, lint, and production build all passed locally. Next.js 16 middleware was migrated to the supported `proxy` convention without changing its redirect or matcher behavior; dedicated tests pass.

These results do not establish that live stock is accurate, migrations/RLS are deployed, pharmacy roles are correct, backups can be restored, or physical labels print safely. Transactional dispensing must remain disabled for existing live data pending inventory reconciliation and pharmacist approval. POS development remains gated on tenant/branch authorization and outstanding owner, pharmacist, and accountant decisions.

## Worktree and files

The branch had extensive pre-existing modified and untracked files. They were not staged, committed, pushed, reset, or overwritten. Work in this verification was limited to:

- `apps/web/middleware.ts` → `apps/web/proxy.ts`: Next.js 16 convention migration; redirect conditions and matcher preserved.
- `apps/web/proxy.test.ts`: five focused tests for protected/login navigation and matcher exclusions.
- `apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql`: read-only comparison queries and explicit review flags for aggregate/batch/ledger/receipt discrepancies.
- `apps/api/supabase/tests/50_inventory_reconciliation_readonly_test.sql`: synthetic fixture that executes the diagnostic and asserts expected findings without persisting its fixture changes.
- This report.

`git diff --check` completed without whitespace errors; Git printed line-ending conversion notices for pre-existing changed files. No staging or commit operation was run. The earlier Phase 1 quantity validation remains in place.

## Verification results

| Check | Result | Evidence / limits |
|---|---|---|
| Full web ESLint | **PASS** | `pnpm --filter web lint`; exit 0, no diagnostics. |
| Web Vitest | **PASS** | `pnpm --filter web exec vitest run`; 22 files, 360 tests passed, including 5 proxy tests. First sandbox attempt failed at esbuild startup with `spawn EPERM`; rerun with local execution permission passed. |
| Web production build | **PASS** | `pnpm --filter web build`; Next.js 16.3.2 compiled, typechecked, generated 26 routes, and identified `ƒ Proxy (Middleware)`. First sandbox attempt hit TypeScript worker `spawn EPERM`; permitted local rerun passed. No deployment occurred. |
| API Jest | **PASS** | `pnpm --filter api test -- --runInBand`; 18 suites, 171 tests passed. Expected error logs came from negative-path tests. |
| Read-only inventory diagnostic fixture | **PASS** | Ran `50_inventory_reconciliation_readonly_test.sql` in disposable local PostgreSQL. All assertions passed; fixture ended with `ROLLBACK`. No balances were changed. |
| Migration, transactional dispensing, RLS, and concurrency SQL | **PASS, local only** | `apps/api/supabase/tests/run-migration-tests.sh` on PostgreSQL 18.1 at `127.0.0.1:55439`, using disposable `pharmacy_migration_test`. All migrations applied and the documented idempotent migrations reran; migration, concurrency, returns/dispensing and dispensing concurrency suites passed. |
| Production database / Supabase / live RLS | **NOT TESTED** | No remote database or Supabase project was contacted. |
| Physical label output | **NOT TESTED** | No printer, driver, label roll, or pharmacy workstation was available/used. |

The database tests ran on a newly initialized, isolated PostgreSQL cluster created for this task, not the already-running machine-wide PostgreSQL service. It was bound to loopback on port 55439. The test harness completed successfully. The local cluster is disposable; its results do not prove remote migration state or real inventory accuracy.

## Inventory integrity findings

### Diagnostic coverage

The read-only diagnostic compares `products.stock_quantity` with the sum of `product_batches.quantity_available`, flags products with positive stock and no batches, negative product/batch values, product/batch divergence, expiry and quarantine quantities, undated batches, receipt-to-batch differences, and inventory movement arithmetic/sequence anomalies. It also compares receipt lines with linked stock-received movement references and surfaces unbatched dispense movement evidence.

The synthetic fixture confirmed detection of:

- Product aggregate/batch total mismatch and batch total exceeding aggregate total.
- Positive aggregate stock with no batch rows.
- Negative product balances and negative movement balances.
- Expired-by-date and quarantined batches.
- Receipt line versus linked stock movement quantity mismatch.
- Unbatched legacy-style dispense movements.
- Movement arithmetic mismatch and product-level continuity gap.

**Interpretation limit:** the query diagnoses recorded data; it cannot prove physical counts, complete history, or that a positive unallocated difference is a valid opening balance. It labels that case as a candidate with an unknown baseline. A discrepancy is not automatically repaired, and a movement sum is not a reliable opening-to-current roll-forward unless the full opening balance and complete movement history are independently established. Batch negative values are also guarded by database constraints in the tested schema, but the diagnostic remains useful for legacy imports or altered constraints.

### Transactional dispensing results

The local migration suite passed normal dispensing, insufficient eligible stock, FEFO allocation, rejection of expired/quarantined/undated stock, no-stock-change on rejected dispensing, idempotent retry, and stock movement arithmetic. The concurrency scripts showed a same-key retry returned one prescription/result and deducted once; competing requests for final stock allowed one successful operation and left nonnegative stock with a balanced ledger. SQL tests also verified restricted function/table permissions and RLS enabled on public tables in the disposable database.

Database exceptions and explicit SQL failures exercised rollback paths. This does not simulate machine loss, storage corruption, or a network partition at every commit boundary. API tests include mocked database/network failures and legacy compensation failures; those demonstrate error handling but do not make the legacy multi-request writes atomic.

**Current mode/cutover:** configuration still defaults to `legacy`; only `PRESCRIPTION_WRITE_MODE=transactional` selects the RPC. No live configuration was changed. Legacy mode decrements aggregate product stock but does not decrement batch balances. The transactional procedure operates on batches and is not safe to enable against unreconciled live balances. Keep it disabled until a physical count, record reconciliation, staged acceptance, and pharmacist authorization are complete.

## Security findings

- The API authenticates Supabase bearer tokens and applies route role guards where declared. API authorization, not the web navigation guard, is the security boundary for protected data.
- Prescription creation/dispensing routes currently require authentication but do not all carry a pharmacist/dispensing-specific role guard. The local SQL permissions constrain direct table/function access, but cannot decide the pharmacy’s clinical role policy. Owner and pharmacist must define eligible roles and verify active user assignments before staging sign-off.
- The API uses a service-role Supabase client, which bypasses RLS. Therefore RLS does not provide tenant isolation for API calls. There is no organization/branch membership model or tenant-scoped query contract yet. Do not host multiple pharmacies in one shared data plane until tenant identity is enforced for every route, query, and RPC and tested with cross-tenant denial cases.
- SQL tests verified local grants/RLS behavior only. Live policies, Auth, CORS, TLS, secret rotation, rate limits, monitoring, backup configuration, log redaction, and restore procedures remain unverified.
- No production or staging credentials were read, rotated, changed, or recorded.

## Next.js middleware → proxy

Installed Next.js is 16.3.2. Its current documentation deprecates the `middleware` convention in v16 and uses a root-level `proxy.ts` with an exported `proxy` function. The local migration is appropriate and completed: it preserves the cookie-presence redirect behavior and the existing matcher exclusions for `/api`, Next static/image assets, and favicon. The production build recognizes `ƒ Proxy`; regression tests verify unauthenticated protected-route redirect, login access, cookie-bearing login redirect, authenticated navigation, and matcher configuration. [Next.js Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

The proxy intentionally remains a presence-only navigation guard. It does not validate or refresh a Supabase session and does not authorize roles. API token validation and route role checks remain in the API. Login/logout server actions and API authentication were reviewed but not exercised end-to-end against Supabase. The matcher still excludes API paths; API endpoints must continue enforcing authentication themselves. This change removes the Next.js middleware deprecation without weakening authentication.

## Staging readiness matrix

| Gate | Status | What remains / evidence required |
|---|---|---|
| Local migration syntax, rerun/idempotency, and SQL behavior | **PASS** | Passed on disposable PostgreSQL only. |
| Apply/verify migrations on Supabase staging | **NOT TESTED** | Requires owner-approved staging access, backup/restore point, migration review and an approved change window. Verify migration ledger, grants, RLS, RPC privileges, and app/schema compatibility. |
| Supabase authentication and session flow | **NOT TESTED** | Requires staging project/users and approved test credentials. Exercise login/logout, expired/revoked tokens, API bearer validation and session behavior. |
| Role authorization and actual user assignments | **BLOCKED** | Owner/pharmacist must define dispense authority and roles; then test allowed and denied actions for each assigned user. |
| RLS and tenant isolation | **BLOCKED** | Local SQL RLS checks passed, but there is no tenant schema yet and service-role API calls bypass RLS. Live staging check requires an approved environment; commercial multi-tenant use requires a designed tenant enforcement layer first. |
| Prescription persistence and transactional dispense in staging | **BLOCKED** | Requires staging migrations, synthetic pharmacy fixtures, approved role policy, pharmacist-approved allocation rules, failure/retry scenarios, and verified rollback. Do not switch production mode. |
| Inventory consistency | **BLOCKED** | Local diagnostic works; live counts and historical ledger completeness are unknown. Requires exported/backup snapshot and pharmacist-led physical count/reconciliation. No automatic adjustments. |
| Web/API connectivity | **NOT TESTED** | Build and API unit tests pass locally; staging DNS/TLS/CORS, Supabase Auth/PostgREST and deployed API/web compatibility need project access. |
| Backup and restore | **NOT TESTED** | Requires owner-authorized staging backup and isolated restore drill; verify auth/config provisioning, data integrity, elapsed time and runbook. |
| Security configuration / credential rotation | **NOT TESTED** | Owner/control-plane verification required for secret rotation, secret scope, environment separation, grants, TLS/CORS, rate limits, redacted logs and alerts. Never include secret values in evidence. |
| SMS gateway | **NOT TESTED** | Mock/unit checks only; live sending requires owner approval, consent/opt-out controls, rate limits and approved test recipients. |
| Physical label printing | **BLOCKED** | Requires target printer model/driver, 70×50 mm label roll, target workstation/browser, pharmacist wording/readability approval and recorded signed results. |

No remote resource was created or modified. The project is not staging-verified.

## Physical label printer acceptance required

The current implementation targets 70×50 mm and uses browser print. PDF/browser layout evidence does not certify paper output. On the exact supported printer, driver, operating system, browser and label stock, record printer/driver/stock identifiers, date, scale/margin settings, measured output, photo/evidence reference, operator and pharmacist sign-off. Run and record pass/fail for:

1. Sinhala instructions and patient/product text, including glyph shaping, diacritics, line breaks and readability at normal viewing distance.
2. English instructions and mixed Sinhala/English content.
3. Long medicine and patient names, maximum approved dosage/instruction text, and the exact current overflow/fit-block cases; verify blocked output cannot silently clip or produce an incomplete label.
4. Single-label and multi-label jobs, ordering, page breaks, duplicate/retry behavior and feed registration.
5. Dosage rows, frequency, duration, STAT/follow-up wording, quantity and explicit quantity entry; compare all printed content to the saved preview/record.
6. Expiry date formatting, date correctness, contrast, cut-off and legibility.
7. 100% scale, no unintended margins, actual 70×50 mm dimensions, top/side offsets, die-cut alignment, rotation, darkness and repeat-feed drift.
8. Paper-out/jam/cancel/reprint behavior and operator procedure. Browser dialog invocation must not be recorded as proof the printer produced a label.

Any unreadable clinical text, wrong patient/medicine/dose/quantity/expiry, clipped content, misalignment outside approved tolerance, or ambiguous fit-block response is a failed acceptance requiring correction and retest. No printer case was physically run in this verification.

## Required human decisions and approvals

### Owner / operations

- Approve staging project, backup/restore test window, migration application, credential rotation verification, pilot site/branch scope, and who may administer accounts.
- Define supported staff roles and user assignment/revocation; approve who may dispense, release quarantine, adjust stock, void/refund, and approve discounts.
- Confirm no-production-change guardrails and named rollback/escalation owner.

### Pharmacist

- Approve FEFO and eligible-batch policy, expiry-day interpretation, treatment of undated/opening/unbatched stock, partial fills, and handling of quarantined/returned stock.
- Review physical inventory counts and sign off each discrepancy disposition. No opening balances or corrected quantities may be invented from the diagnostic.
- Approve prescription-to-dispensing authority, label wording/language, quantity requirements, fit-block escalation, readable minimum type, and physical label test results.
- Authorize transactional dispensing in staging only after reconciliation evidence and tests are reviewed. A separate approval/cutover plan is required before any production mode change.

### Accountant / tax advisor

- Before POS implementation: decide currency and rounding, tax-inclusive/exclusive pricing, discount treatment, receipt versus statutory tax invoice, invoice numbering scope/gap behavior, required snapshots/retention, and return/credit-note accounting.
- This verification made no tax or accounting determination.

## POS prerequisite design review (no implementation)

The reviewed POS design is directionally strong and covers most required architectural elements. It remains a proposal; the listed database objects, routes and UI do not exist.

| Concern | Assessment | Unresolved decision / design hardening before coding |
|---|---|---|
| Organization/branch authorization | **Partial** | Membership/branch model is proposed, but DB-enforced same-tenant FKs/policies, service-role/RPC tenant context, membership revocation, backfill and cross-tenant query inventory need concrete design and tests. |
| Product unit conversion | **Covered conceptually** | Positive immutable conversion snapshots and base-unit stock deduction are proposed. Decide fractional sale units, pack/barcode mapping, conversion precision, rounding, and product-specific dispensing/sale units. |
| Batch allocation | **Covered conceptually** | FEFO, deterministic locks, expiry/quarantine exclusions and allocation snapshots are proposed. Decide undated/opening stock, existing aggregate/batch reconciliation, expiry timezone boundary, reservations and insufficient-stock behavior. |
| Atomic checkout | **Covered conceptually** | One transaction/RPC is proposed for sale, payment/tender, invoice, stock, ledger and links. Define transaction isolation, retryable SQL states, lock order across shared products, and prove no partial invoice/sequence artifacts under rollback. |
| Idempotency | **Covered conceptually** | Scoped key and canonical request hash are proposed. Specify retention/expiry, hash canonicalization, concurrent claim/unique conflict semantics, and stable replay response. |
| Cash payment records | **Partial** | Cash-only tender is scoped, but amount received vs amount applied/change, over-tender policy, drawer change source, and shift reconciliation need owner/accountant decisions. |
| Invoice numbering | **Partial** | Uniqueness and immutable snapshot are proposed. Legal/business scope, sequence gaps on rollback, timezone/business date and statutory document distinction require accountant/tax advisor approval. |
| Prescription integration | **Partial** | Sale item link is proposed. Define partial fill, one prescription item across multiple sale lines, repeat dispensing, who approves prescription-only status and duplicate fulfillment constraints. |
| Label integration | **Partial** | Print from persisted dispense/sale snapshots is specified, but exact sale-item/dispense-item/print-job foreign keys and migration from `prescription_events` require schema decision. Reprint must not deduct stock. |
| Returns/refunds | **Partial** | Linked return/refund and separate restock decision are proposed. Define payment reversal, partial return caps, patient-return quarantine, authorization, tax/credit note and audit semantics. |
| Audit logging | **Partial** | Actor, inventory movements, and print attempts are covered. Define append-only events for sale state, price override, discount approval, tender/refund and invoice reprint, plus tamper/access policy. |
| Tenant isolation | **Not ready** | Current product has no tenant model and API service-role access bypasses RLS. Tenant schema, DB enforcement and exhaustive cross-tenant negative tests must precede shared-tenant sales. |
| Thermal printing | **Covered conceptually** | 58/80 mm and A4 snapshots plus browser dialog limitations are covered. Select supported models and define content/width/driver matrix, hardware acceptance and whether a local bridge is required. |

Do not add sales tables, APIs, checkout UI, or invoice migrations until the owner/pharmacist/accountant decisions and tenant authorization prerequisite are resolved.

## Release gates and final status

| Gate | Status |
|---|---|
| Local web lint, tests, production build and API tests | **PASS** |
| Local read-only reconciliation fixture coverage | **PASS** |
| Local migration/transactional dispensing, rollback, idempotency and concurrency suite | **PASS** |
| No production/remote database modifications or deployment in this work | **PASS** |
| Live product/batch/ledger reconciliation and physical count | **BLOCKED** |
| Pharmacist-approved dispensing, FEFO and label policy | **BLOCKED** |
| Dispensing role assignment and staging authorization | **BLOCKED** |
| Supabase staging migration, auth, RLS and API compatibility | **NOT TESTED** |
| Backup/restore and security configuration verification | **NOT TESTED** |
| Physical label printer acceptance | **BLOCKED** |
| Tenant/branch-safe authorization foundation for POS | **BLOCKED** |
| Accountant-approved invoice/tax/tender rules | **BLOCKED** |
| **Phase 2/POS readiness** | **NOT READY** |

The mandatory data-safety, clinical, authorization, staging and physical-printer gates are not satisfied. The local test passes establish useful technical evidence, but they do not authorize a production cutover or POS development. Stop here pending the listed approvals and staging evidence.
