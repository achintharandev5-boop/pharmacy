# Label Workstation: Button Logic Audit

Date: 2026-10-10 · Branch `feature/ui-ux-redesign` · Scope: `/label` (the label workstation) only.

**Status.** Every visible button on the workstation was audited, 19 defects were fixed, and every control now has an automated test. Unit and component tests: 177 pass (91 before). Browser tests: 110 of 110 checks pass in Microsoft Edge at 1366×768 (mouse) and 1024×768 (touch). Nothing was pushed, deployed or migrated. No approved Sinhala text, dosage rule, prescription rule or printed-label layout was changed. 14 questions are open for the pharmacist (§8).

Contents: 1 How this was done · 2 Button behaviour matrix · 3 Broken controls found · 4 What was changed · 5 State management · 6 UI/UX changes · 7 Test results · 8 Pharmacist decisions · 9 Regression report · 10 Files

---

## 1. How this was done

1. Read every workstation component, the Zustand store (`apps/web/store/labelStore.ts`), the label builder (`lib/labelBuilder.ts`) and the approved Sinhala tables (`constants/oabInstructions.ts`). The SRS file in the repository (`srs.txt`) is empty, so "approved behaviour" means: the existing code, its existing tests (which quote SRS rule 20), `PHARMACY_LABEL_SYSTEM_AUDIT.md`, and the API's own rules.
2. Recorded what each button actually does (§2), and checked each one against the 10 questions in the brief.
3. Fixed only **technical** defects: dead controls, lost or corrupted state, silent reinterpretation of input, misleading displays and accessibility gaps. Where a fix would change clinical behaviour, nothing was changed and the question is listed in §8.
4. Wrote store tests, component tests that click the real buttons, and a browser script. Ran them after each group of changes.

---

## 2. Button behaviour matrix

Legend. **Chip**: appears in *Selected Instructions* and can be removed there. **Label text**: the line *Label text* under the chips. It shows the exact output of the label builder, which is the same text that is saved and printed. **Label switch**: the selection is stored on its own label and comes back when you return to it. Keyboard and touch were tested for every row (Enter and Space on focus, tap on a touch device).

### 2.1 Instruction grid

| Button | Tap does | State | Shown selected | Chip | Label text | Deselect | Conflicts | Needs input | Status |
|---|---|---|---|---|---|---|---|---|---|
| Reasons | Opens the reasons list (right panel). Tap again or Back/Done closes it | `reasons[]` | ✓ + "N selected" | One per reason | Not in the label text; reasons are saved and printed separately | ✕ on chip, tap again in list | None | Choose reasons | **Fixed** (B4) |
| Till Date | Toggles `TILL DATE` | `additionalInstructions` | ✓ teal | ✓ | Prints **English "TILL DATE"** (see P1) | ✓ | None | No date is asked for (P1) | Works; **decision P1** |
| 5H / 6H / 8H / EOD / Daily / Evening | Toggles that frequency | `additionalInstructions` | ✓ | ✓ | Code in English | ✓ | One frequency per label: a new one replaces the old one (existing rule). WEEKLY + 5H/6H/8H/EOD/DAILY shows a warning | — | Works; **decision P4** |
| Remove Address | Hides or shows the address on the label | `showAddress` | ✓ red, text "Address Hidden" | ✓ "ADDRESS HIDDEN" | — | ✓ | — | — | Works (chip added) |
| And This Date | Toggles `AND THIS DATE` | `additionalInstructions` | ✓ | ✓ | නියමිත දිනට පමණි | ✓ | — | No date is asked for (P1) | Works; **decision P1** |
| Weekly | Toggles `WEEKLY` | `additionalInstructions` | ✓ | ✓ | English | ✓ | Warning when combined with DAILY/5H/6H/8H/EOD; never resolved automatically | — | Works; **decision P4** |
| STAT | Opens the STAT panel. If the label already has a STAT dose, opens it for editing | `stat` | ✓ red | ✓ "STAT: 1½ (8H)" | `STAT 1½, then 8H` | ✕ on chip | Does not change the Morning/Lunch/Night doses | Quantity (required), then follow-up | **Fixed** (B2, B3, B6, B7, B15) |
| EXP Date | Opens the expiry editor | `expiryDate` | ✓ solid blue + date | ✓ "EXP: …" | Printed on label | Clear in editor, or ✕ on chip | — | Date from the pack | **Fixed** (B11, B16) |
| Empty Stomach / With Food / Chewable / Dissolve and Drink | Toggles that form instruction | `additionalInstructions` | ✓ | ✓ | With TAKE/GIVE (and BEFORE/AFTER for Chewable, Dissolve): the approved Sinhala sentence | ✓ | One per label: a new one replaces the old one. With Food / Empty Stomach remove and lock BEFORE/AFTER | TAKE/GIVE (and timing) before DONE, enforced by existing validation | **Fixed** (B5) |
| Keep in Mouth | Toggles `KEEP IN MOUTH` | `additionalInstructions` | ✓ | ✓ | English (no Sinhala text exists, P2) | ✓ | — | — | Works; **decision P2** |
| Add Label | Adds a blank label and switches to it | `labels`, `activeLabelIndex` | Counter "LABEL n OF m" | — | — | — | — | — | Works |
| Delete Label | Asks for confirmation (names the label and medicine), then removes only that label; the last label is reset instead | `labels`, `activeLabelIndex` | — | — | — | Cancel / Escape | — | Confirmation | Works (dialog semantics added) |
| Name of Days | Opens the day picker. ENTER keeps, Cancel restores what was there before | `selectedDaysOfWeek` | Button shows "Mon, Wed" | ✓ "DAYS: MON, WED" | `Days: MONDAY, …` | Per day, Select/Clear All, ✕ on chip | — | Days | **Fixed** (B10) |

