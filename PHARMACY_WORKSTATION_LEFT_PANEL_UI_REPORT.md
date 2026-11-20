# Pharmacy Workstation — Left Panel UI Report

Date: 2026-10-31 · Branch: `codex/phase1-safety-fixes` · Not committed, pushed or deployed.

Scope: the left feature-button panel of `/label` only. This is a presentation change: every tile keeps its existing click handler, lock rules, refusal messages and selected-state logic.

## Files modified

| File | Change |
|---|---|
| `apps/web/components/label/InstructionGrid.tsx` | Replaced the Schedule / Instructions group cards and the separate Label actions strip with one grid in the requested order. Add Label and Delete Label now sit inside the grid. |
| `apps/web/components/label/InstructionTile.tsx` | Added an opt-in `selectedStyle="solid"` to `GridTile` (solid blue, white icon and label, white check badge) and the shared `SOLID_SELECTED` classes. The default `"tint"` is unchanged, so the ENT panel looks as before. |
| `apps/web/components/label/DayActions.test.tsx` | Updated tile positions: Days is now tile 2 and Name of Days tile 7. |
| `apps/web/components/label/SelectedStateConsistency.test.tsx` | Grid tiles now assert the solid selected style; chips keep their category colours. |

These were not touched: the top header, the dosage panel, GIVE / TAKE / BEFORE / AFTER, the expiry and navigation bar, DONE, the store, the instruction engine, the label builder and printing, Sinhala wording, prescription logic, the backend and the database.

## Layout

One white card containing `SELECTED`, a lock-notice line, and the grid:

| | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Row 1 | Reasons | Days | 5H | Evening | 6H |
| Row 2 | Remove Address | Name of Days | Weekly | STAT | EOD |
| Row 3 | EXP Date | Empty Stomach | With Food | Chewable | Daily |
| Row 4 | Delete Label | Add Label | Dissolve and Drink | Keep in Mouth | 8H |

- **Columns:** five equal columns from 640 px. Four between 480 and 639 px, and three below 480 px. The order stays row by row.
- **Height:** from 1024 px wide, the rows share the panel height, with a 72 px minimum. Below that, each row is at least 88 px.
  - All 20 tiles are visible without scrolling at 1920×1080, 1440×900, 1366×768 and 1024×768.
- **Grouping removed:** there are no Schedule or Instructions group containers or headings.

## Button styles

| State | Look |
|---|---|
| Normal | White, 1 px grey border, category icon colour (blue, purple for method instructions, grey for Remove Address), dark label |
| Selected | Solid blue (`primary`), white icon and label, white check badge, darker blue on hover. Toggles still expose `aria-pressed` and `data-selected`. Detail text such as "1 each" or "3 days" is shown in a white pill. |
| STAT | Red bolt and red label (unchanged); solid blue with white text while STAT is in use |
| Add Label | Solid green (`success`), white icon and label |
| Delete Label | White, 2 px red border, red icon and label; still opens the confirmation panel |
| Locked by a rule | Faded, dashed border, lock glyph; tapping explains why (unchanged) |
| Locked by an open panel | Faded; tapping explains why (unchanged) |
| Needs input / invalid | Dashed amber outline / solid red outline (unchanged) |
| Keyboard focus | 2 px blue ring with offset (unchanged) |

White on `#2563EB` has a contrast ratio of 5.2 : 1, which passes WCAG AA for text.

**ENT:** there is no ENT tile, as before. ENT data on existing labels is still read, shown and removable in Selected Instructions, saved and printed. `EntPanel` tests pass.

## Visual comparison

`docs/workstation-left-panel/before/` and `docs/workstation-left-panel/after/` contain shots at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024 and 390×844. In addition, `after/1366x768-states.png` and `after/1024x768-states.png` show the panel after the interaction run.

