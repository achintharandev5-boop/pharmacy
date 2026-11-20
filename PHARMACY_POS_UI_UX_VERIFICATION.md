# Pharmacy POS — UI/UX Verification

**Date:** 2026-10-30 · **Scope:** `/pos` and role-aware navigation (Milestone 1.5)

## 1. Method

- **Build:** production build (`next build --webpack`) of a copy of `apps/web` in the session scratch directory, served by `next start` on `127.0.0.1:3105`. The shared `.next` and the running dev server (port 3002) were not touched. No `.env` file was copied.
- **Data:** a local mock API (`127.0.0.1:3191`) serving **synthetic** medicines and patients only. Tokens map to the cashier, staff, pharmacist and no-role accounts. No database, real patient or credential was used.
- **Browser:** Microsoft Edge (installed), headless, driven by `playwright-core` 1.48.2 installed in the scratch directory only (not a project dependency). Below 1024 px, contexts used touch emulation.
- **Script:** session scratch `browser/verify.cjs` (not added to the repository). Screenshots in `browser/shots/` were reviewed by eye.

## 2. Results: 141 / 141 checks passed (final run, after the fixes in §4)

Each of 390 × 844, 768 × 1024, 1024 × 768, 1366 × 768, 1440 × 900 and 1920 × 1080 passed all of the following:

| Check | Result |
|---|---|
| Search box focused on load | Pass |
| Name search shows price and sellable stock | Pass |
| Scan (typed digits + Enter) adds and clears the box | Pass |
| One scan with two Enter events (CR+LF) adds one unit | Pass |
| Rapid scans: repeat scan increments, new code adds | Pass |
| Unpriced and out-of-stock scans shown, not added | Pass |
| Unknown barcode message | Pass |
| Typing with no field focused lands in search | Pass |
| + quantity; subtotal LKR 350.00 for the scripted cart | Pass |
| Customer lookup refuses fewer than 7 digits; duplicate-name warning; masked number after selection | Pass |
| No horizontal overflow (page and customer dialog) | Pass (0 px at every size) |
| Touch targets under 44 × 44 px | **None** at any size |
| Below 1024 px: View cart bar visible and jumps to the cart | Pass |
| From 1024 px: cart beside results | Pass |
| Search error shows Retry | Pass |
| Cart restored after reload; customer **not** restored | Pass |
| F9 clears only after confirmation | Pass |
| Checkout placeholder visible; no Pay, Checkout or Invoice control | Pass |
| No uncaught page errors | Pass |

Role checks (1366 × 768):

| Check | Result |
|---|---|
| Cashier opening `/`, `/admin`, `/admin/patients`, `/label` lands on `/pos` | Pass (all four) |
| Cashier: no dashboard link in POS; Sign out available | Pass |
| Staff sidebar: all pharmacy pages plus Point of sale | Pass |
| Staff home page lists Point of sale; staff POS has a back link | Pass |
| Staff does not see batch numbers; pharmacist does | Pass |
| No-role account: no sidebar links; POS search refused by the API with "no role assigned" | Pass |

**Keyboard:**
- **F2, F4, F9 and Esc** are covered by component tests and the browser run.
- **Tab order:** a separate trace confirmed Tab moves header → customer → search → clear search → results. Every focusable control shows a 2 px focus outline.
- **Dialogs** trap focus and close on Escape (existing `Dialog` component).

## 3. Visual review of screenshots

- **1366 × 768:** search and results on the left, cart on the right. The subtotal, prescription-only warning and checkout-pending panel are visible without scrolling the page.
- **768 × 1024 and 390 × 844:** stacked. The fixed View cart bar shows count and subtotal; product names wrap rather than clip. On phones the customer dialog becomes a bottom sheet.
- Full-page screenshots show the sticky header part-way down the image. This is an artifact of full-page capture with a `sticky` header; viewport captures show the header correctly at the top.

## 4. Defects found in the browser and fixed

1. **Icon-only buttons rendered a dot instead of the icon:**
   - **Affected:** −, +, Remove, Remove customer, and Receive Stock's Remove line.
   - **Cause:** `IconButton` added `px-0` after the size's `px-5`, and `cn` does not merge conflicting classes, so the 48 px button kept 40 px of padding and the icon was 6 px wide.
   - **Fix:** icon-only sizes without padding in `components/ui/Button.tsx`. Re-measured at 22 × 22 px.
2. **"1 item, 1 units":** fixed the plural.

## 5. Not verified (gaps)

| Gap | Why | Needed |
|---|---|---|
| **Physical barcode scanner** | No hardware here; scanner behaviour was simulated by keyboard input at 2–5 ms per key | Test the pharmacy's actual scanner: suffix (Enter, CR+LF, Tab), scan speed, repeat scans, scanning while a dialog is open |
| Real touchscreen device | Only browser touch emulation was used | Tap accuracy, on-screen keyboard behaviour on a phone or tablet (the search box is auto-focused, which opens the keyboard on load) |
| Against the real API and Supabase | No staging; migrations not applied (P0-05) | Staging run with real roles |
| Screen readers (NVDA, VoiceOver) | Not run | Manual pass |
| Browsers other than Edge/Chromium | Only Edge was installed | Firefox and Safari spot checks |
| Dark mode | The app has no dark theme | — |
| Receipt printer | No printing exists yet | After the receipt milestone |

## 6. Test-suite stability note

Running the full API and web suites **at the same time** made 12 tests time out. These included two existing label tests that took 40 s under load: `StatWorkflow` and `ProductTypeSelection`. Every one passed when rerun alone, and both full suites passed when run one after the other. This is the known load sensitivity (roadmap P1-10). The POS component test now waits up to 5 s for async UI.
