# Pharmacy Workstation — Targeted UI Redesign Report

Date: 2026-10-31 · Branch: `codex/phase1-safety-fixes` · Not committed, pushed or deployed.

Scope: the **top header**, the **right dosage / administration panel** and the **bottom action bar** of `/label`. These are presentation changes only, applied on top of the existing uncommitted working tree.

## ⚠️ Read first: the left panel does not match the reference screenshot

The reference screenshot shows the **original five-column grid**, with Reasons, Days, 5H, Evening, 6H, … and Delete Label and Add Label inside the grid.

The left panel in the current working tree is the **grouped Schedule / Instructions layout**. The brief says not to introduce that layout. It comes from uncommitted changes to `apps/web/components/label/InstructionGrid.tsx` that were last modified on 2026-10-30, before this session. The committed `HEAD` version is the five-column grid.

The brief also says to change only the top, right and bottom panels, to preserve the left panel exactly as it exists, and not to overwrite other sessions' work. Following that, **this task did not touch the left panel**.

Restoring the five-column arrangement would be a presentation-only change to `InstructionGrid.tsx`: one `grid-cols-5` grid in the screenshot's order, keeping every current tile rule, lock and refusal. It needs your go-ahead, because it changes uncommitted work from another session.

## Files modified

| File | Area | Change |
|---|---|---|
| `apps/web/components/label/ProductToolbar.tsx` | Top | Alternative, Qty and Home styling; focus rings |
| `apps/web/components/CustomerSearchInput.tsx` | Top | Patient icon tile, placeholder, loading spinner, focus ring |
| `apps/web/components/ProductSearchInput.tsx` | Top | Search icon tile, loading spinner, bordered barcode button |
| `apps/web/components/label/DosagePanel.tsx` | Right | "Dosage / Quantity" header, time-of-day card tints, value tiles |
| `apps/web/components/label/BottomActionBar.tsx` | Bottom | Expiry icon tile, label count size, solid DONE with new subtitle |
| `apps/web/components/label/DosageScheduleDesign.test.tsx` | Test | Idle-card assertion updated for the tint (see Tests) |

Screenshots were added under `docs/workstation-ui-redesign/before/` and `docs/workstation-ui-redesign/after/`.

None of the following were changed: the store, dosage arithmetic, Sinhala wording, label builder or print layout (70 × 50 mm), the save / Print & Save / Print-only handlers, patient or medicine search logic, barcode handling, API, schema, authentication or inventory.

## Top header

- **Patient / Mobile:** 48 px blue patient tile; the placeholder now reads "Name or mobile number"; a spinner replaces the icon while a patient search runs; the keypad button has a visible focus ring. Selection, keyboard navigation and clear behaviour are unchanged.
- **Medicine:** 48 px search tile that shows a spinner while searching. The TEST badge still appears in UI-test mode. The barcode button is now its own bordered 48 px tile in place of the divider plus bare icon. Its behaviour is unchanged: it focuses the input for the scanner.
- **Alternative:** tag icon (shown at ≥1280 px), "Alternative · optional" label, same height as the other controls.
  - The placeholder stayed "Other brand". "Other brand (optional)" was cut off at 1366 px, so "optional" moved into the label.
- **Quantity:**
  - The value sits in a bordered tile; the blue + is prominent.
  - The card border turns amber while the quantity is unset, alongside the existing "· Required" text.
  - The disabled − is now grey rather than faded.
  - − and + sit on opposite sides of the value with a gap, and − stays disabled at the minimum, so a mistaken tap is unlikely to change the quantity.
  - The logic is unchanged.
- **Home:** white card with a blue icon and label; blue tint on hover; focus ring. The link is unchanged.

## Right panel

- **Header:** a pill icon, the heading **"Dosage / Quantity"** (an `h2`) and the subtitle "Set the quantity for each dose time." The "Editing Morning fraction" chip now sits at the right of the header. When a single row is shown above the number pad, only the chip is shown, to save height.
- **Morning / Lunch / Night cards:** idle cards get subtle warm-orange, light-blue and purple tints with a solid time-of-day edge stripe. The time range is plain text instead of a pill. The QTY and X/Y tiles are white so they stand out on the tint.
- **Unchanged:** the selected state (light blue, blue border, wide blue accent bar, "Active" text), the grey disabled −, the lock-reason banner, and control sizes. The −, + and X/Y controls are 64 px, and 80 px at ≥1280 px; existing tests pin these sizes.
- **All three cards fit without scrolling** at 1920×1080, 1440×900, 1366×768 and 1024×768.
- **Administration (GIVE / TAKE / BEFORE / AFTER):** already four equal buttons with icons, a check badge and a blue selected state, so no change was needed.
- **ENT:** the button was already absent from this row. ENT data on existing labels is still read (`readEnt`), shown and removable in Selected Instructions, saved (`ent` in the payload) and printed. `EntPanel` and its tests still pass.

## Bottom panel

