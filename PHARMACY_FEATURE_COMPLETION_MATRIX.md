# Pharmacy Label SaaS — Feature Completion Matrix

**Date:** 2026-10-30 · **Code state:** working tree of `codex/phase1-safety-fixes` (HEAD `e3c15e4` + uncommitted work)
**Evidence levels used below:**

| Level | Meaning |
|---|---|
| **Code** | The code path exists and was read in this audit |
| **Unit** | Automated tests pass in this audit's run (web 1994/1994, API 253/253) |
| **Local-DB** | Verified against a local PostgreSQL in an earlier report (cited); **not re-run** in this audit |
| **Staging** | Verified on a staging Supabase project. **None exists yet: NOT VERIFIED for every feature** |
| **Physical** | Verified on the pharmacy's printer. **NOT VERIFIED for every feature** |

## 1. Scoring method

For every module, each capability listed in the audit brief is scored **1** (implemented end to end: UI + API + DB where relevant), **0.5** (partial: missing a layer, behind a switch, or with a material limitation) or **0** (missing). The module's **implementation %** is the mean of its capabilities. Capabilities that do not apply to this product (e.g. "stock transfers, if specified": not specified) are excluded and listed.

The overall **implementation %** is the mean of module scores weighted by importance for a pharmacy-label pilot:

| Weight | Modules |
|---|---|
| ×3 | Label Workstation, Printing |
| ×2 | Prescriptions, Inventory, Authentication, Security, Database |
| ×1 | Dashboard, Patients, Products, Admin, Reporting, Testing, Deployment |
| ×1 | POS (planned module: weight 1 so its absence is visible without dominating) |

Implementation % is **not** readiness. Readiness columns are scored separately (§3).

## 2. Module scores

| Module | Capabilities (score) | Impl. % |
|---|---|---|
| **A. Authentication & users** | login 1, logout 1, password handling (Supabase) 1, password reset **0**, user creation **0** (CLI script only), roles 0.5 (assigned by `scripts/set-user-role.js`), admin permissions 1, pharmacist permissions 1, session management 0.5 (≈1 h cookie, presence-only proxy check), refresh tokens **0**, pharmacy-level restriction **0**, deactivation **0** (Supabase console only), audit logs 0.5 (triggers; actor missing for API writes) | **50%** (6.5/13) |
| **B. Dashboard** | metrics 1, prescription analytics 1, inventory stats 1, sales stats **0** (no POS), low-stock 1, expiry 1, recent activity 1, charts 1, date filter 0.5 (presets only), real API 1, empty states 1, loading/error 1 | **88%** (10.5/12) |
| **C. Label Workstation** | all 31 listed capabilities implemented (patient, medicine, alternative, qty, multiple labels, selected instructions, dosage, fractions, administration, Reasons, Days, Name of Days, Daily, Weekly, Evening, EOD, STAT, 5H/6H/8H, With Food, Empty Stomach, Chewable, Dissolve and Drink, Keep in Mouth, Expiry, preview, review, Print-only, Save, Print & Save, error handling, keyboard/touch). **Clinical wording approval pending** for several combinations (P0-07): scored in readiness, not here | **100%** (31/31) |
| **D. Prescriptions** | create 1, view 1, search 1, history 1, edit restrictions 1 (immutable by design), cancel/void **0**, reprint 1, patient association 1, medicine association 1, quantity records 1, inventory deduction 0.5 (product total; batch FEFO off), audit history 0.5, transaction consistency 0.5 (compensating rollback by default) | **81%** (10.5/13) |
| **E. Patients** | registration 1, search 1, profile 1, prescription history 1, contact info 0.5 (no edit endpoint), duplicate handling **0**, validation 1, privacy 0.5 (role-less users can list all), pharmacy isolation **0** | **67%** (6/9) |
| **F. Products** | create 1, edit 1, categories 1, product types 1, brand/generic 1, barcode search 1, status (`is_active`) 1, validation 1, units 1, product-type printing 1, duplicate handling 1 (unique barcode, 23505 mapped) | **100%** (11/11) |
| **G. Inventory** | overview 1, receiving 1, GRN 1, batches 1, expiry 1, adjustments 1, low-stock 1, expired handling (quarantine) 1, suppliers 1, reconciliation 0.5 (read-only SQL + SOP, no UI), movement history 1, audit trail 0.5. *Excluded: transfers (not specified)* | **92%** (11/12) |
| **H. POS** | product search, cart, quantity, pricing, discounts, tax, checkout, payments, invoices, receipts, returns/refunds, inventory integration, cashier permissions, history: **all 0**. Design document only (`PHARMACY_POS_TECHNICAL_DESIGN.md`: "No POS schema, route, UI, migration or checkout code was implemented") | **0%** (0/14) |
| **I. Admin & settings** | pharmacy profile **0** (B6), configuration 0.5 (env), user management **0**, Reasons catalogue 1, label configuration 0.5, printer configuration **0**, catalogue settings 0.5, inventory settings 0.5 (per-product thresholds), permissions 0.5 (fixed roles, read-only display), system settings 0.5 (status card), audit-log viewer **0** | **36%** (4/11) |
| **J. Reporting** | prescription reports 0.5, inventory reports 1, stock-movement 1, expiry 1, sales **0**, financial **0**, export **0**, date filters 0.5, pharmacy isolation **0** | **44%** (4/9) |
| **K. Printing** | 70 × 50 mm 1, print CSS 1, Sinhala fonts 0.5 (runtime Google Fonts), overflow 1 (blocks rather than truncates), alignment 1, scaling 1, expiry placement 1, names 1, Print-only 1, Print & Save 1, reprint 1, failure recovery 0.5, invoice printing **0** (POS). *Physical printer: verification, not implementation (§3)* | **85%** (11/13) |
| **Security** (cross-cutting) | authN fail-closed 1, role checks 0.5 (gaps P0-04), RLS deny-all for anon 1, tenant isolation **0**, secrets out of git 1, rotation **0**, input validation 1, filter sanitising 1, rate limiting **0**, security headers **0**, UI-test isolation 1, audit integrity 0.5 | **58%** (7/12) |
| **Database** | schema/FKs 1, constraints 1, indexes 1, RLS 1, transactional functions 1 (off by default), migration ordering 1, migration tests 1 (local), tenant columns **0**, backup/restore 0.5 (procedure, no drill), retention 0.5 | **80%** (8/10) |
| **Testing** | web unit 1, API unit 1, DB/migration tests 1 (exist; not re-run), E2E **0**, CI **0**, lint clean 0.5 (web clean; API 784 problems) | **58%** (3.5/6) |
| **Deployment** | build 1, env validation 1, runbook/checklists 1, staging environment **0**, monitoring **0**, backups **0** | **50%** (3/6) |