### 2.2 Dosage schedule (Morning, Lunch, Night rows)

| Control | Tap does | Rule (unchanged) | Status |
|---|---|---|---|
| Time / QTY area | Opens the number pad for that row. The header reads e.g. "MORNING QTY"; the row is outlined and "Editing Morning" is shown | Entry replaces the row's dose | **Fixed**: was a mouse-only `div`; now a button |
| X / Y | Opens the pad with quick fractions ¼ ½ ¾ 1 | Fraction is added to the whole number: 2 + ½ = 2½. "1" adds a whole unit (P5) | **Fixed** (B13): shows "—" or "½" instead of "1 / 1" or the whole dose |
| − | Whole units down, never below 0 | Drops a fraction first: 1½ − = 0 (SRS rule 20, P6) | **Fixed**: disabled at 0 |
| + | Whole units up | Drops a fraction: 1½ + = 2 (SRS rule 20) | Works |
| Units / Tablets / ML | Removed | It was local to the panel, never saved, never printed, and reset on every label switch | **Removed** (B12, P8) |

Only the row tapped changes; a fraction on one row survives changes to another (tested).

### 2.3 Administration

| Button | Rule | Status |
|---|---|---|
| GIVE / TAKE | One of the two; tapping the other replaces it; tap again to remove | Works |
| BEFORE / AFTER | One of the two. Cannot be added while With Food or Empty Stomach is selected; a reason is shown ("Before/After not used with with food"). Can always be removed | **Fixed** (B5) |
| Combinations | GIVE/TAKE combine with BEFORE/AFTER: TAKE + AFTER → කෑමට පසු ගන්න; GIVE + BEFORE → කෑමට පෙර දෙන්න | Works (tested for every pair the table defines) |
| During STAT entry | Disabled (existing rule) | Works |

### 2.4 Panels, number pad, bottom bar

