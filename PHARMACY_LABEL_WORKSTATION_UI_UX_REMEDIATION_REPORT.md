# Pharmacy Label Workstation — UI/UX Remediation Report (P1–P3)

**Date:** 2026-10-30
**Branch:** `codex/phase1-safety-fixes` (uncommitted, not deployed)
**Inputs:** `PHARMACY_LABEL_WORKSTATION_UI_UX_AUDIT.md`, `docs/ui-audit/label-workstation/` (before), `docs/ui-audit/UI_UX_REMEDIATION_BASELINE.md` (Phase 0)
**After screenshots:** `docs/ui-audit/label-workstation/after/`

---

## 1. Executive summary

All P1 audit findings are fixed and verified except one. Locked actions now explain themselves on touch, keyboard, mouse and screen reader. The Dosage Schedule states why it is locked. The Expiry card is two valid, keyboard-reachable buttons, with focus returned after the batch dialog. All three contrast failures pass AA. The label text can be read in full before DONE.

**The exception is the responsive toolbar (part of P1 #6), which is blocked.** A second Claude session (`pharmacy-label-e7`) edited `ProductToolbar.tsx`, `ProductSearchInput.tsx` and `CustomerSearchInput.tsx` twice during this work, finally reverting them to their originals. I did not edit those files, so as not to overwrite or race that session's work (§13). The rest of P1 #6 is done: stacked layout, phone grid, sticky DONE, panel auto-scroll, and no horizontal overflow at any of the seven sizes measured.

Most P2 and P3 items are implemented:

- one category colour system shared by tiles and chips;
- a consistent selected state (tint + 2 px border + check badge + `aria-pressed`);
- neutral Administration buttons;
- an outlined Delete Label;
- token colours;
- equal peer headings;
- larger tile type with large-screen scaling;
- Sinhala typeface and `lang="si"`;
- `aria-expanded` on panel tiles;
- the UI-test banner overflow fixed.

Duplicate controls were assessed and kept on purpose (§9).

**No clinical logic changed.** No file under `lib/`, `store/`, `app/actions/`, `PrintableLabel.tsx`, `LabelActionPage.tsx` or `apps/api` was modified (verified by file timestamps against the Phase 0 baseline). Every lock still comes from the existing `*SelectionRefusal` functions; only its presentation changed.

**Score:** overall **6 → 7.5 / 10**. The 9/10 target is **not** reached; §12 explains why and what is left.

## 2. Baseline (Phase 0)

See `docs/ui-audit/UI_UX_REMEDIATION_BASELINE.md`:

- tsc and lint were clean;
- with the default 5 s timeout, 57 tests timed out under machine load;
- with `--testTimeout=30000`, **1970/1970 tests (59 files) passed**.

All verification below uses the 30 s timeout.

## 3. P1 fixes implemented

| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | Locked tiles explained only by hover `title` | Locked controls use `aria-disabled` instead of `disabled`, so they stay focusable and tappable. Their click is **guarded** and never runs the action. A tap or Enter/Space shows "*X* is unavailable: *reason*" in a `role="status"` live line (dismissible, clears after 8 s). The reason is also linked by `aria-describedby` and kept as `title`. Rule-based locks get a lock glyph and dashed border; panel-open locks just fade. Applies to all 20 grid tiles, Delete/Add Label, GIVE/TAKE/BEFORE/AFTER/ENT, ENT-panel tiles and DONE (during STAT). Reasons come from the existing refusal chain; locks without a rule message get "Unavailable while the STAT dose is being entered…" or "Finish or cancel the open panel on the right first." | `state-lock-notice.png`, `LockedActions.test.tsx` |
| 2 | Dosage Schedule disabled silently | The same refusal chain that disables the rows is shown under the heading: "Morning, Lunch and Night are locked: *reason*". It sits in a polite live region with a lock icon, and the fieldset is linked by `aria-describedby`. | `state-morning-dose.png` |
| 3 | Expiry card: nested interactive controls; batch chooser `tabIndex=-1` | Two sibling `<button>`s with the **same** accessible names and behaviour (toggle the GRN expiry; choose the batch). Both are focusable with native Enter/Space. Focus returns to the batch chooser when its dialog closes (choice, Close or Escape). Escape handling in `ExpDateModal` is unchanged, as are the GRN source and the no-auto-pick rule. | `LockedActions.test.tsx` (3 tests) |
| 4 | Contrast: BEFORE 3.35, AFTER 3.15, tile detail 3.64 | Phase 1: BEFORE → warning **4.73**, AFTER → success **5.24**, detail → white on primary **5.17**. Phase 2 then made admin buttons neutral (fg on white **17.85**) and the detail sits on a tint (primary-hover on primary-soft **6.16**) | §7 table |
| 5 | Label text truncated to one line | 2-line clamp with a **Show full text / Show less** toggle (`aria-expanded`, `aria-controls`); the text is selectable and uses `.sinhala-text` with `lang="si"` | `state-morning-dose.png` |
| 6 | No layout below 1024 px | Stacked, scrolling layout below `lg`. The grid is 4 columns on phones and 5×4 from 640 px. A sticky footer keeps DONE reachable (full-width on phones). An opened action panel scrolls into view. Administration wraps to 3 + 2 on narrow cards. **Toolbar blocked** (§13) | `after/label-768x1024-fullpage.png`, `label-390x844-fullpage.png`, `state-390-evening-panel.png` |

**Phase 1 gate:** tsc 0, lint 0, **1979/1979 tests (60 files)** with the 9 new accessibility tests. Phase 2 started only after this passed.

## 4. P2 fixes implemented

| # | Finding | Fix |
|---|---|---|
| 7 | Selected tile always solid blue; chip in a different colour; nine unused `SELECTED` variants | New `components/label/instructionCategories.ts`, the **one** source for idle icon, selected tint, border, badge, quantity text and chip. **schedule** (primary) covers intervals, Daily, Evening, Weekly, EOD, Days, Name of Days, Reasons, EXP, ENT and doses. **method** (new `accent` purple token) covers With Food, Empty Stomach, Chewable, Dissolve and Drink, Keep in Mouth. **urgent** (danger) is STAT only. **format** (neutral) is Remove Address. Selected = category tint + 2 px category border + check badge + `aria-pressed`. Unused variants removed. |
| 7b | Button states undocumented | States documented in `InstructionTile.tsx` and applied to tiles, Administration, the Reasons list and weekday buttons: default, hover, focus, pressed, selected, locked, requires-input, invalid. *Loading* does not apply to these controls; DONE's processing state lives on the review page and is unchanged. |
| 9 | Administration idle hues had no meaning (green AFTER) | Neutral idle style (white, strong border, muted icon); selection uses the shared tint + badge |
| 10 | Small type, no large-screen scaling | Tile labels 12 → **13 px** (16 px at ≥ 1536 px); quantity detail 10 → **12 px** (14 px); icons 20 → 28 px at ≥ 1536 px; peer headings (Selected Instructions, Dosage Schedule, Administration, ENT Administration) all **16 px bold, dark** |
| 11 | Delete Label as heavy as Add Label | **Outlined** danger style (danger on white, 6.47:1). **Position unchanged**, so the 5×4 order is preserved |
| 12 | Sinhala not in print typeface; no `lang` | `.sinhala-text` + `lang="si"` on the label preview, Sinhala reasons and weekday names. **No wording changed** |
| 13 | Whitespace at 1920 | Grid icons, text and badges scale at `2xl`. Dosage rows unchanged (protected design; §12) |
| 14 | Chip colour chosen by label substring | Chip style and icon keyed by **instruction code**; icons match the tiles |
| 15 | ENT panel heading styled differently | Aligned (16 px, dark); ENT-panel Delete Label outlined like the grid |
| 16 | No `aria-expanded` on panel tiles | Reasons, Days, Name of Days and STAT expose `aria-expanded` |
| — | Reasons / weekday selection used hard-coded solid `#2563EB` | The same tint + border + check treatment, from tokens |

## 5. P3 fixes implemented

| # | Finding | Result |
|---|---|---|
| 17 | Hard-coded hex colours | Removed from `InstructionGrid`, `InstructionTile`, `LabelActions`, `SelectedInstructionsPanel`, `BottomActionBar`, `EntPanel`, `ReasonsPanel` item and weekday buttons; new `accent` tokens in `globals.css`. **Kept:** the decorative sun/moon tints in the Dosage rows (protected by `DosageScheduleDesign.test.tsx`) |
| 18 | Runtime Google Fonts | **Not done:** needs downloaded font files and touches print CSS; left for a print-verified change |
| 19 | UI-test banner adds 25 px overflow | Fixed: `--ui-test-banner-h` is set only when the banner exists, and `<main>` is sized beneath it. Document height now equals the viewport at every desktop size |
| 20 | Dev indicator overlaps DONE | **Not changed:** dev-only, and `next.config.ts` is shared developer configuration |
| 21 | `select-none` blocks copying label text | The preview text is `select-text` |
| 22 | Remove Address ↔ Address Hidden | **Kept**: the label states the current state, and tests and users rely on it |
| — | Small targets | Label prev/next 40 → **44 px**; inline Weekly/Daily/Evening controls 36–40 → **44 px**; batch chooser 36 → **44 px**; weekday buttons ≥ 44 px |

## 6. Files changed (remediation only)

**Components:**

- `components/label/InstructionTile.tsx`: lock and state system, `LockNoticeLine`, `ControlHints`, category styling, `ActionTile` outline variant
- `components/label/instructionCategories.ts` (new)
- `components/label/InstructionGrid.tsx`, `LabelActions.tsx`, `DosagePanel.tsx`, `BottomActionBar.tsx`, `SelectedInstructionsPanel.tsx`, `EntPanel.tsx`, `ActionWorkspace.tsx`
- `app/label/page.tsx`, `app/label/ReasonsPanel.tsx`, `app/label/DaysOfWeekPanel.tsx`
- `app/globals.css` (accent tokens, banner variable), `components/UiTestControls.tsx` (banner marker)

**Tests:**

- `vitest.setup.ts`: `toBeDisabled` / `toBeEnabled` also honour `aria-disabled="true"`, so the ~150 existing lock assertions keep their meaning. Without this, `toBeEnabled` would pass vacuously on a locked control.
- New: `LockedActions.test.tsx` (9), `SelectedStateConsistency.test.tsx` (15).
- Updated: 22 selected-state assertions moved from the `bg-primary` class to `data-selected` (13 files). 4 direct `.disabled` property reads now use the matchers (`EntPanel`, `UsbAdministration`). Two grid selectors use `data-testid="action-grid"` (`ActionWorkspace`, `DayActions`). 3 weekday/reason colour assertions moved to tokens (`NameOfDays`, `Reasons`, `TillToDay`). **No test was removed or skipped.**

**Docs:** this report, `docs/ui-audit/UI_UX_REMEDIATION_BASELINE.md`, the audit status section, and `docs/ui-audit/label-workstation/after/*.png`.

## 7. Accessibility improvements

- **Locked controls:** focusable, explained on activation, described for assistive technology, guarded against activation; a lock glyph for rule locks (not colour or fade alone).
- **Live regions:** lock explanations, Dosage lock and the "Label N of M" counter.
- **Expiry:** valid structure, both buttons keyboard-reachable, focus return after the dialog.
- **Contrast** (computed from token hex):

  | Pair | Ratio |
  |---|---|
  | Every remediated text pair | 4.73–17.85 |
  | Selected border vs tint / white | ≥ 4.75 |
  | Badges | ≥ 5.17 |
  | Idle icons | ≥ 5.17 (the Evening icon was 2.80) |

  Idle button borders are 1.48:1, which WCAG 1.4.11 allows because each button is identified by its visible text.
- **Selection:** never colour alone; 2 px border, check badge, `aria-pressed`/`data-selected`.
- **Focus:** every one of the 40 Tab stops sampled shows a ring (`after/state-keyboard-focus.png`).
- **Language:** `lang="si"` on Sinhala text.

## 8. Responsive design improvements (headless Edge, live DOM measurements)

| Viewport | Horizontal overflow | Clipped labels | Notes |
|---|---|---|---|
| 1920×1080 | none (was none) | none | Document height = viewport (was +25 px) |
| 1440×900 | none | none | |
| 1366×768 | none | none | |
| 1366×650 *(new: realistic till viewport)* | none | none | Two-column layout still fits |
| 1024×768 | none | none | |
| 768×1024 | none | none (was 3) | Stacked; Administration in one row of five with icons |
| 390×844 | none | **none (was 20)** | 4-column grid, stacked panels, sticky DONE; **toolbar still the original 6-column row (blocked)**: product-qty buttons measure 15×36 px |

## 9. Navigation decisions (Phase 3)

| Duplicate | Decision | Reason |
|---|---|---|
| EXP Date tile ↔ Expiry card | **Keep both** | The card is the always-visible status (date, batch, test marker) and the only batch chooser; the tile is the action in the grid. They run the same store toggle, so they cannot disagree. |
| Weekly row in Administration (value, −, +, X/Y, Done - Weekly, Back) | **Keep**; 44 px, tokens | It is the only place to adjust a confirmed Weekly quantity without deselecting it; removing it would remove access. |
| Done - Daily / Back from Daily, Done — enable Digital Label / Back from Evening | **Keep**; labelled groups, 44 px | They are the recovery path after Cancel in the right-hand editor (the instruction stays selected and needs confirming). The panel's Done (Next) is not visible then. |
| Left = select, right = configure | Already the model; reinforced | On phones the right-hand panel scrolls into view when an action opens it. |
| ENT in Administration | **Kept** as the 5th button | Verified by tests: Eye/Ear/Nose, Left/Right/Both, drop units, custom hours, start/end dates, STAT/Reasons/Till-to-the-Day locks (now explained) |

## 10. Before-and-after screenshots

Before: `docs/ui-audit/label-workstation/*.png`. After: `docs/ui-audit/label-workstation/after/*.png` (same names, plus `label-1366x650.png`, `*-fullpage.png` for 768/390, `state-lock-notice.png`, `state-390-evening-panel.png`).

**Full-page phone and tablet captures:** the sticky footer is drawn at the original viewport bottom, over the grid or Administration card. In use it stays at the screen bottom while content scrolls beneath it.

## 11. Test results (final)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | **Pass** |
| `npx eslint .` | **Pass** |
| `npx vitest run --testTimeout=30000` | **1989 / 1994 pass (61 files)**. The 5 failures are all in `components/ProductTypeSelection.test.tsx`, which the other session rewrote at 23:59 (it now expects the placeholder "Name, barcode or brand"); that session then reverted `ProductSearchInput.tsx` at 00:10. The test renders only `ProductSearchInput` and `LabelCard`, none of the remediation files. Before that session's edits, the same file passed 14/14 in isolation with these changes in place. |
| Phase 1 gate (before the other session's edits) | 1979 / 1979 |
| Phase 2 run (before its edits) | 1993 / 1994, the one failure being a new consistency test whose setup was then fixed (15/15) |
| `npx next build` | **Pass** (`/label`, `/label/print-check` compiled) |
| `git diff --check` | **Pass** |
| Browser | Headless Edge against the local UI-test dev server (backend calls disabled). Six requested viewports + 1366×650, interaction states, 40-stop Tab walk |

### Action-by-action matrix (Phase 6)

**Checks applied to every action (each file passes):**

| Check | Covered by |
|---|---|
| Opens the correct editor on the right | `ActionWorkspace.test.tsx` (all 21 actions) |
| Lock explained on touch, keyboard and assistive technology | `LockedActions.test.tsx` |
| Selected state consistent with its chip | `SelectedStateConsistency.test.tsx` |
| Cancel / Done (Next) | `CompactQuantity.test.tsx` and the action files below |

**Action-specific coverage:**

| Action | Action-specific tests |
|---|---|
| Reasons | `Reasons.test.tsx`, `ReasonCatalogueLoader.test.tsx` |
| Days / Name of Days (+ Till to the Day) | `DayActions.test.tsx`, `NameOfDays.test.tsx`, `TillToDay.test.tsx` |
| 5H / 6H / 8H | `Intervals.test.tsx`, `PrintedInterval.test.tsx` |
| Evening | `Evening.test.tsx` |
| Weekly | `Weekly.test.tsx` |
| Daily | `Daily.test.tsx` |
| EOD | `Eod.test.tsx` |
| STAT | `StatWorkflow.test.tsx`, `StatFlow.test.tsx`, `StatWorkstation.test.tsx` |
| EXP Date / Expiry card | `AddExpiryDate.test.tsx`, `app/label/expiryFinal.test.tsx`, `LockedActions.test.tsx` |
| Empty Stomach / With Food / Chewable / Dissolve and Drink / Keep in Mouth | `EmptyStomach`, `WithFood`, `ChewingSam`, `DissolveSam`, `KeepInMouth` tests, `UsbAdministration.test.tsx` |
| Remove Address, Delete Label, Add Label | `Workstation.test.tsx`, `ActionWorkspace.test.tsx` |
| ENT | `EntPanel.test.tsx`, `CompactQuantity.test.tsx` (custom hours), `ActionWorkspace.test.tsx`, `LockedActions.test.tsx` |
| Fractions and quantities | `DosageQuantityControls.test.tsx`, `NumberPad.test.tsx`, `DigitalLabel.test.tsx` |
| Multiple-label independence | `WorkflowGuide.test.tsx` ("each label keeps its own workflow"), `Eod.test.tsx` |
| Sinhala wording unchanged | `Workstation.test.tsx` ("Sinhala label text follows the buttons"), `WorkflowGuide.test.tsx` |
| Product-type rules | `ProductTypePrinting.test.tsx` (pass); `ProductTypeSelection.test.tsx` (other session's failures, §13) |
| Print-only / Print & Save / 70 × 50 mm | `app/label/printOnly.test.tsx`, `ReviewPrintGuard.test.tsx`, `app/label/page.test.tsx`, `LabelPrintLayout.test.tsx` |
| Database-free UI-test mode | Live run in UI-test mode (§8); `UiTesting.test.tsx` |

Clinical safeguards: no change to dosage/fraction/STAT/interval logic, product-type rules, Reasons authorisation, GRN expiry, print-only, Save / Print & Save validation, multiple-label isolation or the 70 × 50 mm print layout. All their existing tests pass.

## 12. Before-and-after scorecard

| Category | Before | After | Evidence |
|---|---|---|---|
| Visual Design | 7 | **8** | One selection idiom, outlined Delete, neutral admin, token colours. Dosage rows still sparse at 1920. |
| Layout Consistency | 6 | **7** | Equal peer headings, 44 px inline controls, stacked layout. Duplicates kept by decision; toolbar not responsive. |
| Button Usability | 6 | **8** | Locks explained on every input method, lock glyph, larger targets, safer Delete. Chip × 32 px and status button 28 px remain. |
| Color Consistency | 5 | **8** | One category map for tile, chip and badge; tokens. Dosage illustration hex kept. |
| Typography | 6 | **7** | 13/16 px labels, scaled at 2xl, equal headings, Sinhala typeface + `lang`. 10–11 px captions remain. |
| Accessibility | 6 | **8** | All P1 a11y items fixed; AA contrast; `aria-expanded`; focus return. No manual screen-reader pass; some sub-44 px secondary targets. |
| Responsive Design | 4 | **6** | Zero overflow and zero clipping at all seven sizes; phone usable. Toolbar crushed below 1024 px (blocked); locked Dosage card scrolls at 1366×768. |
| Workflow Efficiency | 7 | **8** | No trial-and-error on locks, full label text on demand, panel auto-scroll on phones. |
| Error Handling | 7 | **8** | Reasons shown at the control and at the Dosage heading, announced. |
| **Overall UX** | **6** | **7.5** | |

**Why not 9:**

1. The toolbar is not responsive (blocked).
2. Secondary targets below 44 px: chip ×, Clear All, the "Next:" status button, Dismiss.
3. The Dosage card needs scrolling when locked at 1366×768.
4. 1920 density in the dosage rows.
5. No usability testing with pharmacists, and no NVDA/JAWS pass.
6. Duplicate confirmation surfaces kept pending a product decision.

## 13. Remaining issues

| Priority | Issue | Next step |
|---|---|---|
| **P1 (blocked)** | `ProductToolbar` is the original fixed 6-column, 84 px row; below 1024 px the qty buttons shrink (15×36 px at 390) | Coordinate with session `pharmacy-label-e7`, which is editing `ProductToolbar.tsx` / `ProductSearchInput.tsx` / `CustomerSearchInput.tsx`, then apply a 3-row toolbar below `lg` |
| P1 (other session) | `ProductTypeSelection.test.tsx` expects that session's reverted search UI (5 failures) | That session must either restore its component change or its test |
| P2 | Chip × 32 px, Clear All 36 px, "Next:" status button 28 px, Dismiss 28 px (AA met, below 44 px guidance) | Enlarge within the Selected Instructions / Administration headers |
| P2 | Locked Dosage card scrolls at 1366×768 | Compact row height while locked (needs a `DosageScheduleDesign` test update) |
| P2 | Dosage rows sparse at 1920 | Scale row content at 2xl |
| P2 | Duplicate confirmations (§9) | Product decision |
| P3 | Self-host fonts; dev indicator position | Print-verified change; developer preference |

## 14. Regression risks

| Change | Risk | Mitigation |
|---|---|---|
| `aria-disabled` instead of `disabled` on action controls | Medium: a control without the click guard could act while "locked" | All locked paths go through `GridTile`/`ActionTile`/`LabelActions`/DONE guards; tests click locked controls and assert no state change; the `vitest.setup.ts` matcher keeps every existing lock assertion meaningful |
| Category recolouring (Evening and Daily icons are now blue; Empty Stomach / Keep in Mouth purple, not red) | Low–medium: user familiarity | Shapes, icons, positions and labels unchanged; documented rule |
| Selected tiles now tinted, not solid | Low: less "loud" | 2 px border + badge + `aria-pressed`; ≥ 4.75:1 border contrast |
| Stacked layout below 1024 px (incl. small landscape laptops ≈ 1000 px wide) | Medium | Desktop (≥ 1024 px) layout unchanged; measured at 7 sizes |
| Test assertion updates (class → `data-selected`) | Low | Same intent, stronger non-colour signal; no test removed |

## 15. Production-readiness limitations

- Not deployed, committed or pushed; no migrations; no remote database contacted (UI-test mode).
- **Staging verification of Features #21 and #22 remains pending.**
- **Physical printer verification is not done.** Print CSS and `PrintableLabel` are untouched and the print tests pass, but no 70 × 50 mm print was made.
- Browser verification used headless Edge only; no Safari, iPad, Android or real till hardware.
- Parallel session work (§13) must be reconciled before this branch is reviewed.
