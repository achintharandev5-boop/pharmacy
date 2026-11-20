# Pharmacy module UI redesign progress

Date: 2026-11-01. This matrix reports **UI completion separately from backend/feature completion**. It does not authorize or claim business-rule changes.

| Phase / module | UI status | Both themes | Responsive / keyboard evidence | Feature / backend status | Remaining verification |
|---|---|---|---|---|---|
| 0. Repository audit | Complete | N/A | Route inventory and existing shared components recorded in `PHARMACY_UI_MODERNIZATION_BASELINE.md` | Existing work preserved; no DB or auth changes | Interactive browser sweep is limited by the existing dev server client hydration issue |
| Foundation: tokens, controls, theme, shell | Implemented | Semantic light/dark/system CSS and pre-paint preference bootstrap | 40 contrast token pairs; six viewport sizes; drawer focus/Escape had a separate focused browser check; 20 scoped tests pass | Role filtering, authorization, session remain unchanged | On the current local server, React event hydration could not be confirmed during the final sweep |
| 1. Dashboard | UI styles and shared metrics/charts applied | Yes | Included in responsive route sweep | Existing API metrics, date ranges and calculations unchanged; data unavailable in no-DB mode | Data-backed metric states NOT VERIFIED against a database |
| 2. Label Workstation | UI modernization complete | Yes | 12 viewport/theme captures; 56 exact label pixel comparisons; print media measured 70×50mm in both themes; modal focus trap/Escape/return tested | Existing dosage, Sinhala instructions, sequencing, STAT, expiry, reasons, history and print/save semantics preserved | Real pharmacy workflow/backend NOT VERIFIED; physical printer NOT VERIFIED |
| 3. POS | UI modernization complete | Yes | 12 viewport/theme captures | Checkout remains disabled; search/barcode/cart/customer/stock presentation retained. Fixed a duplicate type-ahead request timer in the presentation search scheduling. | Live scanner and backend checkout intentionally NOT VERIFIED |
| 4. Patients | UI modernization complete | Yes | 12 viewport/theme captures; shared accessible forms/dialogs/tables | Pagination, edit, duplicate warning, validation, history and role behavior unchanged | Real patient data and DB operations NOT VERIFIED |
| 5. Prescriptions | UI modernization complete | Yes | 24 captures across list and label-history routes | Lifecycle, wording, history and reprint restrictions unchanged; no void or stock reversal added | Data-backed detail/history states NOT VERIFIED |
| 6. Products | UI modernization complete | Yes | 12 viewport/theme captures | Classification, barcode, pricing and validation behavior unchanged | DB-backed product changes NOT VERIFIED |
| 7. Inventory | UI modernization complete | Yes | 11 pages × 2 themes × 6 viewport sizes; no overflow/runtime errors | Stock deductions, batch rules, expiry, quarantine, authorization and readonly settings unchanged | DB receiving/adjustment/history NOT VERIFIED |
| 8. Reporting | Shared chart/table/filter styling applied | Yes | Dashboard/report routes included in browser sweep | Existing calculations and filters unchanged; no fake reports/data added | API-backed report data NOT VERIFIED |
| 9. Admin/settings/reasons | Shared shell/settings UI plus reason catalogue modernization | Yes | Included in final responsive sweep | Pending Q-S1/Q-S3/Q-S4 remain read-only; existing concurrency/write rules preserved | No database-backed settings operation tested |
| 10. Authentication | Login and home styling and theme selector applied | Yes | Included in final responsive sweep | Login/session/role logic unchanged; no recovery or demo auth added | Live auth NOT VERIFIED |

## Changed surface summary

Foundation changes are in `apps/web/app/theme.css`, root layout, `components/ui/*`, and `components/shell/AppShell.tsx`. Operational changes are limited to existing UI pages/components in `apps/web/app/admin`, label and POS components. Protected-file hash checks show all 174 baseline API, auth/authorization, clinical state/constants/actions and `PrintableLabel` source files unchanged. Some originally dirty UI files had no preserved byte preimage, so Sinhala-source comparison was unavailable for those files; label PNG regression comparisons provide separate output evidence.

## Verification summary

- Initial web baseline: 2160 tests across 73 files passed; later changes were covered by module suites and the final full run: 2165/2166 passed (73/74 files); the one ReviewPrintGuard timing failure passed 8/8 when rerun alone.
- API baseline regression: 440/440 across 32 suites. API source was not modified by this UI work.
- Relevant module suites: label 1591 plus 40 affected style assertions; POS 62; patients 17; prescriptions 24 source-specific visual captures and API baseline coverage; products 82; inventory 38; reasons 10/10; shell 9/9; theme 5/5.
- Label pixels: 28 sample labels matched baseline under each theme (56 comparisons).
- Browser captures: per-module route/viewport records are under `docs/ui-modernization/<phase>/`. Final application-wide sweep: 276 captures across 23 routes, both themes and six viewport sizes; zero overflow/errors, with 23 short network-idle warnings. Workstation dosage-control measurements show 11 controls at each viewport, every target at least 44px.
- Physical printing, online data, real pharmacy operations and production authentication are NOT VERIFIED.