| Control | Behaviour now | Status |
|---|---|---|
| Number pad digits, `/`, ⌫ | Edit the entry. A new key clears an error | Works |
| Number pad **AC** | Empties the typed entry only | **Fixed** (B1): it called `allClear()` and erased **every label and the patient** |
| Number pad ENTER | Applies the entry if it can be read exactly. Otherwise shows why and keeps the pad open | **Fixed** (B9) |
| Number pad BACK | Closes without changing anything | Works |
| STAT − / + / X/Y | Change the STAT quantity. X/Y quick fractions now apply and return to the STAT panel | **Fixed** (B6) |
| STAT Done (Next) | Disabled until the quantity is above 0 | **Fixed** (B7) |
| STAT Cancel / Cancel STAT | New STAT: removes it. Editing an existing STAT: restores it unchanged | **Fixed** (B2) |
| STAT follow-up options | Set the follow-up and return to the grid | Works |
| Reasons list, Clear All, Back, Done | Toggle reasons; Clear All removes them; Back and Done close the panel | **Fixed** (B4) |
| Selected Instructions ✕ | Removes exactly that item | **Fixed** (B3, B5) |
| Selected Instructions Clear All | Second tap confirms (4 s). Clears instructions, reasons, STAT, expiry and days of week on this label; keeps product, doses and duration | **Fixed** (B17) |
| Days − / value / + | Blank until entered ("—"). + starts at 1; − stops at 1 and is disabled when blank; value opens the pad (whole numbers only) | **Fixed** (B8) |
| Expiry card | No date: uses the medicine's recorded expiry, or opens the editor. With a date: opens the editor (it no longer erases the date) | **Fixed** (B14) |
| Previous / Next label | Switch labels. Disabled during STAT entry | **Fixed** (B15) |
| DONE | Existing validation, then the review page. Not changed | Works |
| Toolbar (patient, medicine, alternative name, product quantity, home) | Not in scope beyond touch-target sizes and labels for two unlabelled icon buttons | Unchanged |

---

## 3. Broken controls found

| # | Control | What was wrong | Effect on staff |
|---|---|---|---|
| B1 | Number pad AC | Called the session-wide `allClear()` | One tap meant to clear a typed digit erased all labels and the patient |
| B2 | STAT tile | Re-tapping reset the existing STAT dose to 0 | Checking a STAT dose destroyed it |
| B3 | STAT chip ✕ | Called the frequency toggle, which **added** a `STAT` tag and removed the other frequency | Removing STAT changed the frequency and left STAT on the label |
| B4 | Reasons | Done/Back toggled a hidden tag and left the panel open. The tag was in the form group, so reopening Reasons removed Chewable, Dissolve and Drink or Empty Stomach. The left pane showed an unconnected demo panel whose "GIVE / PRINT" did nothing | Panel could not be closed; form instructions disappeared |
| B5 | With Food | Not in its exclusive group: With Food + Empty Stomach could both be on (the builder silently used the first). It did not clear BEFORE/AFTER, which stayed selected but disabled, and their ✕ did nothing | Contradictory instructions combined silently; a dead ✕ |
| B6 | STAT X/Y quick fractions | Not handled: tapping ½ did nothing and closed the STAT panel | STAT fractions could only be typed |
| B7 | STAT Done | Allowed with quantity 0 | STAT shown as set, but nothing printed |
| B8 | Days | Displayed **5** when no duration had been entered (nothing was saved); + from blank gave 6 | Screen and label disagreed |
| B9 | Number pad ENTER | `1/0` became 1, `1/` became 1, `/` became 0, `3/2` in X/Y added 1½, `1/2` in Days gave half a day | Entries silently reinterpreted |
| B10 | Days of week Cancel | Kept the changes | Cancel did not cancel |
| B11 | Expiry editor | Accepted any text, including impossible and past dates; the server refused them only at save | Late failure after review |
| B12 | Units / Tablets / ML | Never saved or printed; reset on label switch | A control that did nothing |
| B13 | X/Y display | Showed "1 / 1" when there was no fraction, and the whole dose (e.g. "1½") when there was | Looked like a selection had been made |
| B14 | Expiry card | Tapping the card when a date was set erased it | Accidental loss of expiry |
| B15 | Label switching during STAT | Left a half-entered STAT (quantity 0) on the label; navigation stayed enabled in the follow-up step | Stray STAT on a label |
| B16 | Expiry chip ✕ | Left the `ADD EXP DATE` marker behind, so the EXP tile still looked active | Tile and label disagreed |
| B17 | Clear All, chip ✕ | Clear All acted on one tap; both stayed active during STAT entry | Easy accidental loss |
| B18 | Accessibility | Grid tiles had no pressed state; QTY was a mouse-only `div`; dialogs had no role or Escape; close, barcode and clear-search buttons had no name; the expiry card was not reachable by keyboard | Not usable by keyboard or screen reader |
| B19 | Touch and layout at 1024×768 | Chip ✕ 24 px, days ± 28 px, toolbar quantity ± 32 px; once chips wrapped, two-line tile labels were cut off; the Reasons header pushed Done off screen | Missed taps; unreadable tiles |

---

## 4. What was changed