### Weighted overall implementation

| Module | Impl. % | Weight | Weighted |
|---|---|---|---|
| Label Workstation | 100 | 3 | 300 |
| Printing | 85 | 3 | 254 |
| Prescriptions | 81 | 2 | 162 |
| Inventory | 92 | 2 | 183 |
| Authentication | 50 | 2 | 100 |
| Security | 58 | 2 | 117 |
| Database | 80 | 2 | 160 |
| Dashboard | 88 | 1 | 88 |
| Patients | 67 | 1 | 67 |
| Products | 100 | 1 | 100 |
| Admin | 36 | 1 | 36 |
| Reporting | 44 | 1 | 44 |
| Testing | 58 | 1 | 58 |
| Deployment | 50 | 1 | 50 |
| POS | 0 | 1 | 0 |
| **Total** | | **24** | **1,719 → 71.6%** |

**Feature implementation ≈ 72% (weighted).** Without POS (a planned, separate product line), the score is 1,719 / 23 = **74.7%**. The unweighted mean of the 15 module scores is 65.9%.

## 3. Readiness by module (separate from implementation)

| Module | Implemented | Locally verified | Staging ready | Production ready |
|---|---|---|---|---|
| Label Workstation | Yes | **Yes** (unit, live UI-test mode) | NOT VERIFIED | **No**: wording sign-off (P0-07) |
| Printing | Yes | Browser print only | NOT VERIFIED | **No**: physical print (P0-08) |
| Prescriptions | Mostly | Yes (unit; Local-DB in the 2026-10-10 report) | NOT VERIFIED | **No**: batch dispensing (P0-06), void (P1-04) |
| Inventory | Mostly | Yes (unit; Local-DB 2026-10-10) | NOT VERIFIED | **No**: reconciliation (D3) |
| Authentication | Partial | Yes (unit) | NOT VERIFIED | **No**: sessions (P0-09), roles (P0-04) |
| Patients | Partial | Yes (unit) | NOT VERIFIED | **No**: privacy (P0-04), edit (P1-03) |
| Products | Yes | Yes (unit) | NOT VERIFIED | Pending staging |
| Dashboard | Mostly | Unit only (UI-test mode has no data) | NOT VERIFIED | Pending staging |
| Admin | Partial | Unit | NOT VERIFIED | **No**: users, settings |
| Reporting | Partial | Unit | NOT VERIFIED | Pending P2-01 |
| POS | No | — | — | — |

## 4. Features #1–#22 (label workstation)

