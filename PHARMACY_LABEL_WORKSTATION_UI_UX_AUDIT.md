# Pharmacy Label Workstation — ENT Relocation and UI/UX Audit

**Date:** 2026-10-29
**Branch:** `codex/phase1-safety-fixes` (uncommitted; not deployed)
**Scope:** `/label` workstation (`apps/web/app/label/page.tsx` and `apps/web/components/label/*`)
**Changed in this task:** the ENT entry point only. All other findings are recommendations awaiting approval.

---

## Remediation status (updated 2026-10-30)

The findings below are the **original audit (2026-10-29)**. Remediation is reported in `PHARMACY_LABEL_WORKSTATION_UI_UX_REMEDIATION_REPORT.md`; after-screenshots are in `docs/ui-audit/label-workstation/after/`. Overall score: **6 → 7.5 / 10**.

| # | Finding (§10 roadmap) | Status |
|---|---|---|
| 1 | Lock reasons tooltip-only | **Fixed** — `aria-disabled` + guarded tap/Enter explanation, `aria-describedby`, lock glyph |
| 2 | Dosage Schedule locks silently | **Fixed** — reason under the heading, live region |
| 3 | BEFORE/AFTER/detail contrast | **Fixed** — all ≥ 4.73:1 (now neutral 17.85:1 / tint 6.16:1) |
| 4 | Expiry card nested controls, batch chooser unreachable | **Fixed** — sibling buttons, focus return |
| 5 | Label text truncated | **Fixed** — 2-line clamp + Show full text |
| 6 | No layout < 1024 px | **Partly fixed** — stacked layout, phone grid, sticky DONE, no overflow at 7 sizes; **toolbar blocked** (parallel session editing it) |
| 7 | Selection colours inconsistent | **Fixed** — one category map for tiles and chips |
| 8 | Duplicate controls | **Assessed, kept** — each is the only status view or recovery path (remediation report §9) |
| 9 | Admin idle hues | **Fixed** — neutral idle |
| 10 | Type scale | **Fixed** — 13/16 px labels, 2xl scaling, equal headings |
| 11 | Delete Label weight | **Fixed** — outlined; position unchanged |
| 12 | Sinhala typeface / `lang` | **Fixed** |
| 13 | 1920 whitespace | **Partly** — grid scales; dosage rows unchanged |
| 14 | Chip colour by substring | **Fixed** — by code |
| 15 | ENT panel heading | **Fixed** |
| 16 | `aria-expanded` | **Fixed** |
| 17 | Hard-coded hex | **Fixed** except decorative dosage illustrations |
| 18 | Runtime Google Fonts | Open (needs print verification) |
| 19 | UI-test banner overflow | **Fixed** |
| 20 | Dev indicator overlap | Open (dev-only, shared config) |
| 21 | `select-none` on preview | **Fixed** |
| 22 | Remove Address label swap | Kept by decision |

---

## 1. Executive summary

- **ENT is not an unnecessary button. It opens a unique clinical workflow.** ENT is the Eye / Ear / Nose administration workflow. It has its own sites, left/right/both direction, administration units ("drop/drops"), an English instruction template ("Instill {qty} {unit} into {location} {time}."), custom hours, start/end dates and validation. The button below the left grid was the **only** code path that opened it (`setActiveControl('ent')`).
- **Decision (approved during this task):** the ENT button was **removed from below the left action grid** and **moved into the Administration card** as a fifth button, after GIVE / TAKE / BEFORE / AFTER. ENT replaces oral Take/Give, so it belongs with administration. The empty row it occupied under the grid is gone, and the 5×4 grid now uses that height. No grid tile moved.
- No ENT business logic, store action, validation, print path or wording was changed. ENT's enabled rules are identical: disabled during STAT entry, when a Reasons refusal applies, and while a Till-to-the-Day range is active.
- **Verification:** `tsc` clean, ESLint clean, **1970/1970 tests pass** (59 files, including one new ENT regression test), production build passes, `git diff --check` clean. Live renders were captured at all six requested viewports.
- **Audit headline.** The workstation has a clean token-based look, large touch targets, visible keyboard focus, and strong engine-driven validation.
  - **Main weaknesses:**
    - Disabled and locked states are explained only in hover tooltips, which touch screens never show.
    - The selected-state colour system is defined but not applied, so tiles and chips disagree.
    - Two text/background pairs fail WCAG AA.
    - Some controls are duplicated (Expiry, Evening confirmation).
    - Layout below 1024 px wide is cramped, and at phone width it is unusable.
  - **Overall UX score: 6/10.** No P0 (clinical safety) issue was found in the UI layer.

---

## 2. Current UI assessment

The workstation is a fixed-height, full-viewport screen (`h-[100dvh]`, `overflow-hidden`):

| Region | Component | Notes |
|---|---|---|
| Top toolbar (84 px fixed) | `ProductToolbar` | Customer, more, product search + barcode, alternative product, product qty, Home |
| Left column (1.15fr) | `InstructionGrid` | Selected Instructions card (chips, alerts, label-text preview) + 5×4 action grid |
| Right column (1fr) | `ActionWorkspace` | Dosage Schedule (Morning/Lunch/Night) **or** the open action's panel; Administration card always below |
| Bottom bar (76 px fixed) | `BottomActionBar` | Expiry Date card, label navigation (Label N of M), DONE |

**Strengths, from the code and the renders:**