**Store (`store/labelStore.ts`)**
- `clearNumberPadBuffer` (AC); `validateQtyEntry` with messages, used by ENTER; one `applyQty` for both ENTER and the quick fractions, so STAT fractions work.
- Groups as constants: `FREQUENCY_CODES`, `FORM_INSTRUCTIONS` (now includes WITH FOOD), `TIMING_LOCKING_INSTRUCTIONS`. Deselecting is always allowed.
- `findInstructionConflicts`: WEEKLY with DAILY/5H/6H/8H/EOD is reported, not resolved.
- `openReasonsPanel` / `closeReasonsPanel`; the Reasons tile no longer writes a `REASONS` tag (§9).
- STAT: `startStat` keeps an existing dose and records it; `cancelStat` restores it; `doneStat` requires a quantity; `removeStat`.
- Days of week: `cancelDaysOfWeekPanel` restores; `setDaysOfWeek`.
- `incrementDays` / `decrementDays` (no default); `clearLabelInstructions`; `setExpiryDate(null)` removes the marker.
- Changing label (select, add, delete, all clear) closes every panel. Leaving mid-STAT or mid-day-picker counts as Cancel.
- The repeated "copy the active label to the top-level fields" code (7 copies) is now one helper, `activeFields`.

**Expiry check (`lib/labelExpiry.ts`)** mirrors the API's rule (`apps/api/src/domain/prescription/expiry.rules.ts`): `2028-01-31` and `12/2026` are checked (real date, month 1–12, not passed; a month-only expiry is valid to the end of the month). Other text such as `1/8/2028` is ambiguous and is accepted and printed exactly as typed, as before.

**Components.** `InstructionGrid` (one tile component replaces 20 hand-copied buttons, with the same colours and icons; the demo OAB panel is no longer shown), `SelectedInstructionsPanel`, `DosagePanel`, `LabelActions`, `NumberPad`, `StatPanel`, `BottomActionBar`, `ExpDateModal`, `DeleteLabelModal`, `DaysOfWeekPanel`, `ReasonsPanel`, plus touch sizes in `ProductToolbar` and labels in `ProductSearchInput`.

**Not touched:** `constants/oabInstructions.ts` (approved Sinhala), `lib/labelBuilder.ts`, `components/PrintableLabel.tsx`, validation before printing, save/print/SMS, API, database.

---

## 5. State management findings

| Finding | Result |
|---|---|
| Updates are immutable | Yes. Every action builds new arrays and objects. Verified by the label-switch tests |
| Two copies of label data (the `labels[]` array plus top-level mirror fields) | Kept, because many components read the mirror. The mirror is now written in one place (`activeFields`), so the copies cannot drift |
| Components writing to the store directly with `setState` (Clear All, Select All days, days ±) | Moved into store actions. No component writes to the store directly now |
| Component-local state that looked like label data (Units) | Removed |
| Independent labels | Tested: changes on one label never appear on another; Add Label starts blank and copies nothing |
| Stale state / race conditions | All updates use functional `set`; 50 rapid taps in a store test and 25 rapid clicks in jsdom are all counted, and 15 rapid clicks in Edge |
| Reset actions | AC clears only the entry; Clear All clears only instructions; Delete removes only its label; `resetActiveLabel` now keeps the label's id |
| Unsaved changes | Cancel restores for STAT and days of week; leaving mid-edit counts as Cancel; deleting a label always asks first |
| Preview matches label | The *Label text* line calls the same builder that produces the saved and printed text |
| Failed saves | Unchanged: save-before-print and the idempotency key from the earlier fix remain; nothing reports success on failure |

---

## 6. UI/UX changes

Layout, colours and the instruction-category colours are unchanged.

- **Selected state**: every selected tile has a check badge as well as its colour; toggles expose `aria-pressed`.
- **Disabled state**: real `disabled` (not just faded) with a reason where one exists (Before/After lock, STAT quantity).
- **Dosage panel**: row outline plus an "Editing Morning (fraction)" badge; X/Y shows "—" or the fraction only; empty quantities are grey; − is disabled at 0.
- **Label text line** under the chips: the exact text that will be printed, including Sinhala.
- **Conflicts** are shown as an amber warning under the header.
- **Number pad** header says what is being entered ("NIGHT FRACTION (X/Y)") and shows refusal messages.
- **Touch**: every workstation control is at least 32×32 px at 1024 px (grid tiles ≥ 56 px tall, dosage buttons ≥ 44 px wide). Chips stay on one horizontally scrollable row so the grid keeps its height.
- **Keyboard**: focus rings on tiles, rows and chips; dialogs close with Escape; Enter saves in the expiry editor.
- **No new animation** was added; existing press feedback was kept.

