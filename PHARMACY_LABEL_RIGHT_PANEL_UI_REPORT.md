# Label Workstation: Left Action Buttons, Right-Side Action Panel

Date: 29 October 2026.

**Result: the left action grid is always shown. Each action's existing panel, with its own Enter / Done (Next) / Cancel / Back buttons, now opens in the right column.** This is a layout refactor only. No instruction wording, clinical rule, store logic, label output or print dimension changed. No database, migration, deployment, commit or push was involved. Feature #21 and #22 staging verification remain pending.

The two reference screenshots mentioned in the brief did not come through with the request. The layout follows the written description.

## Previous behaviour

`components/label/InstructionGrid.tsx` rendered the 5×4 grid card and, inside that same card, switched to a panel when one was active: ENT → `EntPanel`, Name of Days / Till to the Day → `DaysOfWeekPanel`, any number pad → `NumberPad`, STAT → `StatPanel` / `StatAdminPanel` / `StatFollowUpPanel`. **That is why selecting STAT (and the others) replaced the left action buttons.** EXP Date and the Delete Label confirmation opened as full-screen overlays. Reasons already opened on the right, inside the Dosage Schedule card.

## New behaviour

- **Left column (unchanged look and order):** Selected Instructions, the 20-tile grid, ENT and Name of Days are always visible. While an action panel is open, the grid tiles use their existing faded and disabled style, with the hint "Finish or cancel the open panel on the right first". This keeps the previous rule that another action can't start mid-workflow, which used to be enforced by the grid being hidden. ENT and Name of Days keep their existing rules unchanged.
- **Right column, `ActionWorkspace` (new):**
  - Nothing open: the default **Dosage Schedule + Administration**.
  - Action panel open (STAT, STAT administration and follow-up, ENT, Name of Days / Till to the Day, the quantity pads for Weekly, 5H/6H/8H, Daily, Evening and STAT X/Y, the EXP Date batch lookup, the Delete Label confirmation): the panel replaces the Dosage Schedule card, and **Administration stays below**. That keeps Weekly's and Daily's own "Done - Weekly" / "Done - Daily" visible on the right, and Administration's STAT lock visible.
  - Dosage quantity being entered (Morning / Lunch / Night, or their X/Y): that **one dosage row stays above the pad**, with the live X/Y preview and the "Editing Morning fraction" badge, as Feature #1 (Document 5 dosage controls) requires.
  - Reasons: unchanged, already on the right.
- Only one panel is open at a time, using the existing store state (`activeControl`, `numberPad`, `expDateModalVisible`, `deleteLabelModalVisible`) with the same priority as before. No form state was duplicated, and every panel is the existing component with its existing handlers.
- **Switching labels** already closed STAT, days and pad edits (existing rule). It now also closes a pending Delete Label confirmation. Without that, an inline confirmation could have deleted the newly selected label; the old full-screen overlay used to prevent this.
- The prescription-level **DONE** stays in its bottom-right position.

## Files changed

- `apps/web/components/label/ActionWorkspace.tsx` (new): the right column and the shared "which panel is open" selector.
- `apps/web/components/label/InstructionGrid.tsx`: always renders the grid; locks its tiles while a panel is open; panel imports removed.
- `apps/web/components/label/InstructionTile.tsx`: `ActionTile` (Add/Delete Label) accepts `disabled` with the existing faded style.
- `apps/web/components/label/DosagePanel.tsx`: optional `only` row for the pad view. Default rendering unchanged.
- `apps/web/components/label/ExpDateModal.tsx`, `DeleteLabelModal.tsx`: same content and buttons, rendered in the right column instead of a full-screen overlay (`role="dialog"` / `role="alertdialog"` kept, no longer `aria-modal`).
- `apps/web/app/label/page.tsx`: the right column renders `ActionWorkspace`; the two overlays are no longer rendered separately.
- `apps/web/store/labelStore.ts`: switching labels also closes the delete confirmation.
- `apps/web/components/ProductSearchInput.tsx`: the UI-testing "Test type (not catalogue)" selector shortened to one line. Its longer label wrapped and pushed the toolbar over the panels at 1024 px.
- Tests:
  - New `components/label/ActionWorkspace.test.tsx` (29 tests).
  - Harnesses in 12 workstation test files now render `InstructionGrid` + `ActionWorkspace`, as the page does (AddExpiryDate, Daily, DigitalLabel, DosageQuantityControls, EntPanel, Evening, StatWorkflow, StatWorkstation, TillToDay, Weekly, WorkflowGuide, Workstation).
  - Four assertions changed meaning: while the frequency/STAT panel replaces the dosage rows, those rows are checked as *not present* rather than *disabled*. Each test still checks the rows are locked once they return.
  - The EXP Date / STAT test now expects the tile to be visible and disabled rather than hidden.

