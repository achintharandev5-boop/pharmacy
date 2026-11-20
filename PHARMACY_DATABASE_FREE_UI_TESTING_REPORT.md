# Pharmacy System — Database-Free UI Testing Report

Date: 25 October 2026

## Architecture audit

The frontend is Next.js 16 App Router with React 19, server actions, a shared server-side API adapter and a Zustand label store. Next.js `proxy.ts` protects navigation. Real authentication uses an HTTP-only `sb-access-token` cookie and the NestJS API. Backend identity/authorization remain the API's responsibility.

The previous development demo redirected every route to `/demo`, which contained invented inventory, counts and activity. That route now redirects to the actual dashboard. The old UI_DEMO_MODE configuration is no longer used.

Dashboard, catalogue, patient records, prescriptions, inventory, analytics, record detail pages and health checks depend on API responses. Most use `lib/api/server.ts`; legacy label creation and external SMS used direct fetch calls. All those network entry points are now blocked centrally or explicitly in UI testing mode. No frontend Supabase client was found. The application still loads its existing Google-hosted Sinhala fonts; font availability is separate from backend availability.

The real label workstation's selection, dosage controls, Sinhala generation, review cards and layout are local. Product typing already supported a manual name. It now clearly identifies manual test-product entry and skips catalogue lookup in UI testing mode. No Sinhala instruction, label dimensions, store selection rule or database schema was changed.

## How to run

From the repository root in PowerShell:

```powershell
$env:NEXT_PUBLIC_UI_TEST_MODE='true'
pnpm --dir apps/web dev
```

Open http://localhost:3002/login and use:

- Email: `tester@pharmacy.local`
- Password: `Test@12345`
- Role: local Admin / UI Tester

Optional server-only `UI_TEST_EMAIL` and `UI_TEST_PASSWORD` override the defaults. Restart the frontend after changing environment configuration. No API process, Supabase configuration or database is required. For normal development, set the flag to `false` and restart. Production builds must use `false` or leave it unset.

## Session and production safeguards

The local login sets a separate HTTP-only, SameSite Strict browser-session cookie. It issues no JWT and never sends test credentials to the real API. Refresh and navigation retain the session; logout deletes it. Real authentication cookies do not grant a local test session. Local test cookies do not grant normal or production access. The reserved test account is rejected before the normal authentication fetch path when testing is disabled.

Both runtime mode detection and navigation reject local authentication in production. `next.config.ts` also rejects production builds with the flag enabled. The API adapter returns an explicit unavailable result for reads and an explicit not-saved result for writes before reading or forwarding a real token. Legacy label writes and external SMS are blocked separately. NestJS authentication is unchanged.

## Accessible pages and interactions

The actual home, dashboard, label workstation, patients, prescriptions, products, inventory and its existing subpages, analytics and settings are accessible through the existing routes and navigation. There is no seeded catalogue, patient, inventory, prescription or transaction database. Detail routes can be opened but cannot populate a record without the backend.

Existing search, filters, forms, validation, menus, tabs, modals, sidebar controls and responsive CSS remain available where their screens expose them without record prerequisites. Read-dependent content displays unavailable/empty states. Summary metrics display a missing value with “No data loaded”, rather than verified zero counts. Some record-dependent operations cannot be reached without first loading a real record; no fictional records were added to unlock them.

The existing workstation remains intact, including completed SAM, ENT, quantity, product-type, STAT, EOD, interval, daily, weekly and day-name workflows. A user-entered manual medicine name supports local label interaction testing. Existing product-type controls remain available. Review displays the actual Sinhala label cards. Print layout preview follows existing review and final-action validation, waits for fonts and layout, checks label fit, and invokes the browser print dialog without saving or logging a print. It does not clear the label draft. Save attempts report that nothing was saved.

