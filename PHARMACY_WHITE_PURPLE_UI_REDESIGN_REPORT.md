# White & Purple UI Redesign — Route-by-Route Completion Report

Date: 2026-11-04 · Branch: `codex/phase1-safety-fixes` (uncommitted, on top of existing uncommitted work)

**Production status remains NO-GO.** This is a frontend visual and UX change only. Nothing was deployed.

## 1. Scope kept

No changes were made to backend code, the database, API contracts, authentication or authorization, prescription calculations, clinical wording (Sinhala or English), stock deduction, print eligibility, reprint logic, or the physical 70 × 50 mm label.

- **Physical label.** `PrintableLabel` sets its own fonts and colours. Tailwind's `--font-sans` token, which the label's address line and badges use, was deliberately left unchanged.
- **Label workstation colour coding.** This is unchanged; see §3.
- **Data honesty.** Every KPI and chart is still bound to the existing API calls. Nothing is fabricated, and an unknown value still shows "—", never 0.

## 2. What changed

| Area | Files | Change |
|---|---|---|
| Design tokens | `apps/web/app/theme.css`, `apps/web/app/globals.css` | New palette: purple `#7C5CE7` / `#6243C8`, soft `#EDE7FF`, tint `#F5F2FF`, canvas `#F8F7FC`, text `#17152B`, border `#E9E7F0`. Added a matching dark theme, a self-hosted Inter UI font (`--font-ui`), radii (8 px controls, 12 px cards), soft shadows, and a pastel chart palette (purple, mint, blue, amber). |
| Status colours | `theme.css` | The brief's hues `#16A085` / `#E6A23C` / `#E05269` are kept as `*-accent` tokens for icons, dots and charts. Text versions were darkened to `#0E7C67` / `#9A5F0A` / `#C33650` because the raw hues fail AA as text (amber is only 2.19:1 on white). |
| App shell | `components/shell/AppShell.tsx` | Sidebar is 256 px and collapses to 72 px. Grouped sections; active item has a soft-purple fill, a purple icon and a left indicator. Collapsed items show real tooltips and keep screen-reader labels. The collapse preference is remembered per browser. Topbar: page title, global search, stock alerts with a count badge and status dots, icon theme switcher, and an account menu with an initials avatar and role chip. Role filtering is unchanged. |
| Primitives | `components/ui/*` | Button (solid purple primary, tinted hovers), Card/CardHeader, PageHeader (26–28 px), StatTile (tone icon chip, 30 px figure), DataTable (uppercase compact headers, tinted row hover), pill StatusBadge with a dot, tabs and segmented control, inputs (3 px purple focus ring), empty states, and charts (per-bar colours by meaning). |
| Dashboard | `apps/web/app/admin/page.tsx` | Date in the header; a **Quick actions** row with five links to existing workflows; stock-status bars coloured by status. |
| Add dialogs | `admin/patients/page.tsx`, `admin/products/page.tsx` | `?new=1` opens the existing Add dialog. This is used by the quick actions only. |
| Workstation | `apps/web/app/label/layout.tsx` | `rx-workstation` colour scope added (see §3). The wrapper uses `display: contents`, so layout and print are unchanged. |
| Root, login, landing | `app/page.tsx`, `app/login/LoginForm.tsx`, `components/marketing/landing.module.css` | Canvas background and icon theme switcher on root and login. The landing page's green palette was remapped to purple. `/welcome` stays behind the proxy (not public), and no signup was added. |

## 3. Decision needing pharmacist sign-off: workstation colours

The workstation draws its "blue" instruction family (5H, 6H, 8H, Dissolve and Drink, ENT, the dose rows) with the **primary** colour tokens. Its "purple" family (Days, Name of Days, EOD, Empty Stomach) uses separate purple tokens. A purple brand primary would have made those two families nearly identical.

Inside `/label`, the primary tokens therefore keep their original blue values. The workstation adopts the new neutrals, borders, radii and canvas, but **its instruction colour coding is exactly as before.** Making the workstation purple would mean reassigning the instruction colour families, which is a clinical-readability change for the pharmacist to decide.

## 4. Verification evidence

The full session log is in the local scratchpad.

| Check | Baseline (before) | After |
|---|---|---|
| `tsc --noEmit` | pass | pass |
| ESLint | pass | pass |
| Logic tests (node) | 24 files, 435/435 | 24 files, 435/435 |
| Component tests (jsdom), including all clinical regression suites | 1,771/1,773 (2 timeouts in `StatWorkstation.test.tsx`; 5/5 when run alone, a pre-existing timing flake) | 54 files, **1,773/1,773** |
| Responsive audit (Playwright + Edge, UI-test mode): 28 routes × 375/430/768/1024/1440/1920 | — | **168/168 clean**: HTTP 200, no horizontal page overflow, no control outside the viewport, no console errors |
| Production build (`next build`, placeholder `.invalid` HTTPS API values passed to the command only) | — | **pass**, 34 routes |

Environment notes:
- The installed dependencies do not match the uncommitted `apps/web/package.json`. Installed: vitest 2.1.9 and Next 16.3.2 on Node 20.17. Declared: vitest 4.1.0, Next 16.4.3 and Node 22.
- Because of that, `pnpm test` fails at startup, so the suites were run as `vitest run --minWorkers=1 --maxWorkers=2 --environment {node|jsdom}`.
- `pnpm install` was not run, because it would rewrite the lockfile.
- Without real `API_URL` / `PILOT_API_URL` values, `next build` stops at the production API guard, which is intended.

