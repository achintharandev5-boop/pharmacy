# Dosage Schedule: Visual Redesign Report

Date: 29 October 2026.

**Result: Morning, Lunch and Night are clean white cards with soft accents. Pressing + now gives a soft blue selected state, not a solid-blue block.** This is a visual change to the dosage row card only. Quantities, +/− rules, fraction arithmetic, STAT, intervals, Daily/Weekly, Sinhala wording, Administration, Selected Instructions, preview, save/print and the 70 × 50 mm label are unchanged. No backend, database, migration, deployment, commit or push was involved.

The screenshot mentioned in the brief did not come through. The design follows the written specification.

## What changed (`apps/web/components/label/DosagePanel.tsx`, row card only)

| Element | Before | Now |
|---|---|---|
| Row card | Tinted per time of day (orange/blue/purple background) | White (`bg-page`), neutral border; **selected: soft blue border (`border-primary-border`) and light shadow** |
| Time and quantity | **Whole block turned solid blue** with white text when quantity > 0 | Label stays dark (`text-fg`); a **small blue check badge** appears next to it (not colour alone); quantity on a soft tile, **blue number on `bg-primary-soft`** when selected, muted on neutral `bg-surface` at 0 |
| Icon | Large bare icon | **Same icons**, on a small rounded accent tile: warm orange (Morning), sky blue (Lunch), purple (Night) |
| X / Y | Tall tile, solid blue when a fraction was set | Compact bordered control with a small "X / Y" label and the fraction; **soft blue when a fraction is set**; visible focus ring |
| − | Large solid-red rectangle | **Pale red** (`bg-danger-soft`, red icon), same size as + |
| + | Large solid-green rectangle | **Primary blue**, white icon, hover darker |
| Pressed state | Solid blue fill | A ring around the last-pressed button (and `aria-pressed`) |
| Time ranges, labels | Unchanged | Unchanged |

- Only existing theme tokens are used (`page`, `surface`, `border`, `fg`, `muted`, `subtle`, `primary*`, `danger*`). The accent tiles reuse the hex values the rows already had (sky blue for Lunch instead of the theme's primary-soft). No new palette was introduced.
- Equal row heights; on desktop all controls are on one line. Below the threshold width the controls **wrap onto a second line**, right-aligned under the label and quantity, with no overlap.
- State and logic are untouched: the same Zustand selectors and handlers (`incrementDosage`, `decrementDosage`, `openNumberPad`). The button names, `aria-pressed`, `data-testid`s, "Editing …" badge, live X/Y preview and disabled fieldset (STAT, interval, Reasons and other locks) are all unchanged.

## Tests

- New `apps/web/components/label/DosageScheduleDesign.test.tsx` (6 tests):
  - quantity 0 is neutral (no indicator, − disabled);
  - + selects softly (blue border, check badge, blue number, never `bg-primary` on the row or quantity block);
  - three increments then three decrements return to neutral;
  - X/Y ½ gives 1½ with soft highlight;
  - keyboard (Enter/Space, Shift+Tab to −);
  - STAT and interval modes keep the rows disabled.
- Two assertions that checked the **old solid-blue look** were updated to the new state: `DigitalLabel.test.tsx` (selected row now `data-selected` with a blue number) and `DosageQuantityControls.test.tsx` (pressed −/+ now `aria-pressed` with a ring). Their behaviour checks are unchanged.

| Check | Result |
|---|---|
| Full web Vitest | **56 files, 1,917 passed** (1,911 before + 6 new) |
| Web TypeScript | Passed |
| Web ESLint | Passed, 0 findings |
| Web production build | Passed |
| `git diff --check` | Passed |

## Browser verification (headless Edge, UI testing mode)

**9/9 passed at 1366×768, 1024×768 and 768×1024.**
- Quantity 0 and the selected states Morning 1, Lunch 2½ (via X/Y ½) and Night 3 were both checked.
- Rows were equal height, every control stayed inside the card, nothing overlapped, there was no horizontal scroll, and there were no console errors.
- Every selected row shows the check badge, and no row or quantity block takes the solid blue of the + button.

Screenshots (`shots/ds_<width>_zero.png`, `shots/ds_<width>_selected.png`) are in my session's scratchpad, not in the repository.

## Notes and remaining items

- **Dark theme:** the application defines a light theme only (no dark tokens). The redesign uses theme tokens throughout, so it will follow a dark theme if one is added.
- **Mobile:** the dosage rows wrap cleanly at narrow widths. The rest of the workstation keeps its fixed two-column layout, which is cramped below about 1024 px. That is unchanged and outside this task.
- The pressed ring stays on the last-pressed +/−, as the previous design's pressed colour did.
- The UI-testing banner still pushes the bottom bar about 30 px off a 768 px-high screen. This predates this change and occurs in UI testing mode only.