Screenshots (from the browser run, Edge): [desktop idle](button-audit/desktop-1366-1-idle.png) · [desktop with selections](button-audit/desktop-1366-2-selections.png) · [tablet idle](button-audit/tablet-1024-1-idle.png) · [tablet with selections](button-audit/tablet-1024-2-selections.png) · [tablet number pad](button-audit/tablet-1024-3-number-pad.png) · [tablet STAT](button-audit/tablet-1024-4-stat.png) · [tablet reasons](button-audit/tablet-1024-5-reasons.png) · [tablet expiry](button-audit/tablet-1024-6-expiry.png). The round "N" in the bottom-left corner is the Next.js development badge and is not part of the app.

---

## 7. Test results (2026-10-10)

| Suite | Command | Result |
|---|---|---|
| Web unit and component tests (Vitest, React Testing Library) | `cd apps/web && npx vitest run` | **177 passed**, 12 files (91 before this work) |
| New: store tests for every button | `store/labelStore.buttons.test.ts` | 42 tests |
| New: real workstation components | `components/label/Workstation.test.tsx` | 44 tests: every tile select and deselect, double click, keyboard Enter and Space, touch pointer, Sinhala text for 7 combinations, dosage ± and X/Y, rapid clicks, AC, invalid entries, Reasons, STAT, days, days of week, expiry, add/delete/switch labels |
| Browser (Edge 1366×768 mouse, 1024×768 touch) | `apps/web/e2e/workstation.e2e.mjs` (instructions in the file) | **110 of 110 checks passed** ([results](button-audit/browser-results.json)). Layout checks: no horizontal scroll, no overlapping controls, no text clipped by a button or container, every control at least 32×32 px, no page errors |
| Type check | `npx tsc --noEmit` | Clean |
| Lint (changed files) | `npx eslint …` | No new findings. Remaining findings are on lines not changed here (`any` types in `labelStore.ts` lines 153 and 191, `page.tsx`, `LabelActionPage.tsx`; an older effect in `ProductSearchInput.tsx`) |

Two existing tests were updated, and why:
- `StatFlow.test.tsx`: two tests pressed DONE with a STAT quantity of 0. That is now refused (B7), so they add a quantity first. Its `beforeEach` now resets the labels, because STAT lives on the label and re-opening STAT edits it (B2).
- `NumberPad.test.tsx`: the header now reads "MORNING QTY" instead of "MORNING".

The browser run used the developer server already running on port 3002, a placeholder session cookie to pass the middleware's presence check, and no API: it never pressed DONE, saved, printed or sent an SMS. Medicine search, saving and printing were therefore **not** exercised in the browser.

---

## 8. Decisions needed (pharmacist)

None of these were changed. Each needs an answer before the behaviour is changed.

