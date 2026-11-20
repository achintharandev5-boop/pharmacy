# Pharmacy Label SaaS — UI/UX Full System Audit

**Date:** 2026-10-30 · **Type:** read-only (no UI modified)
**Method:**

- **Static inspection** of every `page.tsx` and its components, covering state handling (`QueryView` / skeleton / empty / error), validation, responsive classes and table overflow.
- **Live measurement** in headless Edge against the existing local UI-test dev server (port 3002, backend calls disabled). Each page was measured for horizontal overflow, named controls, controls under 24 px and 44 px, unlabeled inputs and headings. Screens are in UI-test mode, so **data-bearing states (tables with rows, charts with values) are NOT VERIFIED**: pages show their loading, empty or "unavailable" states.
- **Prior evidence** for the label workstation: `PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md` (2026-10-30, another session) and `PHARMACY_LABEL_WORKSTATION_UI_UX_REMEDIATION_REPORT.md`, with screenshots in `docs/ui-audit/`.

**Environment caveat:**

- The dev server was slow (≈ 5 s per HTML response) during the audit.
- Its render worker crashed once ("Jest worker encountered 2 child process exceptions", Next.js dev overlay) while loading detail pages with an unknown id. This is a dev-server resource failure, not an application defect; those three detail pages are **NOT VERIFIED**.

---

## 1. Summary

| Area | Score /10 | Evidence |
|---|---|---|
| Label workstation | **8** | Latest redesign report §10 (category mean 8.2); 0 overflow / 0 clipping at six sizes; locked-action explanations; 56–76 px primary controls |
| Admin shell & navigation | **7.5** | Grouped sidebar (Workspace / Records / Stock / Insights / System), breadcrumbs, inventory tabs, skip link (`AppShell.tsx:243`), mobile drawer (`AppShell.tsx:234`), notifications from real alerts |
| Admin list pages | **7** | Shared `QueryView` + `DataTable` with loading/empty/error states; tables scroll and hide secondary columns on mobile (`components/ui/DataTable.tsx:45,57`); controls mostly 36–40 px |
| Admin forms (receiving, adjustments, returns, patients) | **7** | Validation present (`aria-invalid`/field errors 3–8 per form); receiving is the most complex form (324 lines) |
| Settings & Reasons admin | **5.5** | Settings is mostly read-only information; Reasons admin bypasses the shared state components |
| Accessibility (system) | **7** | Every measured control is named; focus rings global (`globals.css`); duplicate `<h1>` on every admin page; touch targets under 44 px on admin pages |
| Responsive (system) | **6.5** | 0 px horizontal overflow on the 7 pages measured at 1366 px; admin tablet/phone **NOT VERIFIED**; structural support (drawer, scrolling tables) present; workstation verified at six sizes by the redesign report |
| **Overall UI/UX** | **7 / 10** | Workstation is touch-first; the admin area is a solid mouse-first back office |

---

## 2. Screen-by-screen scorecard

Columns:

- **States**: loading / empty / error handled via shared components.
- **Forms**: validation feedback.
- **≥44**: share of controls at least 44 × 44 px (touch guidance; 24 px is the WCAG 2.2 AA minimum).
- **Score**: 1–10 for that screen.