- **Design tokens:** one token set (`app/globals.css` `@theme`) shared with the admin pages. Radius is 8–10 px, borders are hairline, and the primary colour is a single blue.
- **Stable layout:** the "panel opens on the right, grid stays on the left" model (`ActionWorkspace`) is consistent, so the grid never moves under the user's finger.
- **Readiness analysis:** Administration status ("Next: …", "Complete"), DONE and the tile states all come from one engine (`analyseAdministration`), so the guidance and the final check never disagree.
- **Non-colour cues already exist:**
  - a check badge on selected tiles;
  - an "Active" text plus a left accent bar on dosage rows;
  - dashed outlines for required steps;
  - `aria-pressed` on toggles.
- **Keyboard:** every focus stop showed a visible ring (40-stop Tab walk, §6).

---

## 3. ENT removal and dependency findings

### 3.1 Does ENT provide a unique clinical workflow? Yes.

| Dependency | Location | Role |
|---|---|---|
| Data model / wording | `apps/web/lib/ent.ts` | `ENT:v1:` instruction code, sites (eye/ear/nose/throat), direction, units, template, `validateEnt`, `entInstructions` |
| Panel | `components/label/EntPanel.tsx` | Site, direction, 4H/5H/6H/8H/Daily/Evening, Customize Hours, Start/End Day, Add/Delete Label |
| Store | `store/labelStore.ts` `setEnt` | Refuses ENT with a weekday range or a Reasons refusal |
| Workspace routing | `components/label/ActionWorkspace.tsx` | `activeControl === 'ent'` → `EntPanel` |
| Chip | `SelectedInstructionsPanel.tsx` | Shows the ENT sentences; × removes ENT (`setEnt(null)`) |
| Engine / policies | `instructionEngine.ts`, `intervalPolicy.ts`, `nameOfDays.ts`, `reasons.ts`, `LabelActions.tsx` (Weekly/Daily/Evening exclusions) | ENT bypasses oral product-type rules and keeps its own frequency editor |
| API | stored as `instructions_json.ent` | Unchanged |
| Tests | `EntPanel.test.tsx`, `CompactQuantity`, `Daily`, `Evening`, `Eod`, `Intervals`, `Weekly`, `StatWorkflow`, `TillToDay`, `UsbAdministration`, `ProductTypePrinting`, `Reasons` | All pass |

**Entry points before the change:** exactly one, the `entTile` rendered in its own row below the grid (`InstructionGrid.tsx`, an 80 px-wide `GridTile` in a `flex` container). Product types contain no ENT category, so ENT cannot be reached automatically. Removing the tile outright would have silently disabled a working clinical feature.

### 3.2 What was changed

| File | Change |
|---|---|
| `components/label/InstructionGrid.tsx` | Removed `entTile` and its wrapper row (`<div className="flex gap-2 shrink-0"><div className="w-20 …">`); removed now-unused imports (`Stethoscope`, `readEnt`, `hasWeekdayRange`). The 20 grid tiles, their order and their rules are unchanged. |
| `components/label/LabelActions.tsx` | Added an **ENT** button as the 5th Administration button (`grid-cols-4` → `grid-cols-5`). It has the same enabled rule as before: `isStatStep(activeControl) \|\| reasonSelectionRefusal(label,'ENT') \|\| hasWeekdayRange(label)`. It calls the same `setActiveControl('ent')`, shows selection (solid blue + check) when an ENT selection exists, and is never marked "required". The existing button classes were factored into shared constants with no visual change, plus `min-w-0` so five buttons can shrink. The card is an `@container`: icons hide below 440 px card width (portrait tablet) so the labels never overlap. |
| `components/label/ActionWorkspace.test.tsx` | The ENT test now asserts ENT is **not** in the left grid and **is** in the right column. A new test asserts the preserved enabled rules (STAT, weekday range) and the selected indicator. |
| `components/label/DayActions.test.tsx` | Grid selector scoped to the left column; it previously matched any `.grid-cols-5`, which now includes the Administration row. Asserts ENT is not in the grid. |

**Not changed:** `lib/ent.ts`, `EntPanel.tsx`, the store, the instruction engine, print and labelling code, Sinhala wording, dosage calculations, the backend and the database.

### 3.3 How ENT remains accessible

Workstation → **Administration** card (right column, below the Dosage Schedule) → **ENT**. This opens the same "ENT Administration" panel on the right. An existing ENT selection is shown by the selected ENT button and by its chip in Selected Instructions; × on the chip still removes it. Accessible name: "ENT"; tooltip: "Eye, ear or nose administration".

Evidence: `docs/ui-audit/label-workstation/state-ent-panel.png`, `state-ent-eye.png`.

---

## 4. Component-by-component findings

### A. Action button grid (`InstructionGrid` + `GridTile`)