A small global indicator identifies UI testing. Reset UI Test Session restores the initial Zustand state and reloads the dashboard, clearing component-local form, search, navigation and modal state while retaining login. Logout ends the local login. No local record database or persistent fictional records are created. A full page refresh can discard local label/form changes; only login continuity is retained.

## Files changed for this task

- `apps/web/lib/uiTestMode.ts`: shared flag, separate cookie constants and honest unavailable messages.
- `apps/web/next.config.ts`: production-build rejection.
- `apps/web/proxy.ts`: isolated local route guard; real guard retained when disabled.
- `apps/web/app/actions/auth.ts`: local login/logout/identity and reserved-account isolation.
- `apps/web/app/login/page.tsx`, `LoginForm.tsx`: local login instructions using the existing form.
- `apps/web/lib/api/server.ts`: centralized backend read/write blocking.
- `apps/web/app/actions/labels.ts`, `sms.ts`: block remaining direct network writes.
- `apps/web/app/actions/system.ts`: report SMS as unavailable in testing mode.
- `apps/web/app/demo/page.tsx`: remove fictional dashboard route content.
- `apps/web/app/admin/page.tsx`: actual dashboard tester wording and unavailable status.
- `apps/web/components/ui/States.tsx`, `Page.tsx`: shared honest empty states and missing metrics.
- `apps/web/components/ProductSearchInput.tsx`: labeled manual test input without lookup traffic.
- `apps/web/components/UiTestControls.tsx`, `app/layout.tsx`: global indicator, reset and logout.
- `apps/web/app/label/page.tsx`, `components/label/LabelActionPage.tsx`: guarded local print-layout preview and accurate action label.
- `apps/web/.env.example`: opt-in environment documentation.
- `apps/web/lib/uiTestMode.test.ts`, `uiTestProxy.test.ts`, `components/UiTesting.test.tsx`, `app/admin/page.test.tsx`, `app/label/page.test.tsx`: regression coverage.
- This report.

Existing uncommitted work was preserved. These are task edits, not ownership of the entire working-tree diff.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest, limited to two workers | 47 files, 1,612 tests passed |
| Additional final print-preview boundary test | 1 passed; no prescription or print-log write |
| New local-mode focused tests | 24 passed; dashboard test also passed in full suite |
| Web TypeScript (`tsc --noEmit`) | Passed |
| Web ESLint | Passed, no findings |
| Production build, UI test mode disabled | Passed |
| Production build, UI test mode enabled | Correctly rejected with explicit configuration error |
| Relevant API Jest (products service, product type, prescriptions service) | 3 suites, 57 tests passed |
| `git diff --check` | Passed; Windows line-ending warnings only |

The first unconstrained web run overlapped the production build and hit two 5-second STAT test timeouts (1,595 other tests passed). The full two-worker rerun passed without changing those tests or their timeouts. Vitest and production builds needed execution outside the sandbox because sandboxed worker spawning failed with EPERM. API tests used their existing in-memory harness; simulated error logs are expected. The reset component test invokes browser reload, which jsdom reports as unsupported navigation; its state-clear assertion passes. No real backend was used.

Coverage includes local valid/invalid login, logout, repeated-request session continuity, production/normal-mode cookie isolation, all main route permissions, blocked reads and writes even with a real token present, legacy label and SMS blocking, honest dashboard/empty states, manual product entry, reset, existing shell navigation, full Sinhala/label regressions and the local print-preview boundary. Browser cookie lifecycle and responsive visual appearance were not exercised in a real browser.

## Remaining limitations

Database persistence, real catalogue search, record detail loading, stock movements, receiving, dispensing, prescription submission, analytics totals, SMS delivery and production identity require real services. They are unavailable rather than simulated successful operations.

Automated DOM tests do not prove physical printer alignment, real font rendering or visual quality on desktop/tablet/mobile devices. Existing responsive styles and theme behavior were preserved; device and printer acceptance remain manual checks. No live database, deployment, commit or push was performed. No further pharmacy business feature was implemented.