**Limits of the evidence:**
- All browser checks ran in database-free UI-test mode. They prove the layout of loading, empty and error states and of the shell and forms, but **not populated tables or charts.**
- Accessibility evidence covers computed contrast for every text and border token, keyboard focus, labels and the existing accessibility tests. No axe scan or screen-reader pass was run.

## 5. Route matrix

Legend: COMPLETE / PARTIAL / BLOCKED / NOT VERIFIED. "Responsive PARTIAL" means it passed at all six widths without data, with populated data not verified. "A11y PARTIAL" means contrast and focus were verified but no axe or screen-reader audit was run.

| Route | Original functionality | UI redesign | Responsive | Accessibility | Regression tests | Remaining issues |
|---|---|---|---|---|---|---|
| `/` | Workspace chooser (cashier → POS) | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED (no route test) | — |
| `/login` | Sign-in (UI-test or Supabase) | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED (auth action tests only) | — |
| `/welcome` | Private pilot landing | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`LandingPage.test`) | Illustrative preview colours now purple; pilot copy unchanged |
| `/admin` | Operations dashboard | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`admin/page.test`) | Populated charts not seen in a browser |
| `/admin/patients` | Patient list, search, add | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`patients/page.test`, `PatientDialog.test`) | — |
| `/admin/patients/[id]` | Profile, edit, history, admin delete | COMPLETE | PARTIAL | PARTIAL | PARTIAL (dialog tests only) | Populated profile not seen |
| `/admin/prescriptions` | Prescription history, filters | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED (no route test) | — |
| `/admin/prescriptions/[id]` | Detail; reprint availability | COMPLETE | PARTIAL | PARTIAL | PARTIAL (reprint logic in `lib` tests) | — |
| `/admin/labels` | Label print history | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/products` | Medicine catalogue, filters, add | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`ProductDialog.test`) | — |
| `/admin/products/[id]` | Medicine detail, edit, batches | COMPLETE | PARTIAL | PARTIAL | PARTIAL | — |
| `/admin/inventory` | Stock overview and alerts | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/batches` | Batch list by status | COMPLETE | PARTIAL | PARTIAL | PARTIAL (`batchExpiry.test`) | — |
| `/admin/inventory/expiry` | Expiry matrix, write-off | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/low-stock` | Below-reorder list | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/movements` | Stock ledger | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/receiving` | Goods receiving (GRN) | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | Form only seen in its "could not load" state |
| `/admin/inventory/adjustments` | Stock adjustments | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/returns` | Patient returns | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/analytics` | Stock analytics | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/inventory/suppliers` | Supplier list, add | COMPLETE | PARTIAL | PARTIAL | PARTIAL (`suppliers.test` action) | — |
| `/admin/inventory/suppliers/[id]` | Supplier detail, edit | COMPLETE | PARTIAL | PARTIAL | PARTIAL | — |
| `/admin/analytics` | Prescription and dispensing analytics | COMPLETE | PARTIAL | PARTIAL | NOT VERIFIED | — |
| `/admin/reasons` | Reasons catalogue | COMPLETE | PARTIAL | PARTIAL | PARTIAL (`Reasons.test`) | — |
| `/admin/audit-log` | Admin-only audit viewer | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`audit-log/page.test`, including role gating) | — |
| `/admin/settings` | Pharmacy, label, printer, system settings | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`settings/page.test`, `SettingsLabelIsolation.test`) | — |
| `/label` | Prescription label workstation | PARTIAL | PARTIAL | PARTIAL | COMPLETE (all workstation, dosage, STAT, print-guard and label-layout suites) | Instruction colour coding intentionally unchanged (§3); a purple workstation needs pharmacist sign-off |
| `/label/print-check` | Dev-only print verification (404 in production) | COMPLETE (inherits) | PARTIAL | NOT VERIFIED | COMPLETE (`LabelPrintLayout.test`) | Developer aid |
| `/pos` | POS catalogue, cart, customer lookup (no checkout) | COMPLETE (inherits tokens) | PARTIAL | PARTIAL | COMPLETE (`PosWorkstation.test`, `cart.test`, `scanner.test`) | Checkout still pending accountant approval, as before |
| `/inventory`, `/demo`, `/admin/inventory/products`, `/admin/inventory/products/[id]` | Redirects only | n/a (no UI) | n/a | n/a | NOT VERIFIED in a browser (build compiles them) | — |
| App shell (all `/admin/*`) | Navigation, search, alerts, account | COMPLETE | PARTIAL | PARTIAL | COMPLETE (`AppShell.test`, `nav.test`; role-based visibility unchanged) | — |

## 6. Remaining work before calling the redesign done

1. **Populated-data visual pass.** Run against the local API with synthetic data and re-run the audit, to verify dense tables, charts and long medicine names.
2. **Accessibility tooling.** Run an axe scan on every route, plus a short screen-reader pass of the shell and the workstation.
3. **Workstation colour decision (§3).** Needs a pharmacist decision.
4. **Dependencies.** Reconcile installed dependencies with `package.json` (Node 22, vitest 4, Next 16.4.3) so that `pnpm test` runs as written.
5. **Reference images.** The seven reference images were not available in this session. The visual direction followed the written brief, so compare the result against those images.