Report files are numbered two behind the feature numbers (`PHARMACY_FEATURE_19_REASONS_REPORT.md` is Feature #21, `…_20_ADD_EXPIRY_DATE…` is #22); report 01 covers #1–#3.

| # | Feature | Status | Frontend | Backend | Database | Tests (this run) | Dependencies | Blockers | Next action |
|---|---|---|---|---|---|---|---|---|---|
| 1–3 | Dosage quantity controls (+/−, number pad, X/Y fractions) | Complete (local) | Yes (`DosagePanel.tsx`, `NumberPad.tsx`) | Saved in `prescription_items` | Integrated | Pass (`DosageQuantityControls`, `DosageRow`, `NumberPad`, `DigitalLabel`) | — | Wording A16 for single periods | Pharmacist A16 |
| 4 | Automatic product type selection | Complete (local) | Yes | `product_type` column | Integrated | Pass (`ProductTypeSelection` 14/14) | Product catalogue | — | Staging check |
| 5 | Product-type printing | Complete (local) | Yes (`lib/productTypePrinting.ts`) | — | — | Pass (`ProductTypePrinting`) | #4 | Units list A11 | Pharmacist A11 |
| 6 | Chewing (SAM) | Complete (local) | Yes | stored codes | Integrated | Pass (`ChewingSam`) | #11 | Wording A2 (හපලා/සපලා) | Pharmacist A2 |
| 7 | Dissolve and Drink | Complete (local) | Yes | ✓ | ✓ | Pass (`DissolveSam`) | #11 | — | Physical print |
| 8 | With Food | Complete (local) | Yes | ✓ | ✓ | Pass (`WithFood`) | #11 | A4, A5 | Pharmacist |
| 9 | Keep in Mouth | Complete (local) | Yes | ✓ | ✓ | Pass (`KeepInMouth`) | #11 | A3 (prints English today) | Pharmacist A3 |
| 10 | Empty Stomach | Complete (local) | Yes | ✓ | ✓ | Pass (`EmptyStomach`) | #11 | — | Physical print |
| 11 | USB: Take/Give, Before/After | Complete (local) | Yes (`LabelActions.tsx`) | ✓ | ✓ | Pass (`UsbAdministration`) | — | A1 word order | Pharmacist A1 |
| 12 | EOD | Complete (local) | Yes | ✓ | ✓ | Pass (`Eod`) | — | — | Physical print |
| 13 | STAT | Complete (local); spec wording behind switch | Yes (STAT panels) | ✓ | ✓ | Pass (`StatWorkflow`, `StatFlow`, `StatWorkstation`) | #11 | S2, A12, A14 | Pharmacist S2/A14 |
| 14 | Intervals 5H/6H/8H | Complete (local) | Yes | ✓ | ✓ | Pass (`Intervals`, `PrintedInterval`) | — | A6 lock rule | Pharmacist A6 |
| 15 | Digital label (Morning/Lunch/Night) | Complete (local) | Yes | ✓ | ✓ | Pass (`DigitalLabel`) | #1–3 | A9, A15, A16 | Pharmacist |
| 16 | Evening / four times | Complete (local) | Yes | ✓ | ✓ | Pass (`Evening`) | — | A10 (හවසට/සවසට) | Pharmacist A10 |
| 17 | Daily | Complete (local) | Yes | ✓ (`daily-label.spec.ts`) | ✓ | Pass (`Daily`) | — | A10 (දිනකට/දිනපතා) | Pharmacist A10 |
| 18 | Weekly | Complete (local) | Yes | ✓ (`weekly-label.spec.ts`) | ✓ | Pass (`Weekly`) | — | — | Physical print |
| 19 | Name of Days | Complete (local) | Yes (`DaysOfWeekPanel.tsx`) | ✓ | ✓ | Pass (`NameOfDays`, `DayActions`) | — | — | Physical print |
| 20 | Till to the Day | Complete (local) | Yes | ✓ (`weekday-range.spec.ts`) | ✓ | Pass (`TillToDay`) | #19 | "Till Date prints English" (approvals doc) | Pharmacist |
| **21** | **Reasons catalogue** | **Partial: locally implemented, staging pending** | Yes (`ReasonsPanel`, `/admin/reasons`) | Yes (`reasons.*`, `historical-wording.spec.ts`) | Migration `20261025000100` **not applied to staging** | Pass (`Reasons`, `ReasonCatalogueLoader`, API `reasons.spec`) | P0-05 | Staging migration + verification (`docs/FEATURE_21_DATABASE_VERIFICATION.md`) | Run the verification doc on staging |
| **22** | **Add Expiry Date (GRN batch)** | **Partial: locally implemented, staging pending** | Yes (`ExpDateModal`, Expiry card) | Yes (`GET /inventory/dispensing-batches`) | Depends on batches from migration `…000500` | Pass (`AddExpiryDate`, `expiryFinal`, `LockedActions`) | P0-05, P0-06 | Batch quantities not reconciled (D3); dispensing not batch-level (D1) | Staging + reconciliation |
| — | ENT (eye/ear/nose) | Kept; moved from the grid to the Administration card (approved during the 2026-10-29 audit); historical ENT data still printable (`lib/labelBuilder.ts:68`) | Yes | ✓ (`instructions_json.ent`) | ✓ | Pass (`EntPanel`) | — | — | — |

**No feature is production-ready.** All 22 are implemented locally with passing unit tests; none has staging or physical-print evidence.