| Aspect | Finding | Evidence |
|---|---|---|
| Dimensions | 5×4, rows `minmax(0,1fr)`, `min-h-14` (56 px). Measured tile size: ≈131×106 px at 1366×768, ≈190×184 at 1920×1080, ≈67×170 at 768×1024. Every tile is ≥ 44 px in both dimensions down to 768 px. | `metrics.json`, renders |
| Icon size | 20 px (22 px on Delete/Add). Proportionate at 1366; very small relative to a 190×184 tile at 1920. | `label-1920x1080.png` |
| Text | 12 px bold, `line-clamp-2`, centred. Wraps to two lines at 1024 ("Remove Address", "Empty Stomach") and at 768. No clipping from 768 px up. | renders |
| Spacing | 8 px gap, 12 px card padding; consistent. | code |
| Selected state | **Always solid blue + white check badge.** Each tile's `selectedClass` (orange Evening, red STAT, purple 8H, green Daily…) is computed but never used, because `GridTile` hard-codes `SELECTED.solidBlue`. | `InstructionTile.tsx` (`tile.selected ? SELECTED.solidBlue`) |
| Quantity detail | "1 each", "3 days" in 10 px, `#bfdbfe` on `#2563eb` = **3.64:1** (below 4.5:1). | §6 |
| Disabled state | Two visual variants: workspace lock (`opacity-40`) and policy lock (`opacity-45` + dashed border; the dash is barely visible at 45%). The reason is only in `title`. | `state-evening-quantity.png`, `state-stat.png` |
| Requires-input / invalid | Dashed amber outline / solid red outline. Distinguishable by pattern, not only colour. | code |
| Hover / focus | Hover: `bg-surface` + blue border. Focus: 2 px primary ring with offset (visible in renders). | `state-keyboard-focus.png` |
| Colour | Idle icon colours are category-coded (blue, orange, red, purple, green), but the same category is shown in a different colour in the chip and tile (see F). | renders |
| Hierarchy | Delete Label (solid red) and Add Label (solid green) are the heaviest elements in the grid, heavier than any instruction. Delete sits beside Add in the same size and shape. | renders |
| Clickable area | The whole tile is the button. Good. | code |
| Keyboard | Native `<button>`s, logical row order (Reasons → 8H), `aria-pressed` on toggles. `aria-expanded` is not set on panel-opening tiles (Reasons, Days, STAT, EXP). | Tab walk, code |

Per-button notes:

| Button | Behaviour | Note |
|---|---|---|
| Reasons | Opens the Reasons panel in place of the Dosage Schedule; detail "N selected" | Good |
| Days / Name of Days | Open their panels on the right; detail shows the value | Good |
| 5H / 6H / 8H | Toggle + compact quantity editor | 8H idle icon is purple, 5H/6H are blue: same concept, different colour |
| Evening | Toggle + quantity editor; locks the Dosage Schedule and other schedules | See H: duplicate confirmation |
| Weekly / Daily / EOD | Toggle; Weekly/Daily have a second confirm in the Administration card | Duplicate confirm surface |
| STAT | Opens a 3-step STAT flow; red label text when idle | Locked by most schedules; the reason is in the tooltip only |
| Remove Address | Toggle; label changes to "Address Hidden" | The label describes the action when idle and the state when selected; consistent wording would help |
| EXP Date | Same action as the bottom-bar Expiry card | Duplicate control |
| Empty Stomach / With Food / Chewable / Dissolve and Drink / Keep in Mouth | Toggles with mutual-exclusion policies | Good |
| Delete Label / Add Label | Solid red / green action tiles | Destructive action next to a frequent one |

### B. Selected button design

- **Recognisability:** a selected tile is unmistakable (solid blue, white text, white check badge top-right). Contrast is white on `#2563eb` = 5.17:1 (passes).
- **Consistency issues:**
  1. Every category turns the same blue, while its chip uses a category colour (EVENING chip amber, tile blue, idle icon orange). One concept appears in three colours.
  2. Administration buttons use the same solid blue but a smaller badge (14 px vs 16 px). Dosage rows use a different idiom: tinted background, 6 px accent bar, "Active" text, no check.
  3. `SELECTED` defines nine variants (`blue, teal, orange, red, stat, amber, purple, green, solidBlue`); the grid uses only `solidBlue`. This is dead design surface that suggests a different intended design.
- **Quantity display:** the per-dose quantity appears inside the selected tile at 10 px with low contrast, and again in the chip ("EVENING: 1 each"). The chip is the more readable of the two.
- **Recommendation:** keep the one selection treatment that already works: solid primary fill + white check badge (shape cue) + `aria-pressed`. Apply it identically to grid tiles, Administration buttons and ENT panel tiles. Keep category colour only for **idle icons** and **chips**, and make each chip's colour match its tile's idle icon. Raise the in-tile quantity to ≥ 12 px in white (5.17:1). Delete the unused `SELECTED` variants once approved.

### C. Disabled button design

- **Can users tell why a tile is disabled?** Only by hovering a mouse (`title=stateHint`). On a touch till (the design target: `touch-manipulation`, large tiles) there is no explanation at all. Screen readers announce "dimmed/unavailable" with no reason, because the hint is not linked through `aria-describedby`.
- **What must happen first?** The policy messages are good ("Remove Till to the Day before choosing an incompatible workflow."), but they are invisible in practice.
- **Disabled vs unselected:** distinguishable (faded vs full). Disabled because a panel is open vs disabled by a clinical rule look almost the same: the dashed border is nearly invisible at 45% opacity.
- **Dosage Schedule:** while Evening (or another non-digital schedule) is selected, the whole Morning/Lunch/Night fieldset is disabled with **no message in the card** (`state-morning-dose.png`).
- **Recommendation (rules unchanged):**
  - On tap of a locked tile, show the existing `stateHint` in a non-blocking inline status line. The `workflowNotice` slot in Selected Instructions already exists. Use `aria-disabled` instead of `disabled` so the tap can be received.
  - Add a small lock glyph to policy-locked tiles. Keep the plain fade for "panel open".
  - Link hints with `aria-describedby`.
  - Show one line in the Dosage Schedule header when it is locked ("Locked by Evening — remove Evening to use Morning/Lunch/Night").

