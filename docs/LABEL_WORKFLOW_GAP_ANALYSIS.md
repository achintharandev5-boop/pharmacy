# Label Workflow Gap Analysis

Date: 2026-10-11 (updated after the owner's second brief) · Branch `feature/ui-ux-redesign` (uncommitted) · Scope: the label workstation (`/label`).

This compares the handwritten workflow specifications with the workstation as built, and records what was changed.

## Sources

| # | Specification | File (owner's Downloads folder) | Legibility |
|---|---|---|---|
| 1 | Full OAB workflow | `Full version of OAB work flow (image ).jpg.jpeg` | Low resolution; read using the close-ups (4–6) and enlarged crops |
| 2 | With Food + Chewable | `WhatsApp Image … 12.28.52 AM (1).jpeg` | Good |
| 3 | Empty Stomach | `WhatsApp Image … 12.28.52 AM.jpeg` | Good |
| 4 | Other Admin Buttons: Chewable, Keep in Mouth | `WhatsApp Image … 12.28.53 AM (1).jpeg` | Good; Keep in Mouth outputs are cut off at the edge and were read from an enlarged crop of sheet 1 |
| 5 | Dissolve and Drink | `WhatsApp Image … 12.28.53 AM.jpeg` | Good |
| 6 | STAT | `STAT workflow (image).jpg.jpeg` | Good, except the STAT button's own Sinhala word |
| 7 | Digital label (Morning/Lunch/Night) | `Full version of DIGI LABEL work flow.jpg.jpeg` | Good, except the Night word |
| 8 | 8H / 6H / 5H | `8H_6H_5H BUTTON WORK FLOW (image).jpg.jpeg` | Good |
| 9 | Evening / Daily | `Evening _daily Work Flow .jpg.jpeg` | Good |
| 10 | NAB | `Full Version Of NAB workflow (image).jpg.jpeg` | Good |
| — | Earlier typed sheets (September) | `Software Logic For OAB.pdf`, `NAB Software logic.pdf`, `Digi label software logic-1.pdf` | Good; they agree with 1–10 and add two rules (below) |

**The rule that generates every sentence.** The OAB PDF says: *"I mentioned what words should be print after click these Btn. I mentioned it within Brackets [ ]."* The printed sentence is the bracketed words in the order the buttons are pressed. Example: Chewable [හපලා] + Take [කන්න] + [කෑමට] + After [පසු] = **හපලා කන්න කෑමට පසු**. This rule reproduces every legible output on every sheet.

**Two rules found only in the PDFs:**
- NAB PDF: *"Normal Admin Buttons … there are no combination with (OAB Btn)"*, and [කෑමට] *"must be print"*.
- Digital label PDF: *"When digi label work on it, locked these button: 6H / 8H / 5H / Daily."*

## How the gaps were handled

Your instructions require approval before any clinical change. So every wording and clinical-rule change from the sheets was built, tested, and put behind one switch, `NEXT_PUBLIC_LABEL_WORDING=spec`, which is **off by default**. With it off, the workstation prints exactly what it printed before. Changes that are not clinical (step-by-step guidance and the missing quantity step) are on in both modes.

| Mode | Printed Sinhala | Workflow rules |
|---|---|---|
| Default (`current`) | Unchanged | Unchanged, except that interval/daily buttons now ask for their quantity (gap G8) |
| `spec` (after approval) | The sheets' wording | The sheets' rules (G3, G5, G6, G7, G9) |

## Gaps

Status: **Fixed** = done in both modes · **Ready (switch)** = built and tested, used only when the switch is on · **Blocked** = needs the pharmacist (see `PHARMACIST_APPROVAL_REQUIRED.md`).

| # | Workflow | Expected (sheets) | Before this work | Status |
|---|---|---|---|---|
| G1 | NAB wording | Verb first: **ගන්න කෑමට පසු**, ගන්න කෑමට පෙර, දෙන්න කෑමට පසු, දෙන්න කෑමට පෙර | Meal first: කෑමට පසු ගන්න, … (all four reversed) | Ready (switch); approval A1 |
| G2 | NAB sequence | TAKE/GIVE, then BEFORE/AFTER, then output | Any order accepted; DONE required both. A partial choice previewed a sentence (BEFORE alone → "කෑමට පෙර ගන්න") | **Fixed**: guidance shows the next step. In spec mode no sentence appears until complete |
| G3 | NAB vs OAB | NAB alone has "no combination with OAB" | NAB buttons are shared with the OAB workflows (the OAB sheets themselves use TAKE/GIVE/BEFORE/AFTER after a form button). No conflict found | No change |
| G4 | Chewable wording | **හපලා** කන්න … | **සපලා** කන්න … (first letter differs, all four) | Ready (switch); approval A2 |
| G5 | Keep in Mouth | Keep in Mouth [දිව මත] → Take [තබා ගන්න] / Give [තබන්න] → [කෑමට] → [පසු]/[පෙර]: four sentences | A separate English tag "KEEP IN MOUTH". Not part of any workflow; could be combined with any form | Ready (switch); approval A3 (outputs read from a blurred crop) |
| G6 | Dissolve and Drink | දියකර බොන්න (දෙන්න) කෑමට පෙර/පසු | Identical | No change |
| G7 | Empty Stomach | හිස් බඩ ගන්න / දෙන්න; BEFORE/AFTER "locked automatically" | Identical; lock already implemented | No change. The partial-preview fallback "හිස්බඩ ගන්න" (no space) never prints |
| G8 | **5H/6H/8H, Evening, Daily: quantity** | Button → **Select Qty** → NAB/OAB → output | **No quantity step existed.** The printed label's interval line ("පෙති ① බැගින් පැය 8කට වරක්") needs a quantity that no button could set, so **these six buttons never printed anything**. The prescription record saved the code only | **Fixed (both modes)**: tapping one opens "8H — QTY PER DOSE"; tile and chip show "1 each"; DONE is refused without a quantity; removing the interval clears the quantity. Printed text is the existing label wording. Confirmation A8 |
| G9 | With Food wording | කෑමත් **සමඟ** ගන්න / දෙන්න | කෑමත් **සමග** ගන්න / දෙන්න**.** (different last letter; the GIVE line ends with a full stop) | Ready (switch); approval A4 |
| G10 | **With Food + Chewable** | With Food → Chewable = combined: **කෑමත් සමඟ හපලා කන්න** / **… කන්න දෙන්න** (no timing). Chewable → With Food = "didn't work" | Not supported: Chewable replaced With Food | Ready (switch): the combination works in that order. The reverse order is refused, with the reason on screen and Chewable kept. Approval A5 |
| G11 | Digital label lock | A Morning/Lunch/Night dose locks 6H/8H/5H/Daily | Not implemented; any combination allowed | Ready (switch): those tiles show as locked and explain why when tapped. An interval chosen *before* a dose is marked invalid and blocks DONE. Approval A6 |
| G12 | Digital label sequence | Morning/Lunch/Night → Qty → NAB/OAB → output | Rows independent of administration; a dose with no TAKE/GIVE was allowed | Ready (switch): a dose or interval requires TAKE/GIVE (and timing where the workflow needs it). Approval A7 |
| G13 | Digital label wording | Morning [උදේට], Lunch [දවල්ට], Night [unclear] | The printed label shows උදේ / දවල් / රෑ with circled quantities (fixed layout) | Blocked: the sheets give no full sentence for these rows, and the label layout may not change without approval. Words recorded only (A9) |
| G14 | Interval wording | [පැය 8කට වරක්], [පැය 6කට වරක්], [පැය 5කට වරක්]; example "පෙති 1 බැගින් පැය 8කට වරක් ගන්න කෑමට පසු" | The printed label already prints "පෙති N බැගින් පැය 8කට වරක්" (matches) | Matches once G8 is fixed. Daily: sheet [දිනකට], label "දිනපතා". Evening: sheet [හවසට], label "සවසට" (A10) |
| G15 | Units | [පෙති / කරල් / පැකට්] (tablets / capsules / packets) | The printed label always says පෙති. The old Units/Tablets/ML switch (removed in the previous audit) did nothing | Blocked: needs a unit field per label and a decision on the list (A11) |
| G16 (first pass) | **STAT** | STAT [word unclear] → Qty → **its own NAB/OAB** → Enter [**ඉන්පසු**] → Digital label or 8H/6H/5H/Daily/Evening → NAB/OAB → output. Example: "… ② ගන්න කෑමට පසු / ඉන්පසු / පෙති ① බැගින් පැය ⑧කට වරක් ගන්න කෑමට පසු". *"After click enter [ඉන්පසු] must be printed before going other btn"* | STAT → qty → Done → follow-up choice (8H, MORNING, …). Prints English "STAT 2, then 8H". The STAT dose has no administration of its own | Blocked: the STAT word is illegible; the STAT dose needs its own TAKE/GIVE/BEFORE/AFTER (a data change); immediate-dose printing needs approval (A12) |
| G17 | Evening / Daily | Button → Qty → NAB/OAB → output | As G8 | Fixed with G8 |
| G18 | Duplicate text | No instruction printed twice | The builder already de-duplicated. Spec mode prints Keep in Mouth once, inside the sentence (it is no longer also a separate tag) | Tested |
| G19 | Incomplete printed as complete | Never | DONE validation covered TAKE/GIVE/timing, but an interval with no quantity printed nothing and passed | **Fixed**: DONE uses the same analysis as the on-screen guidance |

## Second pass (owner's brief, 2026-10-11)

The owner supplied two exact phrases: **පළමුව පමණක් ගන්න** (STAT, quantity 1, TAKE) and **දිනපතා 3 වරක් ගන්න** (Morning = Lunch = Night = 1). The first also resolves the STAT word that was unreadable on sheet 6 ("පළමුව පමණක්").

| # | Item | Finding | Status |
|---|---|---|---|
| G16 (updated) | **STAT workflow** | Built to the sheet: STAT → quantity (Done disabled at 0; fractions work) → **the STAT dose's own TAKE/GIVE/BEFORE/AFTER** (Enter disabled until TAKE or GIVE) → **Enter (ඉන්පසු)** → existing follow-up. Stored on the label's STAT entry; not sent to the API, so prescription persistence is unchanged (the Sinhala reaches the record through the existing generated-text field). STAT never changes Morning/Lunch/Night | Ready (switch). TAKE → පළමුව පමණක් ගන්න. Other combinations have no approved wording and DONE refuses them (A14) |
| G20 | **Morning/Lunch/Night frequency sentence** | No frequency sentence existed; the label prints the rows only (උදේ ① දවල් ① රෑ ①). **No "Morning only", "Morning + Night" or quantity-aware mapping exists anywhere in the system**, contrary to the brief's assumption | Ready (switch): දිනපතා 3 වරක් ගන්න when all three periods have the same quantity and neither GIVE nor a form is chosen. Every other pattern shows "No approved Sinhala wording for … Awaiting pharmacist." and prints nothing (A15, A16) |
| G21 | **STAT quantity on the printed label** | The owner's phrase has no quantity; the sheet's example has one. Replacing the English line would lose the quantity | As built: phrase printed exactly, quantity kept on the existing "STAT n" line (S2) |
| G22 | **Printed label overflow (existing defect)** | The printed instruction area is a fixed 26 mm box that hides overflow above and below. Today's wording already overflows for busy labels (137 px of content in 98 px): the dose row and tags were invisible on paper, and Print & Save still printed | **Fixed (both modes):** the review page measures each 1:1 preview; an overflowing label is outlined in red with a reason, and Print & Save is disabled. Save without printing still works (B2) |
| G23 | **Spec wording + STAT overflows** | With spec wording, STAT + doses + TAKE AFTER needs 127 px of 98 px, so G22 blocks printing these labels | Blocking for switching spec wording on (S1) |
| G24 | Ordering | Sheet 6: the STAT instruction, then ඉන්පසු, then what follows | Printed order: පළමුව පමණක් ගන්න · ඉන්පසු · දිනපතා 3 වරක් ගන්න · (NAB/OAB sentence). ඉන්පසු only appears when something follows |
| G25 | A7 vs the owner's example | The sheets require TAKE/GIVE after any schedule (A7), but the owner's example generates දිනපතා 3 වරක් ගන්න with no TAKE tapped | The phrase is shown; with A7 on, DONE still asks for TAKE/GIVE. Needs reconciling (A7) |

## Final pass (print safety, 2026-10-11)

| # | Finding | Status |
|---|---|---|
| G26 | The review page said "Actual 8cm × 8cm"; the label and page are 70 × 50 mm | Fixed (caption) |
| G27 | Print waited a fixed 150 ms, not for the Sinhala font | Fixed: waits for fonts and two layout frames |
| G28 | **"Save Draft" saved a COMPLETED prescription** (and dispenses stock for a stocked medicine); no draft path exists | Renamed "Save without printing"; a real draft needs approval (B3) |
| G29 | Spacing inside the 26 mm box | Gap between rows 4 → 2 px, between Sinhala lines 2 → 0 px; sizes unchanged (B4) |
| G30 | The guard allowed content to touch the box edge | Now needs 1 px clear at the top and bottom, and re-measures when Print & Save is pressed (B5) |
| G31 | Busy labels and spec STAT labels still don't fit | Layout options L1–L7 measured; owner decision S1 (`PRINT_LAYOUT_AND_STAT_OPTIONS.md`) |
| G32 | STAT shown twice with spec wording | Options A/B compared; decision S2 |

## State and synchronisation findings

- **One place builds the sentence now.** `lib/instructionEngine.ts` holds both wordings and the workflow analysis. The label builder, DONE check, Administration card and grid tiles all call it, so they cannot disagree. The old inline logic in `labelBuilder.ts` moved there unchanged (proved by the existing `labelBuilder` and `oabLogic` tests, plus 18 "current wording" tests).
- **Tap order is preserved** in `additionalInstructions`. That makes With Food → Chewable detectable, and the old order-independent logic still works.
- **Each label keeps its own workflow** (tested by switching labels mid-workflow).
- **Refused taps change nothing.** They set a one-line notice that clears on the next allowed tap or label change.
- **The interval quantity cannot go stale.** It is kept when switching 6H → 8H and cleared when the last interval is removed.

## Not changed

Approved Sinhala tables (`constants/oabInstructions.ts`). Printed-label layout, dimensions and typography: `PrintableLabel.tsx` gained only a `data-label-body` attribute, used to measure the box; nothing visual changed. Save, SMS, API, database and payload are unchanged. The print flow is unchanged except that it is blocked for overflowing labels (G22). No migration was applied; nothing was pushed or deployed.
