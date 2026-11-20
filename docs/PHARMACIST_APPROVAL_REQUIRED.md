# Pharmacist Approval Required: Label Workflows and Sinhala Wording

Updated 2026-10-11 (P3 implementation) · For the pharmacist, and the owner, who switches the change on.

The handwritten workflow sheets and two phrases from the owner are built and tested, but **none of the new wording prints yet**. The printed **layout** has changed: layout P3 is now in use for testing (S1, S3). The label is still 70 × 50 mm, with the same words and the same instruction text sizes, and long names are never cut off (B7). The other safety changes are in section B. Measurements: `PRINT_LAYOUT_AND_STAT_OPTIONS.md`.

**How to answer.** Mark each item *Approve*, *Change to …* or *Reject*. Approved items are turned on by setting `NEXT_PUBLIC_LABEL_WORDING=spec` and redeploying. **With P3, spec-wording STAT labels now fit (S1). Option B (S2) is built and appears only when the spec wording is switched on, which it is not.**

Full side-by-side wording: `SINHALA_INSTRUCTION_MAPPING.md`.

## S. Must be decided before the spec wording is switched on

| # | Problem | Evidence | Options |
|---|---|---|---|
| **S1** | **Label layout P3: implemented for testing** (owner's decision, 2026-10-11). Instruction area 26 → 30.5 mm; product, patient and expiry rows −0.5 mm each; footer 9.5 → 6.5 mm on two lines; Sinhala line height 1.375 → 1.25; ඉන්පසු at the end of the line before it; days, weekdays, STAT and tags share one wrapping row. No instruction text smaller; separate instructions never joined | `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §1–2; before/after images `workflow-audit/print-prototypes/before-after-*.png` and `workflow-audit/print-p3/after-*.png` | **Confirm** after the test print (B6). Results: every supported label fits; today's busy label 107/115 (was blocked at 125/98); spec STAT C 91/115, D 73/115. Still blocked: busy spec label (124) and everything-selected labels |
| **S2** | **STAT quantity: Option B, built behind the spec switch, pending approval.** පළමුව පමණක් ② ගන්න: the quantity is printed once, inside the owner's phrase (before the verb, as in the STAT sheet's example), and the "STAT 2, then 8H" pill is not printed. Fractions kept (1½). Follow-up as a small "THEN 8H" tag. Daily dose row unchanged. Only for STAT + TAKE: GIVE, BEFORE/AFTER and forms still have no wording and are refused at DONE | `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §5; `workflow-audit/print-p3/after-S4.png`, `review-spec-stat-1024.png` | **Approve inserting the number into the owner's phrase**, or choose Option A (exact phrase, "STAT ②" at the start of the dose row) or keep the pill. Today's wording is unaffected |
| **S3** | **Two-line footer and 3.5 mm expiry row** (implemented with P3). All text kept at its previous size | `after-*.png` | Confirm readable on the test print (B6, checklist rows 5–6) |

## A. Wording and rules (built; used only with spec wording)

| # | Question | Source | Prints today | If approved |
|---|---|---|---|---|
| A1 | NAB word order: verb first? | Sheet: ගන්න කෑමට පසු | කෑමට පසු ගන්න | All four TAKE/GIVE + BEFORE/AFTER sentences change order |
| A2 | Chewable: හපලා or සපලා? | Sheet: හපලා කන්න කෑමට පසු | සපලා කන්න කෑමට පසු | All four Chewable sentences change |
| A3 | Keep in Mouth: confirm four sentences (blurred on the sheet) | දිව මත තබා ගන්න / තබන්න කෑමට පෙර / පසු | English "KEEP IN MOUTH" | Keep in Mouth becomes a workflow; one Sinhala sentence |
| A4 | With Food: සමඟ or සමග? Full stop after දෙන්න? | Sheet: කෑමත් සමඟ ගන්න / දෙන්න | කෑමත් සමග ගන්න / දෙන්න. | Both lines change |
| A5 | With Food → Chewable combination, in that order only | Sheet: කෑමත් සමඟ හපලා කන්න (දෙන්න); reverse "didn't work" | Chewable replaces With Food | Combination allowed; reverse refused with a message |
| A6 | Morning/Lunch/Night dose locks 6H/8H/5H/Daily | Digital-label PDF | No lock | Locked tiles; interval-then-dose refused at DONE |
| A7 | Every schedule must be followed by TAKE/GIVE | All schedule sheets | Not required | DONE refused until chosen. Note: the owner's example produces දිනපතා 3 වරක් ගන්න without TAKE being tapped, so A7 and the owner's example need reconciling |
| **A14** | **Owner phrase: STAT, TAKE → පළමුව පමණක් ගන්න.** Confirm its clinical use. Approved only for TAKE alone; STAT + GIVE, + BEFORE/AFTER and + forms have no approved wording, and DONE refuses them | Owner, 2026-10-11 | "STAT 1, then 8H" (English) | STAT gains a step: quantity → TAKE/GIVE → Enter (ඉන්පසු) → follow-up. Printed: පළමුව පමණක් ගන්න, then ඉන්පසු before what follows |
| **A15** | **Owner phrase: Morning, Lunch, Night → දිනපතා 3 වරක් ගන්න.** Generated when all three periods are given with the same quantity (1/1/1, ½/½/½, 2/2/2), and not with GIVE or a form instruction (the phrase says ගන්න). Confirm 2/2/2 and the fraction cases | Owner, 2026-10-11 | Nothing (rows only: උදේ ① දවල් ① රෑ ①) | Printed as a Sinhala line; the per-period quantities stay on the dose row |
| **A16** | **No approved wording** for: Morning only, Lunch only, Night only, Morning + Night, any two periods, different quantities (e.g. 2/1/1), and 1/1/1 with GIVE or a form. Please supply each, or confirm that none is needed | Owner asked for "existing approved mappings"; **none exists in the system** | — | Today the workstation shows "No approved Sinhala wording for … Awaiting pharmacist." and prints no frequency sentence; nothing is invented |

## B. Already changed in both modes (please confirm)

| # | Change | Why |
|---|---|---|
| B1 | 8H/6H/5H/EOD/Daily/Evening ask for a quantity per dose; DONE refused without one | Before, these buttons never printed anything (no quantity could be entered) |
| **B2** | **Print & Save is blocked for any label with text that would be cut off**: the instruction area, a medicine, brand or patient name that does not fit, or any text running past a row's edge (product, patient, instructions, expiry, footer). The message names the label and the field. Save without printing still works | Before this work, a busy label printed with its dose row and tags cut off. Screenshot `workflow-audit/print-p3/review-default-overflow-1024.png`. Confirm, or choose warn-only |
| B3 | **"Save Draft" renamed "Save without printing".** It never saved a draft: it records a COMPLETED prescription, the same as Print & Save without the print, and the API dispenses stock for a stocked medicine (verified against the real API and a test database). The database has an unused DRAFT status. A real draft save needs an API change, which needs approval | Confirm the name; decide whether real drafts are wanted |
| B4 | **Printed spacing**: superseded by layout P3 (S1) | — |
| B5 | **Print safety margin.** A label must fit with 1 px clear at the top and bottom, and is re-measured when Print & Save is pressed and when a late font loads. Printing waits for the Sinhala font. The review preview now loads the same font rules as the print (it could fall back to another Sinhala font on some builds) | Confirm |
| **B6** | **A physical test print is still needed. Physical printing is not verified.** Checked with the browser's print engine only (14 labels → 14 pages, 3 labels from Print & Save → 3 pages, 69.85 × 50.12 mm) | Please follow the checklist in `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §8 on the pharmacy's printer. Test print result |
| **B7** | **Fixed: names are never cut off or shortened with "…".** Before, a long brand lost both ends with no warning and medicine and patient names were cut with "…". Now each name gets smaller in steps, then wraps onto two lines; if it still does not fit, Print & Save is blocked and the field is named | `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §3; `after-S11.png`, `after-S13.png`, `after-S14.png`. Confirm |
| B8 | Resolved by B7: names are printed in full or the label is blocked. Note that a long patient name beside a brand (about 30+ characters) is blocked; staff enter a shorter form or Save without printing | Confirm that blocking, rather than shortening, is wanted |
| **B9** | **Smallest size for long names: 8 px** (about 2 mm), and two lines at 8 px in the 4.5–5 mm name rows. 8 px is already the label's tag size; the phone is 7.5 px | Approve 8 px, or set a larger minimum (more names will be blocked) |

## C. Still blocked

| # | Question |
|---|---|
| A9 | Night word on the digital-label sheet (රැයට? රෑට?) and any full Morning/Lunch/Night sentence |
| A10 | Daily: sheet දිනකට vs label දිනපතා. Evening: sheet හවසට vs label සවසට |
| A11 | Units: පෙති / කරල් / පැකට් per label? Complete list? |
| A12 | STAT follow-up: the sheet routes it into the Digital label or interval workflows with their own TAKE/GIVE; the workstation records a code ("8H", "MORNING") printed in English |
| A13 | Switch on all at once, or item by item? |

Also open from `BUTTON_LOGIC_AUDIT.md` §8: Till Date prints English; EXP quick presets invent a date; WEEKLY + DAILY warned, not blocked; X/Y "1" adds a whole unit; no maximum dose.

## Sign-off

| Item | Decision | Pharmacist | Date |
|---|---|---|---|
| S1, S2, S3 | | | |
| A1 – A16 | | | |
| B1 – B9 | | | |