- **Expiry:** the calendar now sits in a tile, shown from 640 px, that turns green once a date has been retrieved; the "Expiry: Not added / date" text is unchanged. Tapping it still opens the GRN batch lookup, and the batch button is unchanged.
- **Label navigation:** 60 px previous and next buttons; "Label X / Y" is slightly larger. The Page Up / Page Down shortcuts and the STAT lock are unchanged.
- **DONE:**
  - Solid dark green; the gradient was removed.
  - Large white DONE, a check icon in a ring, a right arrow, and the subtitle **"Review & Print Labels"**.
  - When disabled during STAT it is faded, has no hover or press effect, and shows a not-allowed cursor. The focus ring is unchanged.
  - Ctrl+Enter still works and appears in the button's tooltip.
- **Placement:** the bar is in normal page flow at ≥1024 px and sticky below that. At the end of the page it covers nothing (checked at 768×1024).

## Left panel preserved

This session did not modify `InstructionGrid.tsx`, `InstructionTile.tsx`, `SelectedInstructionsPanel.tsx`, `instructionCategories.ts` or `LabelActions.tsx`. Their modification times are all before this session. See the warning at the top about how the left panel differs from the reference.

## Visual comparison

| Viewport | Before | After |
|---|---|---|
| 1920×1080 | `docs/workstation-ui-redesign/before/1920x1080.png` | `docs/workstation-ui-redesign/after/1920x1080.png` |
| 1440×900 | `before/1440x900.png` | `after/1440x900.png` |
| 1366×768 | `before/1366x768.png` | `after/1366x768.png` |
| 1024×768 | `before/1024x768.png` | `after/1024x768.png` |
| 768×1024 | `before/768x1024.png` | `after/768x1024.png`, `after/768x1024-scrolled-end.png` |
| 390×844 | `before/390x844.png` | `after/390x844.png` |
| Review page | — | `after/1366x768-review.png`, `after/1024x768-review.png` |

In the full-page captures below 1024 px, the sticky bottom bar appears partway down the page. That is how a full-page capture renders a sticky element; it is not a layout bug.

## Test results

| Check | Result |
|---|---|
| `tsc --noEmit` (web) | ✅ clean |
| ESLint on the changed files | ✅ clean |
| Vitest, full web suite, **before** the changes | 2158 passed, 2 failed: `StatWorkflow` 5 s timeout and `PosWorkstation` search timeout; both existed before this work |
| Vitest, full web suite, **after** the changes | 2159 passed, 1 failed: the same `StatWorkflow` 5 s timeout |
| `StatWorkflow`, `DosageScheduleDesign`, `Workstation`, `ActionWorkspace`, `ProductToolbar`, `LabelPrintLayout`, `ReviewPrintGuard`, `EntPanel` run on their own | ✅ 228 / 228 |
| Browser layout check: 6 viewports, horizontal overflow, overlaps, clipped text, ENT absent | ✅ No horizontal overflow, clipping or ENT at any size. The only overlaps are at 768×1024, where the sticky bar floats over content scrolled beneath it; this is the same before and after, and nothing is covered at the end of the page |
| Browser interaction check at 1366×768 (mouse) and 1024×768 (touch) | ✅ 52 / 52 (list below) |

The browser interaction check covered:

- patient and medicine typing
- product quantity: disabled − when unset, + +, −
- Morning + + / −, Lunch − disabled at 0, X/Y ½ giving 1½
- TAKE + AFTER, then GIVE replacing TAKE
- Add Label, then Previous and Next keeping each label's dose
- Expiry opening and closing the batch lookup
- DONE blocking a label without a quantity
- DONE opening the Review & Print page

Nothing was saved or printed.

**Test change:** `DosageScheduleDesign.test.tsx` asserted `bg-page` on idle dosage cards. Idle cards now carry the time-of-day tint, so the assertion now checks that an idle card does not have the blue selected fill. Every other design assertion is unchanged and passing.

**Repo e2e script:** `apps/web/e2e/workstation.e2e.mjs` is out of date with the current left grid. Its first step taps a "Till Date" tile that the grouped grid does not have, so it stops there whatever the state of these panels. The script also does not set the `pharmacy-ui-test` cookie that UI-test mode now requires. The focused interaction check above was used instead. That check, and the layout check, are in the session scratchpad and can be added to `e2e/` if you want them.

## Remaining UI issues

1. **Left panel ≠ reference:** see the warning at the top. A decision is needed.
2. At 1024×768 the patient placeholder "Name or mobile number" is cut to "Name or mobil…". This is placeholder text only; typed names have the full field width.
3. The administration buttons hide their icons when the card is narrower than 460 px (phones). This is an existing rule to stop the four labels overlapping.
4. `StatWorkflow.test.tsx` "locks main controls until Done…" times out at 5 s when the whole suite runs under load, and passes on its own. This existed before this work and is worth giving a longer timeout.
5. `workstation.e2e.mjs` needs updating for the current grid and the UI-test cookie (see above).
