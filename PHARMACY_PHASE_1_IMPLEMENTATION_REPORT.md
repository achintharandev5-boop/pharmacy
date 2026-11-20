# Pharmacy Phase 1 Implementation Report

**Date:** 19 October 2026  
**Branch:** `codex/phase1-safety-fixes`  
**Scope:** Phase 1 only: independently verify the audit's P0 findings, implement safe local fixes, run local checks, and stop before production or data-affecting operations.

## Summary

One low-risk, locally verifiable P0 issue was fixed: prescription labels no longer imply or silently submit a default quantity of one. The quantity now displays as unset, the workstation blocks moving to review until each label has an explicit positive quantity, and both save paths recheck the requirement. The payload no longer substitutes `1` for a missing value.

The stock/batch divergence is verified in the current code and remains unresolved. It cannot be safely repaired or cut over without physical stock reconciliation and pharmacist approval. The API's authentication guards and database access design were reviewed; no authentication code was changed because dispensing-role policy and existing user-role assignments require owner/pharmacist decisions. Remote migration status and physical printing remain unverified.

**Phase 1 is not complete for staging or production.** Local code changes and tests passed, but the stated phase gate requires safe staging verification and resolution of the stock-integrity issue. No production database, migration, inventory record, credential, printer, SMS gateway or deployment was changed or accessed.

## Starting state and safety boundaries

- The implementation prompt required a dedicated development branch. Created `codex/phase1-safety-fixes` from the existing `feature/ui-ux-redesign` branch. Existing tracked and untracked workspace changes were preserved; this branch therefore includes the pre-existing in-progress work in the shared working tree.
- The repository already had numerous uncommitted changes before this phase. They were not reverted, staged, or committed.
- No migration was added or applied. No production or remote database was contacted. Database and SQL test harnesses were not run.
- Existing architecture and label behavior were preserved apart from quantity entry/validation.

## Independent verification of P0 findings

### Inventory consistency and dispensing modes

**Verified:** the default mode is `legacy`; only the exact configuration value `transactional` selects the SQL RPC path (`apps/api/src/config/env.validation.ts:22-23,57-59`; `apps/api/src/prescriptions/prescriptions.service.ts:68-104`). In legacy mode the prescription service decrements `products.stock_quantity` using a compare-and-update and writes movement rows, but does not update `product_batches.quantity_available` (`prescriptions.service.ts:451-489`). This matches the open F1 finding in `docs/STAGING_READINESS_REPORT.md`.

**Transactional path reviewed:** `create_prescription` locks selected products, allocates from eligible dated batches in FEFO order, excludes expired/quarantined batches, updates the product total and writes movement rows in one PostgreSQL function transaction (`apps/api/supabase/migrations/20261010000500_returns_quarantine_dispensing.sql:446-623`). It checks idempotency under an advisory transaction lock. The code and SQL test files are present, and previous staging documentation records local concurrency/SQL results; those database tests were not rerun for this phase.

**Safety decision:** do not turn on transactional mode against live data. Existing batch counts are known to have drifted under the legacy path. A physical count, reconciliation plan, pharmacist approval of eligible stock/FEFO rules, and staging test are prerequisites. A code-only patch cannot reliably infer which stale batches still physically exist.

### Label printing and quantity safety

The current label page saves before invoking `window.print()` and writes a print event afterwards (`apps/web/app/label/page.tsx:145-180`). The print template declares a 70 × 50 mm page (`apps/web/components/PrintableLabel.tsx:329-331`). Existing print documentation explicitly limits evidence to Edge/PDF output and lists the required physical printer checklist (`docs/PRINT_LAYOUT_AND_STAT_OPTIONS.md:8-9`). Thus physical printing, printer errors, and actual label-feed alignment remain unverified.

The workstation state initialized quantity to `null`, but the toolbar displayed `1`, and the request payload previously used `label.productQuantity || 1`. This allowed an operator to save/dispense a quantity they had not explicitly entered. That behavior is now fixed as described below. No changes were made to label wording, sizing, dosage calculations, STAT behavior, or overflow decisions because those require physical testing and/or pharmacist review.