| Route | Purpose | States | Forms | Controls (measured @1366) | Notes | Score |
|---|---|---|---|---|---|---|
| `/` | Home chooser | — | — | 6; 3 under 44 px; 2 under 24 px (UI-test banner links) | Clear "Where would you like to start?" | 7.5 |
| `/login` | Sign-in | inline error | ✓ | see §4 | No password reset ("ask the administrator") | 6.5 |
| `/admin` | Dashboard | ✓ (16 query/skeleton uses) | — | 38; 31 under 44 px | KPI cards, charts with 7/30/90-day presets; no sales KPIs (no POS) | 7.5 |
| `/admin/analytics` | Prescription analytics | ✓ | — | 22; 21 under 44 px | Presets only; no export | 6.5 |
| `/admin/prescriptions` | List/search | ✓ | — | 25; 23 under 44 px | No void/cancel action anywhere | 6.5 |
| `/admin/prescriptions/[id]` | Detail + reprint | ✓ | — | NOT VERIFIED (dev worker crash) | Reprint exists | — |
| `/admin/patients` | List + add | ✓ | ✓ | 21; 19 under 44 px | **No edit**; add only | 6.5 |
| `/admin/patients/[id]` | Profile + history + delete | ✓ | — | NOT VERIFIED (dev worker crash) | Hard delete with confirmation | — |
| `/admin/products` | Medicines | ✓ | ✓ (dialog) | 26; 23 under 44 px | Create/edit via `ProductDialog` | 7.5 |
| `/admin/products/[id]` | Medicine detail + movements | ✓ | — | NOT VERIFIED (dev worker crash) | | — |
| `/admin/labels` | Label history | ✓ | — | 22; 21 under 44 px | | 7 |
| `/admin/reasons` | Reasons catalogue CRUD | own `useEffect` state; no shared loading/empty states | basic | see §4 | Outside the design system's state components; no responsive classes | 5.5 |
| `/admin/settings` | Status, account, roles, label info, pharmacy details | ✓ | — | see §4 | Mostly read-only: "Pharmacy name, address and phone cannot be edited here yet"; roles assigned by CLI script | 5 |
| `/admin/inventory` | Overview | ✓ | — | see §4 | Tabbed sub-navigation | 7.5 |
| `/admin/inventory/batches` | Batches, quarantine/release | ✓ | — | see §4 | | 7 |
| `/admin/inventory/receiving` | GRN | ✓ | ✓ (8 validation sites) | see §4 | Role notice shown ("Requires the pharmacist or administrator role") | 7.5 |
| `/admin/inventory/adjustments` | Adjustments | partial (2 query, 0 empty) | ✓ | see §4 | | 7 |
| `/admin/inventory/movements` | Ledger | ✓ | — | see §4 | | 7 |
| `/admin/inventory/expiry` | Expiry matrix | ✓ | — | see §4 | | 7 |
| `/admin/inventory/low-stock` | Low stock | ✓ | — | see §4 | | 7 |
| `/admin/inventory/returns` | Patient returns, disposal | ✓ | ✓ | see §4 | Never restocks (D4) | 7 |
| `/admin/inventory/analytics` | Stock analytics | ✓ | — | see §4 | | 6.5 |
| `/admin/inventory/suppliers`, `/[id]` | Suppliers | ✓ | ✓ | see §4 | | 7 |
| `/label` | Label workstation | own error alerts | ✓ (DONE guards) | 56–76 px primary controls (redesign report §6) | Strongest screen; see §5 | 8 |
| `/label/print-check` | Print layout check | — | — | — | Developer/QA tool for the 70 × 50 mm layout | 6 |
| `/inventory`, `/demo`, `/admin/inventory/products[/id]` | Redirects | — | — | — | Legacy addresses kept as redirects | n/a |

**Unfinished or nonfunctional elements found:**

1. Settings "Pharmacy details" is read-only, with an explicit "cannot be edited here yet".
2. Global header search routes by guess: phone-like → patients, `rx…` → prescriptions, **anything else → medicines**, so a patient's name opens the medicines list (`components/shell/AppShell.tsx:201-212`).
3. No void/cancel on prescriptions; no edit on patients.
4. No export buttons anywhere.
5. No user-management screen.

A systematic dead-button check (activating every control with real data) was **not performed**: NOT VERIFIED. Controls on the workstation are covered by its tests (`ActionWorkspace.test.tsx` exercises all 21 actions).

---

## 3. Cross-cutting findings

| # | Severity | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| U-1 | Medium | **Two `<h1>` per admin page**: the shell title and the page title | `AppShell.tsx:280` plus `PageHeader`; measured h1 lists e.g. `["Patients","Patients"]` | Make the shell title a non-heading |
| U-2 | Medium | Admin touch targets mostly **36–40 px** (`Button` md = `h-10`, `components/ui/Button.tsx:22`); 19–31 controls per page under 44 px | Live measurement | Use `lg` buttons and 44 px rows on touch devices (`pointer: coarse`) |
| U-3 | Medium | Global search misroutes names to medicines | `AppShell.tsx:206` | Search all three, or let the user choose |
| U-4 | Medium | Settings and Reasons pages are below the design system's standard (read-only data, custom state handling) | `app/admin/settings/page.tsx`, `app/admin/reasons/page.tsx` | Rebuild on `QueryView`/`Form` when P1-05/P1-07 land |
| U-5 | Low | UI-test banner links are under 24 px (test mode only) | Measurement (2 per page) | Enlarge or ignore (not shipped) |
| U-6 | Low | Sinhala renders as boxes in headless captures (web font not loaded headless) | Redesign report §9.3 | Confirm on real hardware; self-host fonts (P1-09) |
| U-7 | Info | No mock data in any screen; errors never replaced with sample data | `app/actions/admin.ts:6`, `inventory.ts:6`; search for mock/placeholder | — |