### D. Layout and spacing

| Area | Finding |
|---|---|
| Left grid | Even 8 px gaps. Since the ENT row was removed, the grid fills the column; no orphan row. At 1920×1080 tiles are 190×184 px holding a 20 px icon and 12 px text, which leaves a lot of empty space. |
| Right instruction editor | The panel replaces the Dosage Schedule in place; Cancel / Done (Next) are at the bottom of the panel. Consistent across Evening, intervals, Weekly and Daily. |
| Selected Instructions | Chips are on one non-wrapping, horizontally scrolling line. The label-text preview is one truncated line (full text only in `title`). Alerts stack above the chips and push the grid down. |
| Dosage Schedule | Good proportions at 1366–1920. At 768 px the Morning/Lunch/Night rows wrap so X/Y and −/+ drop to a second line (row height ≈ 205 px). |
| Administration | Header with workflow badge + "Next:" status. Weekly/Daily/Evening add a second row of confirm buttons ("Done — enable Digital Label", "Back from Evening") that duplicates the panel's Done/Cancel. |
| Bottom bar | Fixed 76 px; the Expiry card is a `div role="button"` with a nested `<button>`. Label navigation is centred. DONE is the strongest element on the screen (correct). |
| Fixed heights | The 84 px header and 76 px footer are fixed. In UI-test mode the 25 px banner sits above a 100dvh `<main>`, so the page is 25 px taller than the viewport at every size and DONE is partially below the fold. In production the banner is not rendered and `<main>` fits exactly. |
| Simplification candidates | EXP Date tile vs Expiry card (same action); Evening/Weekly/Daily confirm in two places; Remove Address label toggling text. |

### E. Typography

- **UI font:** system stack (`ui-sans-serif, system-ui, "Segoe UI"…`). Computed sizes in use: 10, 11, 12, 14, 16, 24, 30 px.
- **Button labels:** 12 px bold on grid tiles. Readable at arm's length on 1366; small for a touch station, and does not scale up at 1920.
- **Section headings:** 14–16 px bold ("Selected Instructions" 14 px, "Dosage Schedule" 16 px, "Administration" 14 px). These are inconsistent sizes for peer headings. The ENT panel heading is 14 px **blue**, while the other panel headings are dark.
- **Instruction quantities:** dosage QTY 24–30 px black is clear. Tile detail is 10 px (low contrast, see B). The "QTY" / "X / Y" captions are 10 px uppercase.
- **Helper/status text:** 10–11 px ("Next: …", "Active", time ranges). Usable but at the lower limit.
- **Sinhala:** the label-text preview shows Sinhala (e.g. "හවසට") in the **system** font (Nirmala UI on Windows). The printed label uses `'Gemunu Libre', 'Noto Sans Sinhala', 'Iskoola Pota', 'Nirmala UI'` (`PrintableLabel.tsx`), so the on-screen preview does not use the print typeface. The `.sinhala-text` class exists but is not applied to the preview. Fonts load from Google Fonts at runtime; an offline till falls back to system fonts.
- **Errors:** 12 px bold red on a red-soft background with an icon and `role="alert"`. Readable.
- **Chips:** 12 px semibold, uppercase codes ("EVENING", "ENT: the left eye"). The mix of uppercase codes and sentence-case ENT text reads inconsistently.

### F. Colours (no colours changed in this task)

| Colour | Where used today | Issue |
|---|---|---|
| Blue `primary #2563eb` | Selection (all), primary buttons, GIVE idle, most idle icons, ENT | Overloaded, but consistent as "selected/primary" |
| Green `success #047857`, `#16A34A` | DONE, Add Label, Daily icon, AFTER idle, "Complete" | AFTER is green although it has nothing to do with success; `#16A34A` on `#F0FDF4` fails contrast |
| Red `danger #b91c1c` | Delete Label, STAT label/icon, Remove Address, Keep in Mouth / Empty Stomach icons, errors | STAT, Keep in Mouth and Empty Stomach are not destructive, but share the destructive/error colour |
| Purple `#7C3AED` (hard-coded) | With Food, Chewable, 8H icons, TAKE idle, chips | Not a token; no semantic meaning |
| Orange `#F97316`, `#EA580C` (hard-coded) | Evening icon, BEFORE idle | Not tokens; `#F97316` icon on white is 2.80:1 (below the 3:1 non-text minimum) |
| Amber `warning #b45309` | "Next:" status, required outlines, Evening/Empty Stomach chips | Mixed: workflow guidance vs instruction category |
| Teal `#0D9488` | Till-to-day chip icon | Hard-coded |
| Neutral slate | Borders, idle tiles, disabled | Fine; `#e2e8f0` borders are 1.23:1 on white (decorative only, acceptable) |

Recommended semantic system (proposal only):

| Role | Token | Use |
|---|---|---|
| Primary / selected | `primary` | Selected state everywhere, primary actions |
| Confirm / complete | `success` | DONE, "Complete", Add Label |
| Destructive / error | `danger` | Delete Label, Clear All confirm, errors, blocking validation |
| Attention / next step | `warning` | "Next:" guidance, required outlines, pending notices |
| Urgent clinical flag | `danger` text only on STAT | Keep STAT red, but as text/icon only, never the destructive fill |
| Neutral | slate | Idle controls, disabled, captions |
| Category accent (optional) | new `cat-*` tokens | Idle icon + chip only, never selection or status |