| # | Question | Today |
|---|---|---|
| P1 | **Till Date / And This Date.** The builder has Sinhala for `TILL TO DAY` (අද දින දක්වා පමණි), but the button sends `TILL DATE`, so the label prints English "TILL DATE". Neither button asks for a date. What should each print, and should they take a date (and is that the treatment end date, not the medicine expiry)? | Prints "TILL DATE" in English; "And This Date" prints නියමිත දිනට පමණි with no date |
| P2 | Keep in Mouth, Weekly, Evening, 5H/6H/8H/EOD/Daily have no Sinhala text. Should they? | Printed as English codes |
| P3 | **Inconsistent Sinhala spellings.** With a form instruction but no TAKE/GIVE, the builder previews හපා කන්න / කෑම සමඟ ගන්න / හිස්බඩ ගන්න, while the approved table uses සපලා කන්න / කෑමත් සමග ගන්න / හිස් බඩ ගන්න. The approved GIVE text for With Food ends with a full stop (කෑමත් සමග දෙන්න.); the others do not. Which spellings are correct? | Fallback wording cannot be printed (DONE requires TAKE/GIVE) but appears in the preview |
| P4 | WEEKLY with a daily or hourly frequency is now **warned, not blocked**. Should DONE refuse it? Are other combinations contradictory (Weekly + Evening, days of week + Daily, an hourly frequency plus Morning/Lunch/Night quantities, a grid frequency plus a STAT follow-up)? | Warning only for WEEKLY + DAILY/5H/6H/8H/EOD |
| P5 | X/Y quick button **"1"** adds a whole unit (2 → 3). Should it mean "no fraction" instead? | Adds 1 (unchanged) |
| P6 | − on a fractional dose drops the fraction and a unit (1½ → 0, ½ → 0), mirroring + (SRS rule 20). Confirm, or should − remove only the fraction? | Unchanged |
| P7 | No maximum dose, maximum STAT or maximum days exists. Should there be limits? | None enforced; none invented |
| P8 | The Units / Tablets / ML switch was removed because it did nothing. Should labels state a unit? If so, which units, per medicine, and with what conversion rules? | No unit on the label (as before) |
| P9 | **EXP quick presets** (1 month … 2 years from today) put a date on the label that does not come from the pack. Recommend removing them. | Still present, unchanged |
| P10 | The expiry editor now refuses a date that has passed or does not exist (the server already refused past dates at save). Confirm. | Refused |
| P11 | Days had no real default but displayed 5. It now shows "—" until entered, and + starts at 1. Confirm. (Product quantity still shows and saves 1 by default; that was already raised in the backend audit.) | Changed display only |
| P12 | Can a label carry both a STAT dose (with its follow-up) and a separate grid frequency? | Allowed |
| P13 | Ambiguous expiry text (e.g. 1/8/2028) is accepted unchecked and printed as typed. Require an unambiguous format? | Accepted (unchanged) |
| P14 | Reasons are no longer stored as a `REASONS` tag in the saved instruction list (the reasons themselves are saved as before). Confirm nothing reads that tag. | Tag not written |

---

## 9. Regression report

| Area | Changed? | Evidence |
|---|---|---|
| Approved Sinhala instruction text | No | `oabInstructions.ts` and `labelBuilder.ts` untouched; `oabLogic.test.ts` (29) and `labelBuilder.test.ts` (5) pass; 7 Sinhala combinations checked through the real buttons |
| Printed label layout | No | `PrintableLabel.tsx` untouched |
| Dosage increment rules (SRS rule 20) | No | `DosageRow.test.tsx` passes unchanged |
| Validation before printing | No | `validateBeforePrint` untouched |
| Save, print, SMS, idempotency | No | `page.tsx` only imports the shared frequency list; `sms.test.ts` and `server.test.ts` pass |
| Database, API, migrations | No | No files changed under `apps/api` |
| Saved prescription content | Slightly | (1) The `REASONS` tag is no longer added to `instructions` (P14). (2) A label can no longer hold With Food together with Empty Stomach or Before/After; such combinations used to save but printed only one of them. (3) Entries that used to be reinterpreted (B9) and past expiries (B11) are refused before saving instead of being saved or refused by the server |
| Behaviour staff will notice | Yes | AC no longer wipes the session; Reasons closes; STAT re-opens for editing; Cancel cancels; Days shows "—" when not set; the Units switch is gone; Clear All needs a second tap; tapping the expiry card opens the editor instead of erasing the date |

Not verified: medicine search, save, print and SMS in a browser (the API was not running); real tablets (touch was emulated in Edge); screen readers (only roles, names and keyboard access were checked).

---

## 10. Files

Changed: `apps/web/store/labelStore.ts`, `components/label/{InstructionGrid, SelectedInstructionsPanel, DosagePanel, LabelActions, BottomActionBar, ExpDateModal, DeleteLabelModal, ProductToolbar}.tsx`, `components/{NumberPad, StatPanel, ProductSearchInput}.tsx`, `app/label/{DaysOfWeekPanel, ReasonsPanel, page}.tsx`, tests `components/{StatFlow, NumberPad}.test.tsx`.
New: `apps/web/lib/labelExpiry.ts`, `store/labelStore.buttons.test.ts`, `components/label/Workstation.test.tsx`, `e2e/workstation.e2e.mjs`, `docs/button-audit/` (screenshots and browser results).
No longer used by the workstation (kept): `components/OABWorkflowPanel.tsx`.