In the full-page captures below 1024 px, the sticky DONE bar appears partway down the page. That is how a full-page capture renders a sticky element; at the end of the page the bar covers nothing.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` (web) | ✅ clean |
| ESLint on the changed files | ✅ clean |
| Grid tests on their own: `DayActions`, `SelectedStateConsistency`, `ActionWorkspace`, `Workstation`, `WorkflowGuide`, `LockedActions`, `ReviewPrintGuard`, `EntPanel`, `Intervals`, `Weekly`, `NameOfDays`, `Eod` | ✅ all pass |
| `ChewingSam`, `DissolveSam`, `AddExpiryDate` on their own | ✅ 122 / 122 |
| `EmptyStomach`, `KeepInMouth`, `WithFood`, `StatWorkflow` with a 60 s per-test timeout | ✅ 236 / 236 |
| Full suite (2160 tests) | ⚠️ 2087 passed, 73 failed. 67 failures are 5 s timeouts; the rest follow on from them (see below) |
| Browser layout check, 6 viewports | ✅ No horizontal overflow and no clipped text. The only overlaps reported at 768×1024 and 390×844 are the sticky bottom bar over content scrolled beneath it |
| Browser grid check (order, columns, sizes, styles, workflows) | ✅ 91 / 91 (details below) |

The browser grid check ran in Edge in UI-test mode, at 1920×1080, 1366×768 (mouse), 1024×768 (touch), 768×1024 and 390×844. Nothing was saved or printed. It confirmed:

- **Layout:**
  - all 20 buttons appear in the requested order
  - 5 columns by 4 rows (3 by 7 at 390 px)
  - every tile has the same width and height: 132 × 111 px at 1366, 96 × 112 at 1024, 88 px tall on tablet and phone
  - no clipped text, and no Schedule or Instructions containers
  - all 20 buttons are visible without scrolling at 1920×1080, 1366×768 and 1024×768
- **Styles:**
  - STAT has a red icon and label
  - Add Label is solid green with white text
  - Delete Label is white with a red border and red text
  - Empty Stomach, Chewable, Remove Address and EOD each turn solid blue with a white icon, white label, check badge and `aria-pressed=true` when selected, and return to white when deselected
- **Workflows:**
  - With Food locks Empty Stomach, and tapping the locked tile shows "Empty Stomach is unavailable…"
  - Reasons, Days, 5H, STAT, Name of Days, EXP Date and Delete Label each open their panel, and the grid is locked while the panel is open
  - 8H gets a quantity of 1 and shows "1 each"
  - Add Label gives "Label 2 / 2"; Delete Label asks for confirmation, then gives "Label 1 / 1"
  - no ENT control appears

### About the full-suite failures

The full-suite failures are timeouts caused by a heavily loaded machine. They are not behaviour changes:

- **Every phase slowed down.** The run took 321 s against 103 s at baseline. Setup, transform and collect, which don't depend on component code, also roughly tripled.
- **Unrelated tests also timed out.** `app/admin/audit-log` and `components/pos/PosWorkstation` failed the same way, and neither uses the workstation.
- **The assertion errors are knock-on effects.** A timed-out test keeps running and writes to the shared store, so the next test finds left-over state. For example, one Dissolve case found `CHEWABLE, GIVE` from the previous Chewable case.
- **Every failing label file passes** either on its own or with a longer timeout (table above).
- **Other processes were using the CPU** during the runs:
  - a Git Bash `find / -maxdepth 6 -name playwright-core` (PID 34912). This session started it by mistake at 01:05 and could not stop it, because process termination was denied by the permission policy.
  - an `npm cache verify` (PID 16208) started at 02:37 by something else.
  - a Python detection worker (PID 25880, `D:\Ai cammera\backend`).

Once those have finished, rerun the full suite to confirm a clean baseline.

## Remaining notes

1. A one-line test fix is suggested: give the long workflow tests (`StatWorkflow`, `EmptyStomach`, `KeepInMouth`, `WithFood`, `ChewingSam`, `DissolveSam`) a longer `testTimeout`, so they are not sensitive to load.
2. `apps/web/e2e/workstation.e2e.mjs` is out of date. It taps tiles that no longer exist ("Till Date") and uses the number pad for intervals, which now use the compact editor. The browser checks in this report were run with scripts in the session scratchpad instead.
3. The Selected Instructions chips keep their category colours (blue, purple, red, grey), while selected grid tiles are now uniformly solid blue, as requested.