### G. Responsive design (measured in headless Edge; see §7)

| Viewport | Horizontal overflow | Clipped labels | Notes |
|---|---|---|---|
| 1920×1080 | none | none | Oversized tiles and dosage rows; lots of empty space |
| 1440×900 | none | none | Balanced |
| 1366×768 | none | none | Balanced; the most likely till size |
| 1024×768 | none | none | Toolbar text truncates ("Customer Name / Mobile" wraps, product placeholder cut); grid labels wrap to 2 lines |
| 768×1024 | none | none (after the icon fix) | Two columns are kept in portrait; dosage rows wrap; toolbar crowded (product qty ≈ 16 px wide value); Administration icons hidden by the container query |
| 390×844 | none at document level | **20 controls clipped** | Not usable: grid tiles 27 px wide, dosage +/− buttons off-screen, toolbar overlapping. No phone layout exists |

Sticky bottom actions: the bottom bar is part of a fixed-height flex column, not `position: sticky`; it is always visible in production. Touch targets: all controls are ≥ 24×24 px (WCAG 2.2 AA 2.5.8) from 768 px up. Below the common 44 px touch guidance: product-qty −/+ (36 px), barcode (36 px), batch chooser (36 px), label prev/next (40 px), chip remove × (32 px).

### H. Workflow usability

| # | Workflow | Taps (best case) | Observations |
|---|---|---|---|
| 1 | Select a medicine | Search → pick | Toolbar search with barcode. UI-test mode cannot load catalogue data, so this was not exercised |
| 2 | Add dosage | `+` per row, or tap QTY → number pad, X/Y for fractions | Large, clear controls. The "Active" text and accent bar are a good non-colour cue |
| 3 | STAT | STAT → qty → administration → follow-up | Multi-step panel. STAT is disabled by most schedules (ENT, Evening, intervals); the reason is tooltip-only |
| 4 | 5H/6H/8H | Tile → qty → Done (Next) | Locks the Dosage Schedule. Good "Next:" guidance in Administration |
| 5 | Evening | Tile → qty → Done (Next) | **Cancel keeps Evening selected** with "Next: Enter the quantity for EVENING". A second "Done — enable Digital Label / Back from Evening" pair appears in Administration. Two confirm surfaces for one step |
| 6 | Days | Tile → panel → Enter | Clear; the value shows on the tile |
| 7 | Name of Days | Tile → weekday panel (Sinhala day names) → Enter; Till to the Day inside the panel | Clear; disabled reasons tooltip-only |
| 8 | Reasons | Tile → list replaces Dosage Schedule → Enter / Omit reasons | Good; the Sinhala list is readable |
| 9 | Expiry | EXP tile **or** Expiry card; batch chooser via the small calendar button | Duplicate entry points; batch chooser not keyboard-reachable |
| 10 | Review & print | DONE → review page → Print/Save | Strong guard rails (many print-error checks). On the workstation the label text preview is a single truncated line |
| 11 | Multiple labels | Add Label → navigate with ‹ › | "Label N of M" is clear. Add Label sits next to Delete Label |
| 12 | Remove / modify | Chip × or re-tap tile; Clear All with 2-tap confirm (4 s) | Good. Chip × is 32 px |

---

## 5. UI/UX scorecard

Scores are based on the code and live renders at the six viewports. **No usability testing with pharmacists was performed.**

| Category | Score | Evidence and reasoning |
|---|---|---|
| Visual Design | **7/10** | Clean single token set, consistent radius/borders/shadows, clear card structure, DONE has the right weight. Deductions: colour noise from hard-coded hues, oversized sparse tiles at 1920, Delete/Add as the heaviest grid elements. |
| Layout Consistency | **6/10** | The stable two-column "panel on the right" model is a real strength. Deductions: duplicated controls (EXP ×2, Evening/Weekly/Daily confirm ×2), mismatched peer heading sizes, the ENT panel styled differently (no icons, blue heading), the dosage row reflows at 768. |
| Button Usability | **6/10** | Large whole-tile targets, clear icons, check badges, `aria-pressed`, visible focus. Deductions: lock reasons invisible on touch, two near-identical disabled looks, destructive tile beside a frequent one, 10 px quantity detail. |
| Color Consistency | **5/10** | Tokens exist and are good, but nine selected variants go unused; one concept appears in up to three colours; green/red carry non-semantic meanings (AFTER, Keep in Mouth); five hard-coded hues outside tokens. |
| Typography | **6/10** | Strong dosage numerals; consistent bold labels. Deductions: 10–12 px for key labels and helpers on a touch station, no scaling at large sizes, Sinhala preview not in the print typeface, single-line truncated label preview. |
| Accessibility | **6/10** | Focus ring at every stop; logical tab order; `aria-pressed`/`aria-label` widely used; alerts use `role="alert"`; most text pairs pass AA. Failures: BEFORE 3.35:1, AFTER 3.15:1, tile detail 3.64:1; lock reasons not exposed to AT; nested interactive Expiry card; batch chooser `tabIndex=-1`. |
| Responsive Design | **4/10** | Solid from 1024×768 to 1920×1080 landscape. Portrait 768 is cramped but functional; 390 px is unusable; fixed 84/76 px bars; no stacked layout. |
| Workflow Efficiency | **7/10** | Common tasks take one or two taps; quantity steps follow tile taps automatically; "Next:" guidance; Clear All confirm; panel model avoids navigation. Deductions: duplicate confirm surfaces, exploration cost from hidden lock reasons. |
| Error Handling | **7/10** | Single-engine validation, specific messages, `role="alert"`, extensive print/save guards (heavily tested). Deductions: messages appear far from the control, the locked Dosage Schedule is silent, tooltip-only lock reasons. |
| **Overall UX** | **6/10** | A capable, safe workstation for landscape desktop/tablet whose main gaps are communication of state (why locked, what is selected) and consistency, not missing capability. |