## Every action button tested

`ActionWorkspace.test.tsx` clicks each button on a fresh label. It checks that the 20-tile grid and Selected Instructions remain, and which right-hand view opens:

| Button | Right column |
|---|---|
| Reasons | Reasons selection, Enter / Omit reasons |
| Till to the Day | Immediate (on a fresh label it asks for the first weekday, existing rule) |
| 5H, 6H, 8H, Evening, Daily | Quantity pad (BACK / ENTER) + Administration |
| Weekly | Quantity pad + Administration with "Done - Weekly" |
| Remove Address, EOD, Empty Stomach, With Food, Chewable, Dissolve and Drink, Keep in Mouth, Add Label | Immediate toggle / action; Dosage Schedule stays |
| STAT | STAT Quantity (X/Y, −, +), Cancel, Done (Next); Administration locked below |
| EXP Date | GRN batch lookup (UI testing: temporary test date), Cancel |
| Delete Label | Confirmation (Delete Label / Cancel) |
| ENT | ENT controls |
| Name of Days | Weekday selection, Done / Cancel |
| Edit start day | Disabled until a Till to the Day range exists (unchanged) |

Further tests: STAT quantity, Cancel restoring the default view and unlocking the grid; X/Y dosage pad with live row preview and Enter; Weekly pad then "Done - Weekly"; Name of Days select and Cancel; ENT; Delete confirmation closing on label switch; EXP Date Cancel; switching labels mid-STAT abandons only that label's entry.

## Browser verification (headless Edge, UI testing mode, http://localhost:3002)

- **Layout check, 22/22.** At **1366×768 and 1024×768** I opened STAT, STAT X/Y pad, Weekly pad, 8H pad, Morning X/Y pad, ENT, Name of Days, Reasons, EXP Date and Delete Label. In every case:
  - all 20 tiles stayed visible on the left, and the panel sat to the right of the grid and above the bottom bar;
  - there was no horizontal overflow, and no panel needed scrolling;
  - every confirmation button (Done (Next), Cancel, BACK, Enter, Omit reasons, Delete Label) was on-screen;
  - there were no console errors.
- **End-to-end workstation flow, 26/26.** This is the run from the UI-testing report, repeated here. It covers Admin Reasons, manual product and test type, dosage, TAKE/AFTER, the Sinhala preview, EXP Date with the test date, STAT opening on the right with the EXP Date tile visible and locked, Reasons multi-select and Enter, add/switch/delete labels, review, Save (not saved), Print layout preview, and expiry removal reclaiming 34 mm. It also confirmed no backend requests and no console errors.
- Screenshots (STAT at 1366, the X/Y pad at 1024, and every panel at both sizes) are in my session's scratchpad (`shots/rp_*.png`), not in the repository.

## Regression results

| Check | Result |
|---|---|
| Full web Vitest | **54 files, 1,864 passed** (1,835 before + 29 new) |
| Web TypeScript | Passed |
| Web ESLint | Passed, 0 warnings |
| Web production build | Passed (UI testing switch not loaded) |
| `git diff --check` | Passed |

`PrintableLabel.tsx`, the label builder and all Sinhala wording were not touched. The 70 × 50 mm print layout and its tests are unchanged.

## Remaining issues

- **UI testing mode only:** the "UI Testing Mode" banner sits above a full-height page, so at 768 px height the bottom bar (Days, Expiry, label navigation, DONE) is cut off by about 30 px and needs a small scroll. This predates this change; screenshots from before the refactor show the same. It doesn't occur in normal mode, which has no banner. I can fix it separately if you want.
- Phones and narrow screens: the workstation has a fixed two-column, full-height layout designed for 1024 px and wider. That is unchanged; I didn't add a phone layout, as that would be a redesign.
- Physical printing and staging verification remain pending.
