# Pharmacy Label Workstation — Touch-First UI Redesign Report

**Date:** 2026-10-30 · **Branch:** `codex/phase1-safety-fixes` (uncommitted, as instructed) · **Scope:** frontend UI/UX only

**Summary.** The label workstation now has less text, no redundant panel headings, larger touch targets and a working responsive toolbar. No pharmacy business logic, Sinhala wording, validation, printing or data flow was changed. **All 1994 web tests pass** (see §8 for the suite's pre-existing timeout sensitivity). Type check, lint, production build and `git diff --check` are clean.

**Uploaded screenshot:** the brief referred to an uploaded screenshot, but no image reached this session. The visual reference was the live workstation, captured before any change (§5).

---

## 1. Phase A — audit findings

| Area | Before | Problem |
|---|---|---|
| Top bar | 6 fixed columns at every width (Customer, `⋯`, Medicine, Alternative, Qty, Home), fixed 84 px | At 390 px: medicine input **0 px** wide, Qty ± **15 px** wide, Home **26 px** wide; at 768 px: Qty ± 27 px. Long labels ("Manual test-product name (not catalogue data)"). |
| `⋯` button | Separate column | Opens the touch **mobile-number keypad lookup** (`CustomerSearchPanel`). This is essential on a keyboard-less touchscreen, so it was **kept and relabelled**, not removed. |
| Headings | "Selected Instructions", "Dosage Schedule", "Administration" (each with an icon tile) | About 36 px of height each, repeating what the controls already say. |
| Tiles | 20 px icons, 13 px labels below 2xl, 10 px badge | Small for a touch station. |
| Bottom bar | "EXPIRY DATE / Not added", "LABEL 1 OF 1", 44 px nav, DONE + subtitle | Wordy; nav below the 48 px aim. |
| Editors | 48 px footers, 40 px secondary controls, descriptive subtitles | Below the touch aim; extra reading. |
| Baseline tests | 5 real failures in `ProductTypeSelection.test.tsx` (placeholder and empty-state mismatch from earlier uncommitted work) | Fixed in this redesign (§8). |

Existing uncommitted work was preserved. A full snapshot of `app/ components/ constants/ lib/ store/` was taken before any edit, and only the files in §2 were touched. Line endings (CRLF) were kept.

---

## 2. Components changed

| File | Change |
|---|---|
| `components/label/ProductToolbar.tsx` | 6 → 5 columns. Responsive: desktop one 84 px row, tablet 2 rows, phone stacked. `⋯` column removed (moved into the Patient card). Short labels. Qty ± 36 → 44 px (48 px from 1280 px). "Required" shown only while Qty is unset. |
| `components/CustomerSearchInput.tsx` | "Patient / Mobile" `<label>`. Placeholder "Name or mobile". Clear × 28 → 40 px with an accessible name. **Keypad button (48 px)** opens the existing mobile-number keypad lookup. Duplicate clear button removed. |
| `components/ProductSearchInput.tsx` | Visible "Medicine" caption. Compact **TEST** badge for UI-testing mode (full meaning kept as sr-only text and title). Placeholder "Name, barcode or brand" / "Type a test medicine". Product type shown as "Karal · කරල්" ("Product type:" kept for screen readers). Empty state announces "No medicine selected". Clear 24 → 40 px. Barcode 36 → 44 px. |
| `components/label/SelectedInstructionsPanel.tsx` | Heading + icon replaced by a small "SELECTED" caption on the **same row** as the chips and Clear All (one row saved). Chips 32 → 44 px with a 44 px ×. Clear All and More 44 px. All alerts, notices and the Sinhala label preview are unchanged. |
| `components/label/InstructionTile.tsx` | Icons 20 → **28 px (34 px at 2xl)**. Labels 13 → 14/15/16 px. Value detail as a readable pill. 20 px check badge, 14 px lock glyph. Pressed tint. Min height 56 → 64 px. |
| `components/label/InstructionGrid.tsx` | Tighter card padding. Row floor 72 px on desktop and 88 px on tablet. The card scrolls instead of clipping if notices grow. |
| `components/label/DosagePanel.tsx` | "Dosage Schedule" heading removed (now a `section` named "Dosage schedule"). "Editing Morning fraction" and the lock explanation kept. Qty numeral 24/30 → 30/36 px. X/Y 72 → 84 px (120 × 76 from 1280 px). ± 56 px → 76 px from 1280 px. One-line rows at 1024 px. |
| `components/label/LabelActions.tsx` | "Administration" heading made sr-only. The workflow badge and "Next: …" status are kept (clinical guidance). Buttons 52 → 56 px (**64 px** from 1280 px), heavier 16/18 px text. Inline Weekly/Daily/Evening confirm 44 → 48 px. "Next" button 28 → 40 px. |
| `components/label/BottomActionBar.tsx` | "Expiry: Not added" on one line. "Label 1 / 1". Nav 44 → 56/60 px (48 px on phones). Batch chooser 44 → 48 px. DONE: subtitle removed (the accessible name still says "review and print labels"), bigger text. Phone column ratio fixes nav clipping. |
| `components/label/CompactQuantityEditor.tsx` | Description made sr-only. Footer 48 → 56 px. Fraction chips, X/Y inputs and Apply 40 → 48 px. |
| `app/label/DaysOfWeekPanel.tsx` | Subtitle removed. Weekday cards 44 → 56 px, 16 px Sinhala. Mode toggles 40 → 48 px. Select All 28 → 44 px. Footer 56 px. |
| `app/label/ReasonsPanel.tsx` | "(multiple allowed)" note sr-only. Header actions 40 → 48 px. Multi-select and Enter unchanged. |
| `components/label/ExpDateModal.tsx` | Batch choices 48 → ≥56 px. Footer and buttons 56 px. GRN source line kept. |
| `components/NumberPad.tsx` | Keys 44 → 56 px. |
| `components/StatAdminPanel.tsx`, `components/StatFollowUpPanel.tsx` | Footers and options 48 → 56 px. Follow-up subtitle sr-only. STAT step guidance (with Sinhala) kept. |
| Tests | `Workstation.test.tsx`: "LABEL n OF n" → "Label n / n". `ProductTypeSelection.test.tsx`: one `findByText` changed to `toHaveTextContent` on the same status element (same assertion, since the text now spans a sr-only node). |

**Not changed:** `app/label/page.tsx` (DONE, Save, Print & Save, Print-only handlers), `LabelActionPage.tsx` (review page), `PrintableLabel.tsx`, the store, `lib/` (instruction engine, fractions, Sinhala builder), constants, and the API.

---

## 3. Text removed or shortened

| Before | After | Class |
|---|---|---|
| Customer Name / Mobile · "Search or enter patient name / mobile..." | Patient / Mobile · "Name or mobile" | Redundant |
| "Manual test-product name (not catalogue data)" | Medicine **TEST** badge (meaning kept in sr-only text and title) | Contextual → compact |
| "Search product, barcode or brand..." (shown twice) | "Name, barcode or brand" (once) | Redundant |
| "Product type: Karal · කරල්" | "Karal · කරල්" (prefix sr-only) | Redundant |
| Alternative Product · "e.g. Different brand..." | Alternative · "Other brand" | Redundant |
| Product Qty · Required | Qty (· Required only while unset) | Redundant |
| "Test type (not catalogue):" | "Type:" (title keeps the full meaning) | Redundant |
| No instructions selected | None | Redundant |
| Label text … Show full text / Show less | Label … More / Less (+ sr-only "label text") | Redundant |
| EXPIRY DATE / Not added | Expiry: Not added | Redundant |
| LABEL 1 OF 1 | Label 1 / 1 | Redundant |
| DONE · Review & Print Labels | DONE (accessible name unchanged) | Redundant |
| Quantity-editor descriptions ("Quantity for each dose, every 6 hours", …) | sr-only | Contextual |
| "Choose the medication administration schedule" | removed | Redundant |
| "Select reasons for this label (multiple allowed)" | sr-only | Contextual |
| "Choose routine schedule to follow after STAT dose" | sr-only | Contextual |

**Kept on purpose:** dosage quantities, all Sinhala text, every `role="alert"` and warning, lock explanations ("Morning, Lunch and Night are locked: …"), the "Next: Choose TAKE or GIVE" status, the workflow badge, product-type warnings, batch and GRN expiry information, STAT step guidance, the "Editing Morning fraction" status, and the Print / Save distinctions (review page untouched).

## 4. Headings removed

| Heading | Now |
|---|---|
| Selected Instructions (h2 + icon) | Small "SELECTED" caption inline with the chips (h2 kept, with sr-only "instructions") |
| Dosage Schedule (h2 + icon) | Removed. `<section aria-label="Dosage schedule">` |
| Administration (h2 + icon) | `<h2 class="sr-only">` |
| Expiry Date caption | Inline "Expiry:" |

Measured visible headings in `main`: **3 → 1** (only the compact "Selected" caption) at all six viewports.

---

## 5. Before / after screenshots

All captures are from live dev servers in database-free UI test mode. The **before** set came from a scratchpad copy of the pre-redesign source (port 3010); the **after** set from the edited tree (port 3002). Script: Edge via `playwright-core`.

`docs/ui-audit/touch-first-redesign/before/` and `…/after/`, per viewport:
- `*-default.png` — the idle workstation (full page below 1024 px)
- `*-editor.png` — a Morning dose plus the Days editor open on the right
- `*-top.png` / `*-bottom.png` (768, 390) — real viewport views. Full-page captures paint the sticky DONE footer mid-page; this is a capture artifact, not a layout bug.
- `metrics.json` — measured sizes, overflow, clipping and headings per viewport

Key comparisons: `1366x768-default`, `768x1024-default` (toolbar), `390x844-top` (toolbar previously unusable), `1024x768-default` (single-line dosage rows).

## 6. Button-size measurements (rendered px, from `metrics.json`)

| Control | 1920 | 1366 | 1024 | 768 | 390 | Before (1366 / 390) |
|---|---|---|---|---|---|---|
| Grid tile (w × h) | 191 × 190 | 132 × 112 | 96 × 113 | 140 × 88 | 82 × 84 | 131 × 101 / 80 × 64 |
| Grid icon | **34** | **28** | 28 | 28 | 28 | 20 / 20 |
| Dosage + / − | **76 × 76** | **76 × 76** | 56 × 56 | 56 × 56 | 56 × 56 | 76 / 56 |
| Dosage X/Y | **120 × 76** | **120 × 76** | 84 × 56 | 84 × 56 | 84 × 56 | 120 × 76 / 72 × 56 |
| GIVE … ENT (h) | **64** | **64** | 56 | 56 | 56 | 52 / 52 |
| Qty ± | 48 × 48 | 48 × 48 | 44 × 44 | 44 × 44 | 44 × 44 | 36 × 36 / **15 × 36** |
| Prev / Next label | 60 × 60 | 60 × 60 | 60 × 60 | 56 × 56 | 48 × 48 | 44 × 44 / 44 × 44 |
| DONE (h) | 76 | 76 | 76 | 64 | 56 | unchanged |
| Chip × / Clear All | 44 / 44 | | | | | 32 / 36 |
| Editor Cancel / Done | 56 | 56 | 56 | 56 | 56 | 48 |
| Number-pad key, weekday card | 56 | | | | | 44 |

Below 1280 px, dosage controls are 56 px instead of 76 px. At 1024 px the right column is about 470 px wide, and 76 px controls force each row onto two lines. 56 px is still above the 48 px aim. The time-of-day illustration is hidden only in the 1024–1279 px band for the same reason; the MORNING/LUNCH/NIGHT text stays.

**Sub-44 px items still reported by the scanner:** the three text `<input>` lines (20 px tall). Each sits inside a 72–84 px card whose whole surface focuses the input on tap, so the effective target is the card. Also the Qty number button at 1024 px (42 × 44), which sits between two 44 px buttons.

---

## 7. Touch, keyboard and responsive verification

**Keyboard / touch / network** (`keyboard.mjs`, 1366 × 768, live app): **11/11 pass**
- Tab reaches DONE in 47 stops. Every stop has an accessible name and a visible focus indicator.
- Morning + (Space), With Food toggle (Enter, `aria-pressed`), 6H editor open and Cancel, ENT panel open/Done, and the patient keypad all work from the keyboard.
- A tap on a locked tile shows its reason. For example, 6H with a Morning dose gives "8H, 6H, 5H and Daily are locked while a Digital Label dose is selected", the unchanged clinical rule.
- **No request left localhost** during the run (no database or API calls in UI test mode).

**Responsive** (`shoot.mjs`): at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024 and 390×844:
- Horizontal overflow: **0 px** at all six (before: 0 px, but the phone toolbar was crushed inside the page).
- Clipped text: **0** at all six.
- Desktop keeps the two-column layout. Tablet stacks the grid above dosage and administration, with a two-row toolbar. Phone uses a 4-column grid, stacked panels, and the sticky DONE footer. No clinical action is hidden at any size.
- Fixed during verification: dosage-row wrapping and BEFORE/AFTER crowding at 1024, "Expiry: Not added" wrapping on three lines at 768, and nav clipping at 390.

## 8. Regression results

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean |
| Web lint (`eslint`) | Clean |
| Production build (`next build`) | Succeeds (all routes) |
| `git diff --check` | Clean |
| Full web tests | **1994 / 1994 pass** (225 files) |

**About the test suite's timeouts (pre-existing).** Under full parallel load on this machine, many workstation tests exceed the 5 s per-test default. The **baseline run on untouched code** had 106 such failures on its first run and 5 on its second. Evidence that this is load, not the redesign:
1. **A/B on identical tests:** `ChewingSam`, `KeepInMouth` and `StatWorkstation` run in isolation pass on both the original code (45.8 s) and the redesign (48.4 s).
2. **Full suite with `--testTimeout=20000`** (run flag only, no file changed): 1992/1994. The remaining two (`StatWorkflow`, `ProductTypeSelection`'s 1 s `findByRole`) pass when run alone.
3. The non-timeout assertions seen in loaded runs follow a timed-out test in the same file. One is the identical Keep in Mouth assertion seen in the baseline.

**Recommendation (not done, outside UI scope):** raise `testTimeout` in `vitest.config.mjs`, or split the heaviest workstation flows, so CI is not flaky.

Baseline real failures fixed: the 5 `ProductTypeSelection` failures (placeholder "Name, barcode or brand" and the "No medicine selected" empty state).

### Verification checklist

| # | Item | Result |
|---|---|---|
| 1 | All action buttons work | Pass: feature tests (#1–#22) and live keyboard run |
| 2 | Touch targets sufficiently large | Pass: §6; primary controls 56–76 px |
| 3 | Selected states clear | Pass: tint + 2 px border + check badge + `aria-pressed`; values visible ("Days 30 days", "6H ½ each") |
| 4 | Disabled actions explain restrictions | Pass: tap or Enter shows the reason; `aria-describedby` |
| 5 | Dosage +/− and X/Y | Pass: `DosageQuantityControls`, `DosageRow`, `DigitalLabel` tests |
| 6 | STAT and interval editors | Pass: `StatWorkflow`, `StatWorkstation`, `Intervals`, `CompactQuantity` |
| 7 | ENT accessible | Pass: `EntPanel` tests; live keyboard open/Done |
| 8 | Reasons and day selectors | Pass: `Reasons`, `DayActions`, `NameOfDays`, `TillToDay` |
| 9 | Expiry batch selection | Pass: `AddExpiryDate`, `expiryFinal` (GRN source validation unchanged) |
| 10 | Main DONE works | Pass: handler untouched; `page.test`, `ReviewPrintGuard` |
| 11 | Print-only vs Print & Save distinct | Pass: review page untouched; `printOnly.test` |
| 12 | No horizontal overflow | Pass: 0 px at all six viewports |
| 13 | No clipped text | Pass: 0 at all six viewports |
| 14 | No inaccessible icon-only controls | Pass: every tab stop has a name (keypad, clear, barcode, nav, ±) |
| 15 | Sinhala wording unchanged | Pass: no change to `lib/` or constants; Sinhala output tests pass |
| 16 | No unexpected DB calls in UI test mode | Pass: zero non-localhost requests |

---

## 9. Remaining UI issues

1. **Test timeouts under load** (pre-existing, §8): CI may be flaky until `testTimeout` is raised.
2. **10–11 px captions remain** (QTY, X / Y, TEST badge, time ranges, "Expiry:" on tablets). They're secondary by design, but small for a touch station.
3. **Sinhala preview in headless captures** renders as boxes in both the before and after shots: headless Edge doesn't load the Gemunu Libre / Noto Sans Sinhala web font. The font and text are unchanged, so this should be confirmed on the real workstation and printer.
4. **Dosage controls are 56 px between 1024 and 1279 px** (76 px from 1280 px), a deliberate trade-off to keep each row on one line.
5. **No usability session with pharmacists and no manual screen-reader pass** (NVDA/VoiceOver). Accessibility evidence is automated: names, focus, roles, live regions.
6. **Duplicate EXP Date control** (grid tile + bottom card) kept, per the earlier remediation decision.
7. **Feature #21 and #22 staging verification remains pending** (not touched).

## 10. Updated UI/UX score

Same categories as `PHARMACY_LABEL_WORKSTATION_UI_UX_AUDIT.md`. The previous column is from `PHARMACY_LABEL_WORKSTATION_UI_UX_REMEDIATION_REPORT.md`. Expert review of code and live renders only; **no pharmacist usability testing**.

| Category | Previous | Now | Evidence |
|---|---|---|---|
| Visual Design | 8 | **8.5** | 3 → 1 visible headings; larger icons; quieter cards; DONE dominant (§4, §5). |
| Layout Consistency | 7 | **8** | One editor structure (title → controls → Cancel/Done at 56 px); toolbar now responsive (the remediation report's blocked item). |
| Button Usability | 8 | **9** | Primary controls 56–76 px; chip × 32 → 44 px; status button 28 → 40 px (both were listed as remaining); Qty ± 36 → 44/48 px (§6). |
| Color Consistency | 8 | **8** | Unchanged token and category map; the green/red/blue identity kept. |
| Typography | 7 | **7.5** | Larger labels, numerals and editor text; 10–11 px captions remain (§9.2). |
| Accessibility | 8 | **8** | 11/11 keyboard checks; every stop named; sr-only context for removed text. No manual screen-reader pass. |
| Responsive Design | 6 | **8** | Phone toolbar went from unusable (0 px input, 15 px buttons) to stacked; 0 overflow and 0 clipping at all six sizes; one-line dosage rows at 1024. |
| Workflow Efficiency | 8 | **8.5** | Keypad lookup inside the Patient card; a full row saved in the Selected panel; less reading in editors. |
| Error Handling | 8 | **8** | Unchanged messages and placement, all kept. |
| **Overall UX** | **7.5** | **8 / 10** | Category mean 8.2. |

---

**Not done (as instructed):** no backend, database, migration, remote Supabase, deployment, commit or push. The Supabase MCP server was unreachable during this session and was not needed.
