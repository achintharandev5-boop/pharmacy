# Action Input Panels: Standardization Report

Date: 29 October 2026.

**Result: every action that asks for a quantity now opens the compact STAT-style editor on the right (large quantity, X/Y, −, +, Cancel, Done (Next)). The large number pad is gone from all action-button workflows.** The left grid, its order and its styling are unchanged. Other actions keep their own selectors on the right. No clinical wording, quantity arithmetic, validation rule, store logic, print layout, backend, schema or database was changed. Nothing was committed, pushed or deployed. Feature #21 and #22 staging verification remain pending.

The screenshots mentioned in the brief did not come through. The existing STAT panel was used as the visual reference, as described.

## Audit: every action and every number-pad entry point

Every call that opens the number pad (`openNumberPad` / `numberPad: { visible: true }`) was traced.

| Action / control | Before | Now |
|---|---|---|
| **5H, 6H, 8H** (quantity per dose) | Large number pad (`frequency`) | **Compact quantity editor** |
| **Daily** (daily dose) | Large number pad (`frequency`) | **Compact quantity editor** |
| **Evening** (evening dose) | Large number pad (`frequency`) | **Compact quantity editor** |
| **Weekly** (weekly dose), and its X/Y button in Administration | Large number pad (`weekly`, `weekly_fraction`) | **Compact quantity editor** (X/Y choices open straight away from the X/Y button) |
| **ENT custom hours** (dose quantity) | Large number pad (`frequency`) | **Compact quantity editor** |
| **STAT** | Compact panel, but its **X/Y opened the large pad** (`stat_fraction`) | **Same compact editor**; X/Y now applies inline |
| Administration's "quantity for 8H/…" step button | Large number pad | Compact quantity editor (same `frequency` target) |
| Reasons | Multi-reason selector | Unchanged, on the right |
| EXP Date | GRN batch selection | Unchanged, on the right; no manual or invented dates |
| Name of Days, Till to the Day, Edit start day | Weekday / range selector | Unchanged, on the right |
| ENT | ENT site, direction, unit and frequency controls | Unchanged, on the right |
| STAT administration and follow-up | Their own panels | Unchanged, on the right |
| Delete Label | Confirmation | Unchanged, on the right |
| Remove Address, EOD, Empty Stomach, With Food, Chewable, Dissolve and Drink, Keep in Mouth, Add Label | Immediate | Unchanged: no extra confirmation added |

