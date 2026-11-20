# Day-Related Action Buttons: Reorganization Report

Date: 29 October 2026.

**Result: Days and Name of Days are now buttons in the left action grid. Till to the Day and Edit start day are inside the Select Days panel on the right. The separate bottom Days and Name of Days controls are gone.** This is a UI relocation only. The existing Zustand state, handlers, validation, Sinhala wording and print output are reused unchanged. No backend, database, migration, deployment, commit or push was involved. Feature #21 and #22 staging verification remain pending.

The three screenshots mentioned in the brief did not come through. The layout follows the written description.

## Button locations

| Control | Before | Now |
|---|---|---|
| **Days** (number of days) | Bottom bar card (−, number, +) | **Grid button**, row 1, position 2 (where Till to the Day was); opens the Days panel on the right |
| **Name of Days** | Full-width bar below the grid, beside ENT | **Grid button**, row 2, position 2 (where Edit start day was); opens Select Days on the right |
| **Till to the Day** | Grid button | **Inside Select Days**, top row |
| **Edit start day** | Grid button | **Inside Select Days**, top row |
| ENT | Bottom-left of the left column | Unchanged (same place, same size) |
| Expiry Date, label navigation, DONE | Bottom bar | Unchanged; they take the freed space (columns 2.1 : 2.5 : 2.8) |

The grid still has 20 buttons in the same 5×4 design, and every other button keeps its position. While a selection shows, the grid buttons display it: "Days · 2 days", "Name of Days · සඳුදා සිට සිකුරාදා දක්වා".

## Days panel (new right-side view, reusing the existing logic)

- The same rules as the former bottom card: **+** from "not set" gives 1, and **−** never goes below 1 (disabled at 1 or when not set). "—" means no duration, so nothing is printed.
- The value is a draft until **Done**. Done applies it through the existing Days number-pad path (`confirmNumberPad`: whole days only, 0 clears). **Cancel** changes nothing.
- Tapping the number opens the **existing Days number pad** for typed entry (e.g. 30), with its rule "Days must be a whole number."
- It uses the shared compact editor styling (no X/Y for days). Disabled while STAT is being entered, as before.

## Select Days panel changes (`app/label/DaysOfWeekPanel.tsx`)

The weekday selector is unchanged: Monday to Sunday in the existing Sinhala, selection indicators, **Select All**, **Cancel**, **Done**, and "Remove selected days". A labelled "Day selection mode" row was added under the header:

- **Till to the Day** runs the existing handlers in the order the old buttons required:
  1. With exactly one weekday chosen, Done confirms it as the start day (`closeDaysOfWeekPanel`).
  2. The range starts (`toggleWeekdayRange`).
  3. The panel reopens for the end day ("Select end day", `openDaysOfWeekPanel('end')`).

  Its enabled state uses the same rule as the former tile (`rangeSelectionRefusal`): exactly one confirmable start day and no incompatible selections. The rule's message is shown when one day is chosen but something else blocks the range. With a range present, the button is shown as pressed, and pressing it **removes the range and keeps the start day**, as the old tile did. No duration is inferred, and the Sinhala output is unchanged ("සඳුදා සිට සිකුරාදා දක්වා").
- **Edit start day** is available only when a range exists, as before. It applies a valid end day (or cancels an unfinished one), then opens the start-day selection ("Select start day", `openDaysOfWeekPanel('start')`) with the current start day selected. Other instructions are untouched.
- Name of Days multi-selection and the range modes stay separate: the panel title shows the mode ("Select Days" / "Select end day" / "Select start day"), and Select All is disabled in range modes (existing rule).

## Files changed

- `apps/web/components/label/InstructionGrid.tsx`: Days and Name of Days grid buttons (with the former controls' enabled rules); Till to the Day / Edit start day buttons and the bottom Name of Days bar removed; unused imports removed.
- `apps/web/components/label/BottomActionBar.tsx`: Days card removed; the three remaining cards share the width.
- `apps/web/app/label/DaysOfWeekPanel.tsx`: Till to the Day and Edit start day inside the panel.
- `apps/web/components/label/DaysPanel.tsx` (new): Days panel.
- `apps/web/components/label/ActionWorkspace.tsx`: shows the Days panel.
- `apps/web/components/label/CompactQuantityEditor.tsx`: optional X/Y, tappable value for typed entry, and explicit rules for when − and Done are enabled (existing users unchanged).
- Tests:
  - New `components/label/DayActions.test.tsx` (9 tests).
  - Updated for the new locations: `TillToDay`, `Eod`, `Workstation`, `ActionWorkspace`. Each still checks the same behaviour; for example, the range locks Weekly/EOD/STAT/8H/6H/5H/Daily/Evening, and EOD locks Name of Days.

## Day-related workflow verification

Automated (`DayActions.test.tsx` and the updated suites):
- **Buttons:** the grid has Days and Name of Days and no Till/Edit, with still 20 buttons; the old bottom Days and Name of Days controls are gone; Expiry, navigation and DONE remain.
- **Days:** opens on the right; +/− rules; Cancel discards; Done applies; typed entry rejects 1.5 and accepts 30.
- **Name of Days:** Sinhala weekdays, Select All, Cancel, Done, multiple days; Till to the Day is disabled with two days.
- **Till to the Day in the panel** gives **exactly** the range and Sinhala text of the old store sequence, with no duration inferred.
- **Edit start day** changes only the start day and keeps the end day and other instructions; Cancel keeps a confirmed range; pressing Till to the Day again removes the range and keeps the start day.
- **Labels and locks:** each label keeps its own days; EOD still locks Name of Days.

Real browser (headless Edge, UI testing mode, your running dev server): **18/18 passed at 1366×768, 1024×768 and 768×1024.**
- Grid contents, and the old bottom controls absent.
- Days panel: opens, fits, + + Done shows "2 days".
- Select Days: shows Till to the Day, Edit start day, Select All, Cancel and Done, and fits without scrolling.
- Monday → Till to the Day → "Select end day" → Friday → Done puts "සඳුදා සිට සිකුරාදා දක්වා" on the label.
- Edit start day → Tuesday → "අඟහරුවාදා සිට සිකුරාදා දක්වා".
- No horizontal overflow and no console errors.

Screenshots (`shots/dy_<width>_*.png`) are in my session's scratchpad, not in the repository.

## Regression results

| Check | Result |
|---|---|
| Full web Vitest | **57 files, 1,929 passed** (1,920 before + 9 new) |
| Web TypeScript | Passed |
| Web ESLint | Passed, 0 findings |
| Web production build | Passed |
| `git diff --check` | Passed |

No print code changed. The 70 × 50 mm label and Sinhala output tests pass unchanged.

## Remaining issues

- **ENT** shared its row with the removed Name of Days bar. It stays in its original bottom-left position, now on its own. Moving it elsewhere would change its location, which the brief doesn't ask for.
- Typed Days entry opens the existing number pad. If you've already used +/− in the Days panel, that unsaved draft is replaced by the typed value.
- UI testing mode only: the testing banner still pushes the bottom bar about 30 px off a 768 px-high screen. This predates this change.
- Physical printing and Feature #21/#22 staging verification remain pending.