---

## 6. Accessibility findings

**Contrast (WCAG 2.2 AA, computed from the actual hex values):**

| Pair | Ratio | Result |
|---|---|---|
| White on primary (selected tile/button) | 5.17 | Pass |
| Primary on white / on primary-soft | 5.17 / 4.75 | Pass |
| Subtle `#64748b` on white / on surface | 4.76 / 4.55 | Pass (narrowly) |
| Danger on white / on danger-soft | 6.47 / 5.91 | Pass |
| Warning on warning-soft ("Next:") | 4.84 | Pass |
| White on success (DONE, Add Label) | 5.48 | Pass |
| TAKE `#7C3AED` on `#F7F3FF` | 5.22 | Pass |
| **BEFORE `#EA580C` on `#FFF7ED`** | **3.35** | **Fail** (14 px bold needs 4.5) |
| **AFTER `#16A34A` on `#F0FDF4`** | **3.15** | **Fail** |
| **Tile detail `#bfdbfe` on `#2563eb`** | **3.64** | **Fail** (10 px) |
| Evening icon `#F97316` on white | 2.80 | Below the 3:1 non-text minimum (the icon is redundant with the text, so lower impact) |
| Disabled content (≈40% opacity) | ≈2.5 | Exempt (inactive), but hard to read |

**Keyboard navigation:** a 40-stop Tab walk at 1366×768 visited toolbar → 20 grid tiles in reading order → dosage rows → Administration. Every stop showed a focus indicator (`state-keyboard-focus.png`). Gaps:

- The batch chooser in the Expiry card has `tabIndex={-1}`, so it is unreachable by keyboard.
- The Expiry card is a `div role="button"` containing a `<button>` (nested interactive controls).
- Panel-opening tiles lack `aria-expanded`/`aria-controls` (the ENT panel tiles do use them).

**Screen-reader labels:** good on dosage rows ("Morning quantity: 0. Enter quantity"), Administration ("Give medication"), chips ("Remove EVENING"), DONE. Grid tiles use their visible text. The quantity detail is part of the name ("Evening 1 each"), which is acceptable.

**Disabled-control explanations:** not exposed to assistive technology, and not visible on touch (see C).

**Touch targets:** see G. All targets meet 2.5.8 (24 px) from 768 px up; several are below the 44 px touch guideline.

**Sinhala:** renders correctly with the system font (Nirmala UI) on Windows in the preview and in the Reasons/Name of Days panels; print uses Gemunu Libre / Noto Sans Sinhala. `lang="si"` is not set on Sinhala runs, so screen readers may mispronounce them.

**Not colour alone:** selection = fill + check badge + `aria-pressed`; required = dashed outline + "Next:" text; invalid = outline + alert text. Policy-locked vs panel-locked relies on a faint dash (weak). Admin idle hues carry no meaning, so they are not a colour-only issue.

**Errors:** specific, plain-English, `role="alert"`, icon + text. They appear in the Selected Instructions card, not next to the offending control.

---

## 7. Responsive design findings

Method: headless Microsoft Edge driven over the DevTools protocol against the local dev server in UI-test mode. No database: every API call is short-circuited by `lib/api/server.ts`. Six viewports were measured, recording document overflow, every visible button's size, label clipping and off-screen controls (results summarised in §4 G).

Key points:

1. **1024–1920 landscape: no overflow, no clipping.** This is the supported envelope today.
2. **768×1024 portrait: functional but cramped.** The two-column layout is kept; dosage rows wrap; the toolbar truncates; Administration icons are hidden (new container query) so all five labels fit (57 px buttons).
3. **390×844: unusable.** There is no single-column layout; 20 controls are clipped and the dosage +/− buttons are off-screen. Needs a product decision on whether phones are in scope.
4. **UI-test banner:** +25 px document height at every size (test mode only), pushing the bottom of DONE below the fold for testers.
5. **Real browser viewports:** a 1366×768 screen with browser chrome usually gives about 1366×650 of viewport. That size was not measured here; the fixed-height design will compress the grid and dosage rows further.

---

## 8. Workflow usability assessment

Summary of §4 H:

- **Unnecessary clicks:** few. The main extras are the second confirmation for Evening/Weekly/Daily in the Administration card, and choosing between the two Expiry entry points.
- **Confusing states:**
  - (a) Tiles locked by clinical policy look like tiles locked by an open panel, with no visible reason.
  - (b) Cancel on the Evening quantity keeps Evening selected (intentional, but the result is only explained by "Next:").
  - (c) The Dosage Schedule disables silently while a non-digital schedule is selected.
  - (d) After ENT is configured, STAT/EOD become disabled with no visible explanation (`state-stat.png`).
