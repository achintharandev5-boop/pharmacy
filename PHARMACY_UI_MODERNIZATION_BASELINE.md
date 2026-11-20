# Pharmacy UI modernization baseline

Date: 2026-10-31. Branch: codex/phase1-safety-fixes. Source of truth: docs/PHARMACY_UI_REDESIGN_PROMPT.md (read completely).

## Safety and architecture

Extensive pre-existing modified/untracked work is preserved; full status and source SHA-256 snapshots are stored in docs/ui-modernization. No reset, commit, push, deployment, migration or database operation is authorized. Multiple Claude processes and a pharmacy Next dev server (port 3002) exist. Process command lines do not establish file ownership; asked user about concurrent edits. Recheck hashes immediately before modifications; skip any externally changed file.

Verified versions: Next 16.3.2, React 19.2.8, Tailwind 4, TypeScript 5, Zustand 5, Recharts 3, NestJS 11. pnpm monorepo. No second UI library required. Read local Next layout, client/server and CSS documentation as required by apps/web/AGENTS.md.

Existing UI library: Button/IconButton, Input/Select/Textarea/FormField, Card, Badge/StatusBadge, Alert/Toast, Dialog/ConfirmDialog, Tabs, DataTable/Pagination, PageHeader/SearchInput/StatTile and loading/error/empty states. Extend these components, not parallel replacements.

Current theme: light only; semantic Tailwind @theme variables exist but have no dark overrides. Numerous white/slate and literal hex utilities, especially workstation action panels and charts. Existing 8 px control/10 px card radii. Sidebar grouped by role, collapsed desktop state and mobile drawer already exist; drawer needs keyboard focus containment/Escape. Two h1 headings appear on admin screens. Dialog focus trap already exists. Admin controls mostly 32–40 px. Workstation/POS are already standalone.

Print: globals.css fixes @page and html/body to 70mm × 50mm with zero margins. PrintableLabel contains approved black/white physical layout and Sinhala fitting; preserve byte-for-byte. Existing Sinhala fonts loaded from Google; offline/physical printer acceptance remains NOT VERIFIED.

## Existing evidence and test baseline

Reviewed master plan, feature progress, module implementation, full integration, full UI audit, admin settings completion, POS milestone 1.5 and remaining-work reports. Older audit claims about absent patient edit/settings/audit viewer are superseded by source and latest module reports. Checkout remains blocked; patient server pagination/edit/duplicate warnings and settings conditional updates already exist. User management/password recovery are not implemented and will not be invented.

Prior reports: API 440/440 (32 suites); web 2,157/2,161 (73 files), four load-sensitive timeouts and a known POS duplicate-search unhandled rejection. These are historical results, not fresh verification. Current run results will be recorded separately. Tests must run sequentially with bounded workers; no DB integration tests. Database behaviour: NOT VERIFIED.

Baseline screenshots requested from existing database-free UI-test server using scripts/ui-baseline.cjs; screenshots show unavailable/empty states, not real patient records. Browser initially blocked by sandbox EPERM; escalated headless launch. Captured 11 baseline major-page screenshots before changes, plus 28 sample-label PNGs (14 scenarios in current/spec review wordings). Three referenced image attachments are not available in this conversation; use the written reference characteristics.

## Complete route inventory

All routes inherit root layout; admin routes additionally use AdminLayout/AppShell; label routes use role redirect layout. All are currently light-only. Risks are retained existing behaviour, not permission to modify it.

| Route | Module / phase | Layout | Shared components | Inconsistencies / accessibility | Regression risk |
|---|---|---|---|---|---|
| `/admin/analytics` | Reporting / management 2 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/audit-log` | Admin / management 3 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/inventory/adjustments` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/analytics` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/batches` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/expiry` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/low-stock` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/movements` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/products/[id]` | Products / operational 5 | Redirect | None | No visual surface | Stock/expiry/quarantine unchanged |
| `/admin/inventory/products` | Products / operational 5 | Redirect | None | No visual surface | Stock/expiry/quarantine unchanged |
| `/admin/inventory/receiving` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/returns` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/suppliers/[id]` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/inventory/suppliers` | Inventory / operational 6 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Stock/expiry/quarantine unchanged |
| `/admin/labels` | Prescriptions and label history / operational 4 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Historical wording, permissions and reprint behavior |
| `/admin` | Dashboard / management 1 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/patients/[id]` | Patients / operational 3 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/patients` | Patients / operational 3 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/prescriptions/[id]` | Prescriptions / operational 4 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/prescriptions` | Prescriptions / operational 4 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/products/[id]` | Products / operational 5 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/products` | Products / operational 5 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/reasons` | Admin / management 3 | Admin sidebar | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/admin/settings` | Admin / management 3 | Admin sidebar | Existing shared UI | Light only; review focus, mobile overflow and literals | Concurrency and read-only decisions |
| `/demo` | Auth and home / management 4 | Redirect | None | No visual surface | Validation, permissions, API states unchanged |
| `/inventory` | Inventory / operational 6 | Redirect | None | No visual surface | Stock/expiry/quarantine unchanged |
| `/label` | Label / operational 1 | Fullscreen task | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Clinical sequencing; print/save; 70 × 50mm |
| `/label/print-check` | Label / operational 1 | Fullscreen task | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Clinical sequencing; print/save; 70 × 50mm |
| `/login` | Auth and home / management 4 | Root standalone | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/` | Auth and home / management 4 | Root standalone | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Validation, permissions, API states unchanged |
| `/pos` | POS / operational 2 | Fullscreen task | Custom/delegated UI | Light only; review focus, mobile overflow and literals | Barcode/cart/roles; checkout disabled |
