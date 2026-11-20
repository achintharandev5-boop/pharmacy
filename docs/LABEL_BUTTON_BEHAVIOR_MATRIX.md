# Label Button Behaviour Matrix

Date: 2026-10-11 (updated after the owner's second brief). How every workstation button behaves in the default wording (what runs today) and in the spec wording (`NEXT_PUBLIC_LABEL_WORDING=spec`, after approval). The earlier per-button audit is `BUTTON_LOGIC_AUDIT.md`; this document adds the workflows from the handwritten sheets.

## Button states (both modes)

| State | Looks like | Meaning |
|---|---|---|
| Default | White tile | Not chosen |
| Selected | Category colour + check badge, `aria-pressed="true"` | Chosen |
| Requires input | Dashed amber outline (`data-state="requires-input"` on tiles, `data-required` on TAKE/GIVE/BEFORE/AFTER) | Chosen, but its workflow needs a next step; the Administration card says which |
| Invalid | Red outline (`data-state="invalid"`) | Breaks a sheet rule; DONE is refused (spec mode) |
| Locked | Faded, dashed border (`data-state="locked"`); still tappable to show why | Not allowed now (spec: interval tiles while a dose row is set) |
| Disabled | Faded, not tappable, reason in tooltip | BEFORE/AFTER with With Food / Empty Stomach; everything outside the STAT panel during STAT entry |
| Completed | Administration card shows "✓ Complete" | The workflow has everything it needs |

The **Administration card** shows the current workflow ("Chewable", "With Food + Chewable", …) and either "Next: …" or "✓ Complete". When the next step is an interval quantity, the line is a button that reopens the quantity pad.

## Matrix

"Spec" lists only what differs from the default.

| Button | Default (today) | Spec |
|---|---|---|
| TAKE / GIVE | One of the two; tap again to remove. Marked "requires input" when a workflow needs it | Same |
| BEFORE / AFTER | One of the two. Disabled with With Food / Empty Stomach; a locked timing can still be removed | Also disabled for With Food + Chewable |
| NAB sentence | කෑමට පසු ගන්න (etc.) once TAKE/GIVE + BEFORE/AFTER are chosen | ගන්න කෑමට පසු (etc.) |
| Chewable | Replaces any other form. Needs TAKE/GIVE + BEFORE/AFTER. සපලා කන්න … | හපලා කන්න … · after With Food it **combines** (no timing) |
| Keep in Mouth | Independent English tag; no workflow | A form: replaces others; needs TAKE/GIVE + BEFORE/AFTER; දිව මත … |
| Dissolve and Drink | Replaces any other form. Needs TAKE/GIVE + BEFORE/AFTER | Same wording |
| Empty Stomach | Replaces any other form; removes and locks timing; needs TAKE/GIVE | Same wording |
| With Food | Replaces any other form; removes and locks timing; needs TAKE/GIVE. කෑමත් සමග … | කෑමත් සමඟ … · **refused after Chewable**, with a message; Chewable is kept |
| 5H / 6H / 8H / EOD / Daily / Evening | Replace each other. **Tap → quantity pad ("8H — QTY PER DOSE") → tile and chip show "n each"**. DONE refused without a quantity; dismissing the pad leaves "Next: Enter the quantity for 8H" (a button). Switching 6H → 8H keeps the quantity; removing the last one clears it | 5H/6H/8H/Daily **locked** while Morning/Lunch/Night has a dose; then TAKE/GIVE (and timing) required |
| Weekly | Toggle; warning when combined with Daily/5H/6H/8H/EOD | Same |
| Morning / Lunch / Night rows | QTY, X/Y, −, + per row, independent; quantities printed on the dose row | Equal quantity on all three → **දිනපතා 3 වරක් ගන්න**; any other pattern → "No approved Sinhala wording … Awaiting pharmacist" notice and no sentence. A dose requires TAKE/GIVE before DONE |
| STAT | STAT panel → quantity (Done disabled at 0) → follow-up → grid; prints "STAT n, then …" | STAT panel → quantity → **STAT administration** (TAKE/GIVE/BEFORE/AFTER; Enter disabled until TAKE or GIVE; Back to quantity; Cancel) → **Enter (ඉන්පසු)** → follow-up. TAKE → **පළමුව පමණක් ගන්න**; other choices have no approved wording and DONE refuses them. Re-opening edits the dose; Cancel restores it; the chip ✕ removes it. "STAT n" line kept |
| Reasons, Till Date, And This Date, Remove Address, EXP Date, Add/Delete Label, Name of Days | As in `BUTTON_LOGIC_AUDIT.md` | Same |
| DONE | Refused when `validateBeforePrint` fails **or** the engine reports an incomplete workflow (interval quantity) | Also refused for any incomplete or invalid spec workflow, and for a STAT dose without approved wording |
| Review page: Print & Save | **Disabled when a label's text overflows the printed 26 mm instruction area** (red outline and message); Save without printing still works | Same |

## Sequence examples (spec mode)

| Taps | Result |
|---|---|
| TAKE → AFTER | ගන්න කෑමට පසු |
| AFTER → TAKE | ගන්න කෑමට පසු (the sentence follows the sheet's word order, whatever the tap order) |
| Chewable → GIVE → BEFORE | හපලා කන්න දෙන්න කෑමට පෙර |
| Keep in Mouth → TAKE | "Next: Choose BEFORE or AFTER"; no sentence yet |
| With Food → Chewable → TAKE | කෑමත් සමඟ හපලා කන්න |
| Chewable → With Food | Refused: "Chewable then With Food is not a supported order. To combine them, remove Chewable, tap With Food, then Chewable." |
| Morning + → 8H | 8H refused: "5H, 6H, 8H and Daily are locked while Morning, Lunch or Night has a dose." |
| 8H (qty 1) → TAKE → AFTER → Night + | Invalid: "8H cannot be used with a Morning/Lunch/Night dose." DONE refused; nothing is removed automatically |
| Morning + only | "Next: Choose TAKE or GIVE" |
| Morning, Lunch, Night + once each | දිනපතා 3 වරක් ගන්න (immediately; the notice for 1 or 2 periods disappears) |
| STAT → + → Done → STAT TAKE → Enter (ඉන්පසු) → 8H | පළමුව පමණක් ගන්න · ඉන්පසු · … ; STAT 1, then 8H |
| STAT → + → Done → STAT GIVE | "No approved Sinhala wording for STAT with GIVE"; Enter allowed, DONE refused |

## Verification against the handwritten diagrams (final pass, 2026-10-11)

"Diagram" names the sheet that specifies the button. "Evidence" names the tests that exercise it through the real buttons (V = Vitest/RTL, E = Edge browser run). "Matches" is judged against the diagram; where the diagram's behaviour is built only behind the spec switch, both are listed.

| Button | Diagram | Matches the diagram? | Evidence | Open decision |
|---|---|---|---|---|
| TAKE / GIVE | NAB | Yes: sequence, exclusivity, guidance. Word order only with spec wording | V Workstation, WorkflowGuide · E workstation, spec | A1 |
| BEFORE / AFTER | NAB, OAB | Yes; locked for With Food / Empty Stomach | V, E | — |
| STAT | STAT | Default: quantity → follow-up. Spec: quantity → TAKE/GIVE → Enter (ඉන්පසු) → follow-up, as drawn | V WorkflowGuide, ownerPhrases · E spec | S2, A12, A14 |
| Morning / Lunch / Night | Digital label | Quantity per row, independent. Spec: then NAB/OAB; 1/1/1 → owner phrase | V Workstation, ownerPhrases · E both | A7, A9, A15, A16 |
| Daily / Evening | Evening–Daily | Yes: button → quantity → (spec: NAB/OAB) | V PrintedInterval, Workstation · E | A10 |
| 5H / 6H / 8H | 8H–6H–5H | Yes: button → quantity; printed line matches the sheet example | V PrintedInterval · E | A6 (lock) |
| Chewable | OAB | Default: today's wording. Spec: හපලා sentences | V instructionEngine, WorkflowGuide · E spec | A2 |
| Keep in Mouth | OAB | Spec only: full workflow (default: English tag) | V, E spec | A3 |
| Dissolve and Drink | OAB | Yes (wording identical) | V, E | — |
| Empty Stomach | OAB | Yes (wording identical; timing locked) | V, E | — |
| With Food | OAB | Default: today's wording. Spec: සමඟ; With Food → Chewable combination; reverse refused | V, E spec | A4, A5 |
| Weekly | none | Toggle; WEEKLY + Daily/5H/6H/8H/EOD warned | V, E | BUTTON_LOGIC_AUDIT P4 |
| EOD | none (same code path as intervals) | Button → quantity | V PrintedInterval | — |
| Till Date | none | Prints English "TILL DATE" | V | P1 |
| And This Date | none | Prints නියමිත දිනට පමණි | V | P1 |
| EXP Date | none | Editor; past and impossible dates refused; no invented dates | V, E | P9, P10 |
| Reasons | none | Panel opens and closes; reasons printed in brackets | V, E | — |
| Name of Days | none | Picker with Cancel restore; printed "(… දිනවල පමණක්)" | V, E | — |
| Add Label / Delete Label | none | Independent labels; delete asks first; saved prescriptions unaffected | V, E save-and-print (3 labels saved and printed as 3 pages) | — |
| Review: Print & Save | — | Refused when any label overflows; re-checked at press; saves before printing; one print, recorded | V ReviewPrintGuard · E print-guard, save-and-print | B2 |
| Review: Save without printing | — | Records a completed prescription without printing | E save-and-print | B3 |