- **Missing feedback:** the full label text is visible only via hover (truncated preview). The selected-tile quantity is hard to read.
- **Strong points:**
  - one-tap toggles;
  - quantity steps open automatically;
  - "Next:" guidance from the same engine as DONE;
  - Clear All 2-tap confirmation;
  - Delete Label confirmation on the right;
  - extensive print guards.

---

## 9. Screenshots and visual evidence

**About the uploaded screenshot:** the task referred to an uploaded screenshot, but no image reached this session. All evidence comes from live renders of the current code, taken after the ENT move, in `docs/ui-audit/label-workstation/`:

| File | Shows |
|---|---|
| `label-1920x1080.png`, `label-1440x900.png`, `label-1366x768.png`, `label-1024x768.png`, `label-768x1024.png`, `label-390x844.png` | Default workstation per viewport; ENT in Administration, no row under the grid |
| `state-evening-quantity.png` | Evening selected, quantity panel open, all tiles workspace-locked |
| `state-morning-dose.png` | After Cancel: Evening still selected, Dosage Schedule silently disabled, policy-locked tiles, duplicate Evening confirm in Administration |
| `state-ent-panel.png`, `state-ent-eye.png` | ENT opened from the Administration card; Eye/LEFT selected; ENT chip; ENT button selected |
| `state-stat.png` | ENT + Evening configured; STAT/EOD/Name of Days policy-locked |
| `state-keyboard-focus.png` | Visible focus ring on a grid tile during the Tab walk |

---

## 10. Prioritised improvement roadmap (awaiting approval; none implemented)

Effort: S ≤ ½ day, M ≈ 1–2 days, L ≥ 3 days. Regression risk refers to clinical behaviour and the test suite.

### P0 — Critical

None identified in the UI layer. Clinical validation, print guards and wording are engine-driven and covered by 1970 tests. ENT access was preserved rather than lost.

### P1 — High

| # | Problem | Component | Evidence | Recommended solution | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | Locked tiles give no reason on touch or to screen readers | `GridTile`, `InstructionGrid.decorate` | `title={tile.stateHint}` only; `state-stat.png` | Use `aria-disabled` + tap → show `stateHint` in the existing notice slot; `aria-describedby`; lock glyph for policy locks. Rules unchanged | M | Medium: many tests assert `disabled`; update assertions, not rules |
| 2 | Dosage Schedule disables silently | `DosagePanel` fieldset | `state-morning-dose.png` | One status line in the card header naming the locking instruction (reuse the refusal string) | S | Low |
| 3 | BEFORE / AFTER text fails AA; tile detail fails | `LabelActions` `BUTTONS`, `GridTile` detail | 3.35 / 3.15 / 3.64 | Use `warning`/`success` tokens (4.84 / 5.21) for those labels; detail in white ≥ 12 px | S | Low (visual only) |
| 4 | Expiry card: nested interactive controls, batch chooser unreachable by keyboard | `BottomActionBar` | `role="button"` div + inner button `tabIndex={-1}` | Two sibling buttons (toggle expiry, choose batch), both focusable | S | Low–Medium (expiry tests) |
| 5 | Full label text not visible before DONE | `SelectedInstructionsPanel` preview | `truncate` + `title` | Clamp to 2–3 lines with an expand control; use `.sinhala-text` | S | Low |
| 6 | No layout for < 1024 px width (390 unusable, 768 cramped) | `app/label/page.tsx`, toolbar, dosage rows | §7 | Decide supported devices first. If tablets are in scope: stacked layout below 1024 with the grid above and the workspace below, and a toolbar that collapses | L | Medium |

### P2 — Medium

| # | Problem | Component | Evidence | Recommended solution | Effort | Risk |
|---|---|---|---|---|---|---|
| 7 | Selection colours inconsistent; nine unused variants | `InstructionTile.SELECTED`, chips | §4 B | One selection idiom (solid primary + check); category colour only on idle icon + chip, matched; remove unused variants | M | Low |
| 8 | Duplicate controls | EXP tile vs Expiry card; Evening/Weekly/Daily confirm in Administration vs panel | renders | Keep one entry point per action (product decision) | M | Medium (tests assert both) |
| 9 | Admin idle hues have no meaning (green AFTER) | `LabelActions` | §4 F | Neutral idle style for all five; selection blue | S | Low |
| 10 | Type scale too small for a touch station; no large-screen scaling | Grid, helpers | 12 px labels on 190 px tiles | Tile labels 14 px (16 px ≥ 1600 w), helpers ≥ 12 px, icons 24–28 px at large sizes | S–M | Low |
| 11 | Delete Label beside Add Label, same size | Grid row 4 | renders | Separate destructive action (e.g. last cell, outline style) | S | Medium: moves a button (needs approval) |
| 12 | Sinhala preview not in the print typeface; no `lang="si"` | Preview, chips, panels | §4 E | Apply `.sinhala-text` and `lang="si"` to Sinhala runs | S | Low |
| 13 | Excess whitespace at 1920 | Grid, Dosage rows | `label-1920x1080.png` | Cap row heights / scale content with a container query | M | Low |
| 14 | Chip colour chosen by substring of the label text | `getChipStyle(chip.label)` | code | Key chip style off the instruction code | S | Low |
| 15 | ENT panel visually differs (no icons, blue heading) | `EntPanel` | `state-ent-panel.png` | Align heading style; optional icons | S | Low (tests assert no icons in ENT, so update deliberately) |
| 16 | Panel-opening tiles lack `aria-expanded` | `InstructionGrid` | code | Set `expanded`/`controls` like the ENT panel | S | Low |