**Accessibility positives:**
- Every measured control has an accessible name (0 unnamed), and every measured input has a label (0 unlabeled).
- A global `:focus-visible` outline is set (`app/globals.css`), and there is a skip link.
- Reduced motion is respected.
- Live regions are used for the workstation's status and lock messages.

**Manual screen-reader testing: NOT VERIFIED.**

---

## 4. Responsive behaviour

**1366 × 768:** 0 px horizontal overflow on every measured page.

**768 × 1024 and 390 × 844, admin pages: NOT VERIFIED in this audit.** The sweep was stopped before reaching these sizes, because the shared dev server was taking 10–60 s per page and its render worker had crashed once. Continuing would have loaded a server other sessions use. Phone-size screenshots of 11 admin pages were captured in a first, timed-out pass, but their measurements were not saved, so no claim is made from them. The label workstation's six-viewport results come from `PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md`.

Structural evidence:
- The shell collapses to a drawer.
- `DataTable` scrolls horizontally and hides columns marked `hideOnMobile` below `md`.
- Most admin pages use responsive grid classes (`sm:`/`md:`/`lg:`; 0–13 uses per page).
- Pages with **no** responsive classes: `inventory/expiry`, `inventory/low-stock`, `inventory/suppliers`, `labels`, `reasons`. Their tables still scroll, but their headers and filters do not adapt.

### 4.1 What was measured live (1366 × 768)

| Route | Overflow-x | Controls | < 24 px | < 44 px | Unnamed | Unlabeled inputs | `<h1>` |
|---|---|---|---|---|---|---|---|
| `/` | 0 | 6 | 2 | 3 | 0 | 0 | 1 |
| `/admin` | 0 | 38 | 6 | 31 | 0 | 0 | **2** |
| `/admin/analytics` | 0 | 22 | 3 | 21 | 0 | 0 | **2** |
| `/admin/prescriptions` | 0 | 25 | 3 | 23 | 0 | 0 | **2** |
| `/admin/patients` | 0 | 21 | 3 | 19 | 0 | 0 | **2** |
| `/admin/products` | 0 | 26 | 3 | 23 | 0 | 0 | **2** |
| `/admin/labels` | 0 | 22 | 3 | 21 | 0 | 0 | **2** |
| `/admin/prescriptions/[id]`, `/admin/patients/[id]`, `/admin/products/[id]` | — | — | — | — | — | — | NOT VERIFIED (dev worker crash) |

The < 24 px counts include the UI-test banner's two text links (test mode only); the rest were not itemised. The remaining admin routes were screenshotted at 1366 px but not measured; three of these screenshots (dashboard, receiving, settings) were reviewed and show the shared shell captured mid-load (skeletons). Measurements for the other routes are NOT VERIFIED.

---

## 5. Label workstation (summary of current evidence)

Independent re-measurement in this audit was limited to the subset sweep. The latest full evidence is `PHARMACY_TOUCH_FIRST_UI_REDESIGN_REPORT.md`:

- 1994/1994 tests at the time;
- 0 overflow and 0 clipped text at six viewports;
- primary controls 56–76 px;
- chip remove 44 px;
- the toolbar is responsive (resolving the earlier blocked item).

Remaining items from that report:
- 10–11 px captions;
- 56 px dosage controls between 1024 and 1279 px;
- no pharmacist usability session or manual screen-reader pass;
- the duplicate EXP Date control kept.

**ENT** remains reachable as the fifth Administration button (approved decision), and historical ENT labels still print.

---

## 6. Priorities

| Priority | Item | Roadmap link |
|---|---|---|
| P1 | Pharmacist usability session on real tills; manual NVDA pass | P2-04 |
| P1 | Settings: pharmacy details form; user management screen | P1-05, P1-07 |
| P2 | U-1 duplicate h1; U-2 coarse-pointer target sizes; U-3 search routing | P2-03 |
| P2 | Responsive headers and filters on the five pages without responsive classes | P2-03 |
| P2 | Export buttons on list pages | P2-01 |
| P3 | Reasons admin on shared state components | P2-03 |
