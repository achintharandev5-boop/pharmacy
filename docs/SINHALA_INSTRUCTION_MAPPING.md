# Sinhala Instruction Mapping

Date: 2026-10-11 (updated with the owner's phrases) · For the pharmacist and the owner.

For each instruction this lists: the text on the handwritten sheets (as read), the text the workstation prints today, and any difference. **Nothing here has been changed on printed labels.** The sheet wording is held in `apps/web/lib/instructionEngine.ts` and is used only after approval (switch `NEXT_PUBLIC_LABEL_WORDING=spec`).

**Legibility.** ● clear · ◐ readable but should be confirmed · ○ not readable, not used. Sheet numbers refer to the source list in `LABEL_WORKFLOW_GAP_ANALYSIS.md`.

## 1. Button words (the "[ ]" words on the sheets)

| Button | Sheet word | Legibility | Sheet |
|---|---|---|---|
| TAKE (NAB) | ගන්න | ● | 10, NAB PDF |
| GIVE (NAB) | දෙන්න | ● | 10, NAB PDF |
| (after TAKE/GIVE) | කෑමට | ● ("must be print") | 10, NAB PDF |
| BEFORE | පෙර | ● | all |
| AFTER | පසු | ● | all |
| Chewable | හපලා | ◐ first letter read as **හ**; the code uses **ස** | 1, 4, OAB PDF |
| Chewable: TAKE / GIVE | කන්න / කන්න දෙන්න | ● | 4 |
| Keep in Mouth | දිව මත | ● | 4 |
| Keep in Mouth: TAKE / GIVE | තබා ගන්න / තබන්න | ● | 4 |
| Dissolve and Drink | දියකර | ● (one output line writes "දිය කර" with a space) | 5, OAB PDF |
| Dissolve: TAKE / GIVE | බොන්න / බොන්න දෙන්න | ● | 5 |
| Empty Stomach | හිස් බඩ | ● | 3, OAB PDF |
| With Food | කෑමත් සමඟ | ◐ last letter read as **ඟ**; the code uses **ග** | 2, OAB PDF |
| Morning | උදේට | ● | 7, Digi PDF |
| Lunch | දවල්ට | ● | 7, Digi PDF |
| Night | රැයට? / රෑට? | ○ | 7, Digi PDF |
| Evening | හවසට | ● | 9 |
| Daily | දිනකට | ● | 9 |
| 8H / 6H / 5H | පැය 8කට වරක් / පැය 6කට වරක් / පැය 5කට වරක් | ● | 8 |
| Units | පෙති / කරල් / පැකට් | ● | 8 |
| STAT | පළමුව පමණක් | ● confirmed by the owner (2026-10-11) | 6, owner |
| STAT "Enter" | ඉන්පසු | ● | 6 |

## 2. Administration sentences

"Sheet" = the sheet's printed output. "Today" = what prints now (`constants/oabInstructions.ts`). Δ = the difference.

### Normal Administration (NAB)

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE + AFTER | ගන්න කෑමට පසු | කෑමට පසු ගන්න | Word order |
| TAKE + BEFORE | ගන්න කෑමට පෙර | කෑමට පෙර ගන්න | Word order |
| GIVE + AFTER | දෙන්න කෑමට පසු | කෑමට පසු දෙන්න | Word order |
| GIVE + BEFORE | දෙන්න කෑමට පෙර | කෑමට පෙර දෙන්න | Word order |

### Chewable

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE + AFTER | හපලා කන්න කෑමට පසු | සපලා කන්න කෑමට පසු | හ / ස |
| TAKE + BEFORE | හපලා කන්න කෑමට පෙර | සපලා කන්න කෑමට පෙර | හ / ස |
| GIVE + AFTER | හපලා කන්න දෙන්න කෑමට පසු | සපලා කන්න දෙන්න කෑමට පසු | හ / ස |
| GIVE + BEFORE | හපලා කන්න දෙන්න කෑමට පෙර | සපලා කන්න දෙන්න කෑමට පෙර | හ / ස |

### Keep in Mouth (◐: the output lines are blurred; these follow the clear button words)

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE + BEFORE | දිව මත තබා ගන්න කෑමට පෙර | English tag "KEEP IN MOUTH" plus the NAB sentence | New |
| TAKE + AFTER | දිව මත තබා ගන්න කෑමට පසු | as above | New |
| GIVE + BEFORE | දිව මත තබන්න කෑමට පෙර | as above | New |
| GIVE + AFTER | දිව මත තබන්න කෑමට පසු | as above | New |

### Dissolve and Drink

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE + BEFORE | දියකර බොන්න කෑමට පෙර | දියකර බොන්න කෑමට පෙර | — |
| TAKE + AFTER | දියකර බොන්න කෑමට පසු | දියකර බොන්න කෑමට පසු | — |
| GIVE + BEFORE | දියකර බොන්න දෙන්න කෑමට පෙර | දියකර බොන්න දෙන්න කෑමට පෙර | — |
| GIVE + AFTER | දියකර බොන්න දෙන්න කෑමට පසු | දියකර බොන්න දෙන්න කෑමට පසු | — |

### Empty Stomach (no BEFORE/AFTER: "locked automatically")

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE | හිස් බඩ ගන්න | හිස් බඩ ගන්න | — |
| GIVE | හිස් බඩ දෙන්න | හිස් බඩ දෙන්න | — |

### With Food (no BEFORE/AFTER)

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| TAKE | කෑමත් සමඟ ගන්න | කෑමත් සමග ගන්න | ඟ / ග |
| GIVE | කෑමත් සමඟ දෙන්න | කෑමත් සමග දෙන්න. | ඟ / ග, and a full stop today. (The September PDF also ends this line with a full stop; the newer sheet 2 does not.) |

### With Food → Chewable (that order only)

| Buttons | Sheet | Today | Δ |
|---|---|---|---|
| With Food, Chewable, TAKE | කෑමත් සමඟ හපලා කන්න | Not possible (Chewable replaced With Food) | New |
| With Food, Chewable, GIVE | කෑමත් සමඟ හපලා කන්න දෙන්න | Not possible | New |
| Chewable, With Food | "didn't work" | — | Refused with a message (spec mode) |

### Partial selections (preview only today; DONE never lets them print)

| Selection | Today's preview | Sheet | Spec mode |
|---|---|---|---|
| BEFORE / AFTER alone | කෑමට පෙර ගන්න / කෑමට පසු ගන්න | No output (TAKE/GIVE required first) | No sentence; "Next: Choose TAKE or GIVE" |
| With Food alone | කෑම සමඟ ගන්න | No output | No sentence |
| Empty Stomach alone | හිස්බඩ ගන්න | No output | No sentence |
| Chewable alone | හපා කන්න | No output | No sentence |
| Dissolve alone | දියකර බොන්න | No output | No sentence |

## 3. Schedule lines

| Item | Sheet | Printed today (`PrintableLabel.tsx`, unchanged) | Δ |
|---|---|---|---|
| 8H with quantity 1 | පෙති 1 බැගින් පැය 8කට වරක් (STAT example) | පෙති ① බැගින් පැය 8කට වරක් | Match. Before this work it never printed (no quantity could be entered) |
| 6H / 5H | [පැය 6කට වරක්] / [පැය 5කට වරක්] | පෙති ① බැගින් පැය 6කට / 5කට වරක් | Match |
| Daily | [දිනකට] | පෙති ① බැගින් දිනපතා | දිනකට / දිනපතා |
| Evening | [හවසට] | පෙති ① බැගින් සවසට | හවසට / සවසට |
| EOD | no sheet | පෙති ① බැගින් දිනක් හැර දිනක් | — |
| Morning / Lunch / Night rows | [උදේට] / [දවල්ට] / [○] | උදේ ① / දවල් ① / රෑ ① | Different form; the sheets give no full sentence |
| Unit | [පෙති / කරල් / පැකට්] | Always පෙති | Capsules and packets missing |
| STAT | [පළමුව පමණක්] + qty + NAB/OAB, then ඉන්පසු, then the follow-up and its NAB/OAB | STAT 2, then 8H (English) | Spec mode: පළමුව පමණක් ගන්න (TAKE) + ඉන්පසු; the English quantity line is kept (see §4) |

## 4. Owner-approved phrases (2026-10-11)

Quoted exactly from the owner's brief. Used only with spec wording; the pharmacist verifies clinical use before live dispensing (A14, A15).

| Situation | Phrase | Status in the workstation |
|---|---|---|
| STAT, any quantity, TAKE (no timing, no form) | **පළමුව පමණක් ගන්න** | Generated (id `STAT_TAKE`) |
| STAT + GIVE | none supplied | No text; "No approved Sinhala wording for STAT with GIVE"; DONE refused |
| STAT + TAKE/GIVE + BEFORE/AFTER | none supplied (the sheet example "පළමුව පමණක් ② ගන්න කෑමට පසු" is an example, not an approved phrase) | No text; DONE refused |
| Morning = Lunch = Night (same quantity, e.g. 1/1/1, ½/½/½) | **දිනපතා 3 වරක් ගන්න** | Generated (id `DAILY_THREE_TIMES_TAKE`) |
| 1/1/1 with GIVE, or with a form instruction | none supplied | No text; notice |
| Morning only · Lunch only · Night only | none in the system | No text; notice "No approved Sinhala wording for Morning 1 …" |
| Any two periods (e.g. Morning + Night) | none in the system | No text; notice |
| Three periods, different quantities (e.g. 2/1/1) | none in the system | No text; notice "(different quantities)" |
| All zero | — | Nothing |
| After a STAT instruction, when anything follows | **ඉන්පසු** (sheet 6: "must be printed") | Printed as its own line after the STAT phrase |

**Printed order (spec):** පළමුව පමණක් ගන්න · ඉන්පසු · දිනපතා 3 වරක් ගන්න · the NAB/OAB sentence (e.g. ගන්න කෑමට පසු) · other tags. The dose row (උදේ ① දවල් ① රෑ ①) and the "STAT n, then …" line are printed as today.

**Duplicate verbs.** With 1/1/1 and TAKE + AFTER the label carries both "දිනපතා 3 වරක් ගන්න" and "ගන්න කෑමට පසු". Nothing is duplicated word for word, but ගන්න appears twice. Please confirm, or supply a combined sentence.

### 4a. Missing mappings (pending the pharmacist)

Every dosage pattern the workstation can produce, and whether approved Sinhala exists. "Shown" is what the workstation does today with spec wording on. Nothing in the "missing" rows is generated. The quantities themselves always print on the dose row (උදේ ① දවල් ① රෑ ①).

| # | Pattern | Example | Approved Sinhala | Shown |
|---|---|---|---|---|
| M1 | Morning only | 1 / 0 / 0 | **missing** | Notice "No approved Sinhala wording for Morning 1" |
| M2 | Lunch only | 0 / 1 / 0 | **missing** | Notice |
| M3 | Night only | 0 / 0 / 1 | **missing** | Notice |
| M4 | Morning + Lunch | 1 / 1 / 0 | **missing** | Notice |
| M5 | Morning + Night | 1 / 0 / 1 | **missing** | Notice |
| M6 | Lunch + Night | 0 / 1 / 1 | **missing** | Notice |
| M7 | All three, same quantity | 1 / 1 / 1 | **දිනපතා 3 වරක් ගන්න** (owner) | Generated |
| M8 | All three, same quantity other than 1 | 2 / 2 / 2 · ½ / ½ / ½ | Same phrase by the same rule (frequency only) | Generated. **Please confirm** (A15) |
| M9 | All three, different quantities | 2 / 1 / 1 | **missing** | Notice "(different quantities)" |
| M10 | Any pattern with GIVE | 1 / 1 / 1 + GIVE | **missing** (දිනපතා 3 වරක් දෙන්න was not given) | Notice |
| M11 | Any pattern with a form (Chewable, Keep in Mouth, Dissolve, With Food, Empty Stomach) | 1 / 1 / 1 + Chewable | **missing** | Notice |
| M12 | Fractions in one or two periods | ½ / 0 / ½ | **missing** (covered by M1–M6) | Notice |
| M13 | 5H / 6H / 8H + quantity | 8H, 1 | Printed today: පෙති ① බැගින් පැය 8කට වරක් (matches the sheet) | Printed |
| M14 | Daily / Evening + quantity | Daily, 1 | Printed today: පෙති ① බැගින් දිනපතා / සවසට; sheet words දිනකට / හවසට | Printed; wording question A10 |
| M15 | EOD + quantity | EOD, 1 | Printed today: පෙති ① බැගින් දිනක් හැර දිනක් (no sheet) | Printed |
| M16 | Units other than tablets | capsules / packets | **missing**: label always says පෙති (A11) | — |
| M17 | STAT + TAKE | STAT 1 | **පළමුව පමණක් ගන්න** (owner) | Generated |
| M18 | STAT + GIVE | STAT 1, GIVE | **missing** | "No approved Sinhala wording"; DONE refused |
| M19 | STAT + BEFORE/AFTER, or a form | STAT 1, TAKE AFTER | **missing** (the sheet's "පළමුව පමණක් ② ගන්න කෑමට පසු" is an example) | Same |
| M20 | STAT follow-up as Sinhala (e.g. "then 8H") | STAT → 8H | **missing**: printed in English in the STAT pill (A12) | English |
| M21 | 1 / 1 / 1 with TAKE + AFTER | — | Two lines: දිනපතා 3 වරක් ගන්න and ගන්න කෑමට පසු (ගන්න twice) | Shown. **Please confirm or give one sentence** |

## 5. Not in any sheet

Till Date (prints English "TILL DATE"; the builder's Sinhala අද දින දක්වා පමණි is keyed to "TILL TO DAY" and never used), And This Date (නියමිත දිනට පමණි), Weekly, Remove Address, Reasons list, EXP date. These are unchanged and remain listed in `BUTTON_LOGIC_AUDIT.md` §8.