### Authentication, authorization, RLS, and data access

- `AuthGuard` is globally registered and verifies bearer tokens with Supabase Auth; errors fail closed (`apps/api/src/app.module.ts:12-37`, `apps/api/src/auth/auth.guard.ts:24-76`). `RolesGuard` enforces metadata where `@Roles` is declared (`apps/api/src/auth/roles.guard.ts:8-27`).
- The Next.js middleware checks for the presence of an access-token cookie, not its validity; API calls still pass through API token verification (`apps/web/middleware.ts:4-20`). A stale cookie can therefore render a shell before protected data/API calls fail. The middleware convention also emits a Next.js 16 deprecation warning during build. No session redesign was attempted in this phase.
- The API uses a server-side Supabase service-role client (`apps/api/src/supabase/supabase.service.ts:16-28`), which bypasses RLS. The RLS migration restricts direct `anon`/`authenticated` database access, while specifically allowing service-role bypass (`apps/api/supabase/migrations/20261010000400_row_level_security.sql:1-44`). This is not tenant isolation: there is no organization/branch schema or tenant scoping in the current data model.
- Prescription create/print routes require authentication but have no `@Roles` restriction (`apps/api/src/prescriptions/prescriptions.controller.ts:10-43`). The role model explicitly says users without a recognized role can use the workstation and read records, while selected stock-changing routes require roles (`apps/api/src/auth/roles.ts:1-21`). This means an authenticated no-role account can create a completed prescription and trigger dispensing. Prior readiness notes mark tightening this as an owner decision after roles are assigned. It is a **P0 policy decision**: owner/pharmacist must decide which role may dispense, and all active accounts need confirmed role assignments before enforcement. I did not change it to avoid locking out existing pharmacy users or deciding clinical authority on the owner's behalf.
- Validation uses Nest's global `ValidationPipe` with `whitelist: true` (`apps/api/src/main.ts:8-25`); prescription DTO fields have validators and service-level stock/business checks. The API unit tests include failure and authorization cases. No live Supabase Auth/JWT or remote RLS verification was performed.

## Implementation completed

| File | Change |
|---|---|
| `apps/web/components/label/ProductToolbar.tsx` | Shows an em dash when quantity is unset; labels quantity as required; disables decrement until a quantity exists; incrementing from unset explicitly selects one. |
| `apps/web/app/label/page.tsx` | Blocks review if any label lacks an explicit positive quantity; rechecks before save and print-and-save; removes the `|| 1` payload fallback. |
| `apps/web/lib/labelQuantity.ts` | Adds a small pure guard that identifies the first label missing a valid positive quantity. |
| `apps/web/lib/labelQuantity.test.ts` | Tests missing, positive, and empty-list cases. |
| `apps/web/components/label/ProductToolbar.test.tsx` | Tests that unset quantity is displayed as unset and that only an explicit increment sets it to one. |
| `PHARMACY_SAAS_FULL_AUDIT_AND_ROADMAP.md` | Marks the quantity fallback finding as resolved locally and points to this phase report. |

The API already requires `quantity` in `CreatePrescriptionItemDto` and validates it as positive; stocked product dispensing additionally requires whole units in `PrescriptionsService`. Missing frontend quantity is now omitted from the payload and blocked in the UI before it reaches that API validation.

## Phase 1 fixes required but not performed