**Pads deliberately kept** (they don't belong to an action button and need typed entry): the dosage-row QTY and X/Y pads (Feature #1 Document 5 dosage controls, with the live row preview), Days (bottom bar) and Product quantity (toolbar).

## How the compact editor works

- **`CompactQuantityEditor`** (new, presentational) has the layout and styling of the existing STAT panel: icon and title, short description, large centred quantity, **X / Y**, **−**, **+**, then **Cancel** and **Done (Next)**. Done (Next) is disabled until there is a quantity.
- **X/Y offers what the pad offered:** the pad's ¼, ½ and ¾ shortcuts, **None** (remove the fraction), and a typed **X / Y** with **Apply X/Y** for any fraction below 1 (e.g. 1/3). A typed fraction is checked by the pad's own rule (`validateQtyEntry`): "X/Y must be a fraction smaller than 1…". As with the pad, the fraction is added to the whole number already chosen.
- **STAT** (`StatPanel`) now uses the shared editor. Its button names, test ids, Cancel and Done (Next) handlers are unchanged. X/Y goes through the existing STAT fraction rule (`stat_fraction`, `setQuickFraction`). The initial-dose behaviour, STAT validation and follow-up workflow are unchanged.
- **5H/6H/8H, Daily, Evening, Weekly, ENT custom** (`ActionQuantityPanel`):
  - − and + use the existing exact arithmetic (`stepDosage`, integer numerators, no floating-point drift).
  - The value is a **draft**: nothing reaches the label until Done (Next), so **Cancel applies nothing**.
  - Done (Next) submits through the number pad's existing path (`confirmNumberPad` → `validateQtyEntry` → `applyQty`). The stored quantity, Selected Instructions and Sinhala text are therefore exactly what the pad produced; the tests compare the two directly.
  - STAT quantity (`stat`) and interval/daily/evening/weekly quantity (`frequencyDosage` / `weeklyDosage`) remain separate.
- Each action's existing next step is unchanged: "Done - Weekly", "Done - Daily" and "Done — enable Digital Label" stay in Administration on the right, and the STAT follow-up flow is unchanged. The prescription-level DONE stays bottom-right.

## Files changed

- `apps/web/components/label/CompactQuantityEditor.tsx` (new): shared editor.
- `apps/web/components/label/ActionQuantityPanel.tsx` (new): quantity step for 5H/6H/8H, Daily, Evening, Weekly and ENT custom.
- `apps/web/components/StatPanel.tsx`: rebuilt on the shared editor; inline X/Y.
- `apps/web/components/label/ActionWorkspace.tsx`: shows the compact editor for those targets; the number pad remains for typed entries.
- Tests:
  - New `apps/web/components/label/CompactQuantity.test.tsx` (47 tests).
  - Interaction updates where tests pressed the big pad's keys ("1", BACK, `numpad-enter`, "5H — QTY PER DOSE") for these actions: `Workstation`, `WorkflowGuide`, `StatWorkflow`, `StatWorkstation`, `Daily`, `Evening`, `Weekly`, `ActionWorkspace`. Each still checks the same outcomes.

## Action-by-action verification matrix

✓ = verified by automated test (`CompactQuantity.test.tsx`, `ActionWorkspace.test.tsx`, existing feature suites) and, for the quantity actions, in a real browser.

| Action | Grid stays | Right panel | No large pad | X/Y | + / − | Cancel | Done (Next) | Same wording |
|---|---|---|---|---|---|---|---|---|
| 5H | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ applies nothing | ✓ | ✓ identical to pad |
| 6H | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8H | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Daily | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓, then "Done - Daily" | ✓ |
| Evening | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓, then "Done — enable Digital Label" | ✓ |
| Weekly | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓, then "Done - Weekly" | ✓ |
| STAT | ✓ | Compact editor | ✓ | ✓ (inline) | ✓ | ✓ (existing STAT cancel) | ✓, then follow-up | ✓ |
| ENT custom hours | ✓ | Compact editor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reasons | ✓ | Reasons selector | n/a | n/a | n/a | Omit/Cancel | Enter | ✓ |
| EXP Date | ✓ | GRN batch lookup | n/a | n/a | n/a | ✓ | batch choice | ✓ |
| Name of Days / Till to the Day / Edit start day | ✓ | Weekday/range selector | n/a | n/a | n/a | ✓ | Done | ✓ |
| ENT | ✓ | ENT controls | n/a | n/a | n/a | ✓ | ✓ | ✓ |
| Delete Label | ✓ | Confirmation | n/a | n/a | n/a | ✓ | Delete Label | n/a |
| Remove Address, EOD, Empty Stomach, With Food, Chewable, Dissolve and Drink, Keep in Mouth, Add Label | ✓ | none (immediate) | n/a | n/a | n/a | n/a | n/a | ✓ |

Also verified:
- STAT 2 then 8H 1 keep separate values.
- Switching labels with the editor open closes it without applying the draft, and each label keeps its own value.
- Selected and locked tile states are unchanged; the grid is locked while an editor is open, as in the right-panel update.
- An invalid typed X/Y is refused with the pad's message.

## Browser verification (headless Edge, UI testing mode, http://localhost:3002)

**42/42 passed** at **1366×768 and 1024×768**, using your running dev server in UI testing mode (no backend or database). For 5H, 6H, 8H, Daily, Evening, Weekly and STAT:
- the compact editor opened on the right with the correct title, and no number pad was present;
- the 20-tile grid stayed visible;
- the panel sat beside the grid and above the bottom bar, with no horizontal overflow, and every button (Cancel, Done (Next), X/Y, −, +) was on-screen;
- **+ + ½ then Done (Next)** gave **2½** in Selected Instructions;
- **Cancel** applied nothing (all except STAT, whose Cancel is the existing STAT rule, covered by tests);
- there were no console errors.

Screenshots (`shots/cq_<width>_<action>.png`, e.g. the Evening editor with X/Y open at 1024 px) are in my session's scratchpad, not in the repository.

## Regression results

| Check | Result |
|---|---|
| Full web Vitest | **55 files, 1,911 passed** (1,864 before + 47 new) |
| Web TypeScript | Passed |
| Web ESLint | Passed, 0 findings |
| Web production build | Passed (UI testing switch not loaded) |
| `git diff --check` | Passed |
| API tests | Not rerun: no backend file was changed in this task |

Sinhala wording, `PrintableLabel.tsx`, the label builder and the 70 × 50 mm print tests are unchanged.

## Remaining issues

- The dosage-row QTY/X/Y, Days and Product quantity still use the number pad. They aren't action buttons and need typed entry (e.g. 30 days, 120 tablets, live row preview). Converting them would be a separate decision.
- UI testing mode only: the testing banner pushes the bottom bar about 30 px off a 768 px-high screen. This predates this change.
- Phones and narrow screens: the workstation's fixed two-column layout (1024 px and wider) is unchanged.
- Physical printing and Feature #21/#22 staging verification remain pending.