### P3 — Low

| # | Problem | Component | Recommended solution | Effort | Risk |
|---|---|---|---|---|---|
| 17 | Hard-coded hex colours (`#7C3AED`, `#F97316`, `#EA580C`, `#16A34A`, `#0D9488`) | Several | Move to tokens | S | Low |
| 18 | Runtime Google Fonts import (offline tills fall back) | `globals.css`, `PrintableLabel` | Self-host fonts | S | Low (print check needed) |
| 19 | UI-test banner adds 25 px overflow | `UiTestControls` + `main` | Subtract the banner height in test mode | S | Low |
| 20 | Next.js dev indicator overlaps DONE (dev only) | `next.config` | Move or disable `devIndicators` | S | None |
| 21 | `select-none` on the whole workstation prevents copying label text | `page.tsx` `<main>` | Allow selection on the preview text | S | Low |
| 22 | "Remove Address" ↔ "Address Hidden" label swap | Grid | Stable label + selected state | S | Low |

---

## 11. Recommended design standards

1. **Selection:** solid `primary` fill, white text, white check badge (top-right, 16 px), `aria-pressed="true"`. Identical on grid tiles, Administration and panel tiles.
2. **Disabled:**
   - "Unavailable now" (panel open): 40% opacity, no glyph.
   - "Blocked by rule": 50% opacity + lock glyph + reason on tap and via `aria-describedby`.
   - Never rely on `title` alone.
3. **Required / next step:** dashed `warning` outline + "Next: …" text. **Invalid:** solid `danger` outline + alert text.
4. **Colour semantics:** primary = selection/primary action; success = complete/confirm; danger = destructive/error (STAT as red text only); warning = guidance; neutral = idle/disabled. Category hues only on idle icons and matching chips, from tokens.
5. **Contrast:** all text ≥ 4.5:1 (≥ 3:1 only for ≥ 18.66 px bold); icons and focus indicators ≥ 3:1.
6. **Targets:** ≥ 44×44 px for every touch control (24 px is the AA floor); 8 px minimum spacing.
7. **Type scale:** 12 (captions, minimum), 14 (labels/body), 16 (section headings, all peers equal), 24–30 (quantities). Sinhala runs use `.sinhala-text` and `lang="si"`.
8. **Focus:** keep the existing 2 px primary ring with 2 px offset; no `tabIndex={-1}` on actionable controls.
9. **One entry point per action** unless a duplicate is a deliberate shortcut and documented.
10. **Breakpoints:** design for 1366×650 (real till viewport) as the minimum landscape target; decide explicitly whether portrait tablet and phone are supported.

---

## 12. Verification results

All commands were run locally in `apps/web` on 2026-10-29.

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p .` | **Pass** (exit 0, no errors) |
| Lint | `npx eslint .` | **Pass** (exit 0) |
| Tests (full web suite) | `npx vitest run` | **Pass: 59 files, 1970 / 1970 tests** (1969 before + 1 new ENT test) |
| Relevant tests | `ActionWorkspace.test.tsx`, `DayActions.test.tsx`, `EntPanel.test.tsx` | Pass (58 / 58) |
| Production build | `npx next build` | **Pass** (all routes compiled, incl. `/label`, `/label/print-check`) |
| Whitespace | `git diff --check -- apps/web` | **Pass** (only Git's LF→CRLF notices, no whitespace errors) |
| Action grid works | Live render + automated clicks (Evening, Cancel, ENT, Eye, Done, STAT); tests assert 20 tiles and each tile's behaviour | Pass; grid still 5×4 with 20 tiles in the original order |
| ENT reachable | Live click from Administration opens the ENT panel; test asserts location and enabled rules | Pass |
| No unrelated clinical change | Only the files in §3.2 were edited; no change to `lib/`, store, engine, print, wording, backend or database | Confirmed by edit list. `git diff` on these two component files also contains earlier uncommitted work from this branch, so the edit list above is the authoritative record |

**Not done (as instructed):** no commit, push, deploy or migration, and no remote database contact. The screenshot run used the existing local dev server in UI-test mode, where all backend calls are disabled. Feature #21 and #22 staging verification remains **pending**.

---

## 13. Remaining issues and limitations

- **Uploaded screenshot not received:** visual evidence comes from live renders instead.
- **No usability testing:** scores reflect expert review of code and renders only.
- **No catalogue data in UI-test mode:** product selection and catalogue-driven states (product types, GRN batch expiry) were not exercised visually.
- **Real-world viewports not measured:** 1366×650 (browser chrome) and actual till hardware were not measured, and neither were screen-reader runs (NVDA/JAWS).
- **Print output not re-checked visually:** print code was not touched; the print-related tests pass.
- **Wider stored ENT site list:** `lib/ent.ts` accepts `throat` as a stored site, but the ENT panel offers only Eye / Nose / Ear. This was pre-existing and is unchanged.
- **Interaction with existing uncommitted work:** `InstructionGrid.tsx` and `LabelActions.tsx` already had uncommitted changes on this branch before this task, so review §3.2 together with that work.
- **Pending decisions:** all P1–P3 recommendations await review and approval. Items 6 and 8 need product decisions (device support; single entry points).