| Item | Status | Why it remains open |
|---|---|---|
| Reconcile aggregate product quantities against batch records | BLOCKED pending physical count | Legacy dispensing caused batch drift. No source of truth for actual batch quantities can be inferred from code or historical records alone. |
| Enable transactional dispensing | NOT ENABLED | Requires reconciled batch data and pharmacist approval. Configuration remains `legacy` by default. |
| Decide role required for prescription creation/dispensing | OWNER/PHARMACIST DECISION REQUIRED | Existing no-role accounts can dispense; enforcement could lock out real users and policy must establish clinical authority. |
| Verify remote migrations, RLS, API compatibility, and credentials | UNVERIFIED | No staging project/control-plane state was accessed. Supplied staging report says migrations and credential rotation remain open. |
| Physical label printer acceptance | UNVERIFIED | Requires the pharmacy's printer, driver, stock and pharmacist review; PDF tests do not prove physical output. |
| Session shell behavior and Next middleware deprecation | DEFERRED | API security is the enforcement boundary; changing session validation/navigation requires a focused UX/auth follow-up and deployment review. |

## Verification results

| Check | Result |
|---|---|
| Web Vitest | **Passed:** 21 test files, 355 tests, including the new quantity tests. |
| API Jest | **Passed:** 18 suites, 171 tests. |
| Web production build | **Passed:** Next.js 16.3.2 compiled, TypeScript completed, and 26 routes generated. Existing warning: `middleware` convention is deprecated in favor of `proxy`. |
| Targeted ESLint on new helper/toolbar and their tests | **Passed:** no diagnostics. |
| Full web ESLint | **Resolved in Phase 1 continuation:** zero errors and zero warnings. The 23 errors and 7 warnings present at continuation start were all pre-existing to the quantity fix. |
| API DB/SQL tests | **Not run:** require local PostgreSQL; no DB harness was started. |
| Staging/production database or RLS | **Not run:** no remote database accessed. |
| Physical printer | **Not run:** no printer connected/authorized. |

## Completion gate and next action

The low-risk quantity fix is implemented and locally verified. Phase 1's full completion gate is **not met**: batch stock consistency still requires physical reconciliation and pharmacist approval, and no safe staging environment was verified. No Phase 2 POS work was started.

Next authorized Phase 1 work should be: establish/verify an isolated staging project, apply only approved additive migrations there, confirm auth and RLS behavior, physically count and reconcile inventory with a pharmacist, decide dispensing roles and FEFO policy, then exercise the transactional path and label workflow in staging. Stop before any production cutover until those checks and the physical printer acceptance are signed off.

## Phase 1 continuation update — 19 October 2026

### Lint analysis and resolution

At continuation start, full web ESLint reported 23 errors and 7 warnings. All findings were in existing application/test files and were present before the explicit-quantity fix; no lint finding originated in `labelQuantity.ts` or the quantity-validation tests. Root causes were untyped API/action boundaries (`any`), untyped customer/product/label records, effects that synchronously mirrored store values into component state, unescaped quote characters in JSX, one mutable local declared with `let`, and unused imports/parameters. The one effect dependency warning was addressed by making the confirmation handler stable with `useCallback` and listing it as a dependency.

The fixes use existing domain/store types or narrow local response types. Search inputs now derive their displayed text from the Zustand store, which already receives every edit and selection; a failed barcode lookup clears the temporary manual product entry that had been visually cleared before but remained in store state. No clinical quantities, dosage calculations, instruction wording, authorization policy, stock mutation path or quantity default was changed. SMS gateway responses remain runtime data and are consumed through a typed response shape; unknown thrown values are narrowed before reading a message.

Full ESLint now passes with **0 errors and 0 warnings**. No lint rule was disabled or broadened.

### Diagnostic-by-diagnostic record (all findings were pre-existing)

The start-of-continuation baseline had 23 errors and 7 warnings. The quantity-fix files introduced none of them. Each item below was resolved locally without disabling a rule.

| # | File / finding | Root cause | Resolution |
|---:|---|---|---|
| 1 | `apps/web/app/actions/labels.ts` — `data: any` | Untyped server-action payload | Reused the existing `ApiData` boundary type |
| 2 | `apps/web/app/actions/sms.ts` — `Record<string, any>` payload | Untyped provider request object | Added a narrow Text.lk request type |
| 3 | `apps/web/app/actions/sms.ts` — `catch (error: any)` | Assumed thrown values are `Error` | Catch `unknown`, narrow with `instanceof Error` |
| 4 | `apps/web/app/label/page.tsx` — `useState<any>` | Print-builder result not represented by a type | Use `BuiltLabelData[] | null` |
| 5 | `apps/web/components/CustomerSearchInput.tsx` — synchronous setState in effect | Local input duplicated the customer name already stored in Zustand | Derive controlled input text from store state |
| 6–7 | `CustomerSearchInput.tsx` — two unescaped quote diagnostics | Literal quotation marks in JSX text | Use `&quot;` entities |
| 8 | `CustomerSearchPanel.tsx` — `any[]` results | API response had an existing customer domain type that was not used | Use `CustomerData[]` |
| 9 | `PrintableLabel.tsx` — `LabelCard` prop `any` | Builder output had no public shape | Type with `BuiltLabelData` |
| 10 | `PrintableLabel.tsx` — `data: any` | Same untyped print boundary | Accept one or many `BuiltLabelData` values |
| 11 | `PrintableLabel.tsx` — map callback `any` | Callback type was inherited from the untyped boundary | Infer callback type from the union |
| 12 | `ProductSearchInput.tsx` — synchronous setState in effect | Search text duplicated the selected product name | Derive visible value from selected product; clear the temporary manual product after a 404 barcode lookup |
| 13–14 | `ProductSearchInput.tsx` — two unescaped quote diagnostics | Literal quotation marks in JSX text | Use `&quot;` entities |
| 15 | `LabelActionPage.tsx` — `catch (err: any)` | Assumed thrown values are `Error` | Catch `unknown`, narrow before displaying a message |
| 16 | `oabInstructions.ts` — `Record<..., any>` | Four configuration entries have two distinct shapes | Model the string-versus-timing-map union and narrow by category |
| 17 | `labelBuilder.ts` — `buildFinalInstruction(state: any)` | Input mixes persisted label state and display-only aliases | Define `LabelBuildState` from the store shape plus explicit optional aliases |
| 18 | `labelBuilder.ts` — output `any` | Dynamically extended result had no contract | Define `BuiltLabelData` while keeping empty instruction output omitted as before |
| 19 | `labelBuilder.ts` — `dosageOut: any` | Three known dose rows were untyped | Use a partial record keyed by morning/lunch/night |
| 20 | `labelBuilder.ts` — `prefer-const` | Summary parts array is mutated but never rebound | Change `let` to `const` |
| 21 | `labelBuilder.ts` — `currentCustomerName(state: any)` | Same untyped builder input | Reuse `LabelBuildState` |
| 22 | `labelStore.ts` — `productInfoData: any` | Popup data did not have a store contract | Add `ProductInfoData` |
| 23 | `labelStore.ts` — `openProductInfoPopup(data: any)` | Setter was not tied to its stored data type | Accept `ProductInfoData` |
| W1 | `DaysOfWeekPanel.tsx` — unused map index | Callback did not use index | Remove parameter |
| W2 | `ReasonsPanel.tsx` — unused `MessageSquare` import | Leftover import | Remove import |
| W3 | `DosageRow.test.tsx` — unused `fireEvent` import | Test uses `userEvent` instead | Remove import |
| W4 | `NumberPad.test.tsx` — unused `fireEvent` import | Test uses `userEvent` instead | Remove import |
| W5 | `ProductInfoPopup.tsx` — missing `handleConfirm` dependency | Listener effect closed over a recreated handler | Memoize handler with `useCallback`; depend on it |
| W6 | `LabelActionPage.tsx` — unused `User` import | Leftover icon import | Remove import |
| W7 | `oabLogic.test.ts` — unused `INSTRUCTION_CONFIG` import | Test did not reference the imported constant | Remove import |

### Inventory and staging deliverables

- Added `PHARMACY_INVENTORY_RECONCILIATION_PLAN.md` with read-only balance interpretation, a physical count/review process, staging tests and a gated transition plan.
- Added `apps/api/supabase/diagnostics/inventory_reconciliation_readonly.sql`, containing SELECT-only comparisons for product totals, batches, movements and GRN references.
- Added `apps/api/supabase/tests/50_inventory_reconciliation_readonly_test.sql`; all fixture writes are to connection-local temporary tables in a transaction that rolls back. The SQL fixture suite was not run because a disposable local PostgreSQL harness was not available in this continuation.
- Added `PHARMACY_STAGING_VERIFICATION_CHECKLIST.md` with migration, auth/role, RLS, prescription, inventory, backup/restore, security and physical label acceptance gates.
- Added `PHARMACY_POS_TECHNICAL_DESIGN.md` as design-only preparation. No POS schema, route, UI, migration or checkout code was added.

### Additional local lint fixes

| File | Change |
|---|---|
| `apps/web/app/actions/labels.ts`, `apps/web/app/actions/sms.ts` | Replace broad `any` inputs/payload/catch values with the existing API data type and narrow Text.lk request/response/error types. |
| `apps/web/app/label/page.tsx`, `apps/web/components/PrintableLabel.tsx`, `apps/web/lib/labelBuilder.ts` | Type the built label state/output and remove label `any` use while preserving omitted empty instruction fields. |
| `apps/web/components/CustomerSearchInput.tsx`, `apps/web/components/ProductSearchInput.tsx` | Remove synchronous state-setting effects; derive displayed values from store state; escape quoted JSX text. |
| `apps/web/components/CustomerSearchPanel.tsx`, `apps/web/store/labelStore.ts` | Type customer search results and product information popup data. |
| `apps/web/components/ProductInfoPopup.tsx` | Stabilize the event handler and use it as the effect dependency. |
| `apps/web/components/label/LabelActionPage.tsx`, `apps/web/constants/oabInstructions.ts` | Narrow caught errors and type the instruction configuration union. |
| `apps/web/app/label/DaysOfWeekPanel.tsx`, `apps/web/app/label/ReasonsPanel.tsx`, `apps/web/components/DosageRow.test.tsx`, `apps/web/components/NumberPad.test.tsx`, `apps/web/lib/oabLogic.test.ts` | Remove unused map parameter/imports. |
| `apps/web/lib/labelBuilder.test.ts`, `apps/web/components/PrintedInterval.test.tsx` | Align test input/assertion types with existing builder behavior; no assertion intent changed. |

### Updated verification and remaining warning

- Full web ESLint: **passed**, zero errors and zero warnings.
- Full web Vitest: **passed**, 21 files / 355 tests.
- Web production build: **passed**, TypeScript completed and 26 routes generated.
- API Jest results remain the previously reported 18 suites / 171 tests; API source and behavior were not changed in this continuation.
- SQL diagnostic fixture test: **not run**; local disposable PostgreSQL harness unavailable. No remote database was contacted.
- Physical printer and staging checklist: **not run**; no staging project or printer was accessed.

Next.js build emits one framework warning: the `middleware` file convention is deprecated in favor of `proxy`. It is not a lint warning. Migrating the session/navigation boundary can affect routing and auth UX, so it was not mixed into these type/lint cleanups; handle it as a separate change with dedicated session and route tests. There are no remaining ESLint warnings that need an exception.

### Current completion and readiness

**Phase 1 status: PARTIALLY COMPLETE — local safety fixes and static readiness materials are complete; operational acceptance remains open.** The explicit medicine quantity fix is preserved. No database writes, migrations, credential changes, deployment, production access, physical print, pharmacist decision or transactional mode switch occurred.

**Phase 2 readiness: DESIGN PREPARATION ONLY / NOT READY TO IMPLEMENT.** The POS design is documented, but implementation is gated on tenant/branch authorization, real staging migration/RLS/auth checks, witnessed stock reconciliation, pharmacist-approved dispensing/FEFO and prescription policy, accountant-approved price/tax/invoice rules, and owner approval. Required approvals are listed in the inventory, staging and POS documents.
