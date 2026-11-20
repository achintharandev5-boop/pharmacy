# Printed Label: P3 Layout, STAT Option B and Full-Label Print Guard

Updated 2026-10-11 (P3 implementation) · For the owner and pharmacist (approvals) and developers (measurements).

## Summary

- **Layout P3 is now the printed label** (`components/PrintableLabel.tsx`), as decided for testing (S1, S3). The instruction area grows from 26 to 30.5 mm by trimming the other rows. The label is still 70 × 50 mm, and no instruction text is smaller. Every supported label fits, including today's busy label, which used to be blocked.
- **STAT Option B is built behind the wording switch** (S2). With `NEXT_PUBLIC_LABEL_WORDING=spec` the label prints පළමුව පමණක් ② ගන්න, with the quantity once. The switch is **off**: with today's wording the STAT line prints exactly as before ("STAT 2, then 8H").
- **Names are never cut off or shortened with "…" any more (B7).** A long medicine, brand or patient name gets smaller in steps, then wraps onto two lines. If it still doesn't fit, printing is blocked and the field is named.
- **The print guard now checks the whole label:** names, patient row, dose rows, Sinhala lines, expiry row and footer. It no longer checks only the instruction area. Staff see the reason, and Save without printing stays available.
- **Not tested on a physical printer** (B6). Checklist in §8.

## 1. Layout, before and after (mm)

| Row | Before | **Now (P3)** | Contents |
|---|---|---|---|
| 1 Product | 5.5 | **5.0** | Medicine name (full, see §3), quantity 10.5 px |
| 2 Patient | 5.0 | **4.5** | Patient name (full) and date; or brand (full) · patient · date |
| **3 Instructions** | **26.0 (98.3 px)** | **30.5 (115.3 px)** | Dose row, interval line, Sinhala lines, reason, shared row |
| 4 Dispensed by / EXP | 4.0 | **3.5** | 8–8.5 px |
| 5 Footer | 9.5, 3 lines | **6.5, 2 lines** | "SISILA CHEMIST" + address on line 1 (address hidden by Remove Address), phone on line 2 |
| **Total** | 50.0 | **50.0** | Page and label 70 × 50 mm |

Inside the instruction area:

| Item | Before | Now |
|---|---|---|
| Sinhala instruction lines | 13.5 px bold, line height 1.375 | 13.5 px bold, **line height 1.25** |
| ඉන්පසු ("then", spec wording only) | Own line | At the end of the line before it ("පළමුව පමණක් ② ගන්න ඉන්පසු"); same words, same order |
| Days · days of week · STAT pill · English tags | Four rows | **One row that wraps when full**, same reading order |
| Separate instructions | One per line | Still one per line: never joined into one sentence |
| Dose row, reason, interval line | 22 px badges, 12 px reason | Unchanged |

Unchanged: all Sinhala wording, dosage calculations, the order of instructions, the printing workflow (save first, then one print), `@page 70mm 50mm`.

**Images.** Before: `workflow-audit/print-prototypes/before-after-S4-stat-spec.png` and `before-after-S7-busy-default.png` (left label of each; the dose row is cut off at the top), `brand-row-P0.png` (brand cut at both ends). After: `workflow-audit/print-p3/after-*.png` (real label, 3× zoom), and the review page on desktop and tablet: `review-spec-stat-1366.png`, `review-spec-stat-1024.png`, `review-default-overflow-1024.png`.

## 2. Measurements on the real label

Instruction-area content height / box height in CSS px (96 px = 25.4 mm), measured in Edge with the Sinhala fonts loaded. A label must stay 1 px inside the box (≤ 113.3 px). "Before" is the previous label (box 98.3, limit 96.3). Source: `workflow-audit/print-p3/label-check-results.json`.

| # | Label | Today's wording: before → **now** | Spec wording: before → **now** |
|---|---|---|---|
| S1 | Morning 1 + TAKE AFTER | 43 → **41** | 43 → **41** |
| S2 | M/L/N 1/1/1 + TAKE AFTER + 5 days | 58 → **56** | 76 → **73** |
| S3 | S2 + one reason | 75 → **73** | 93 → **90** |
| S4 | S2 + STAT 1 → 8H | 76 → **59** | 132 ✗ → **91** |
| S5 | Morning 1 + TAKE AFTER + STAT 1 → 8H | 61 → **59** | 98 ✗ → **73** |
| S6 | STAT 2 alone + TAKE AFTER | 37 → **35** | 74 → **35** |
| S7 | Busy: doses, TAKE AFTER, Weekly, Till Date, And This Date, 2 reasons, Monday, STAT | 125 ✗ → **107** | 180 ✗ → **124 ✗** |
| S8 | Interval 8H × 1 + TAKE AFTER + 5 days | 58 → **56** | 58 → **56** |
| S9 | ½/½/½ + GIVE BEFORE + 7 days | 58 → **56** | 58 → **56** |
| S10 | Morning 2 / Night 2 + Chewable + 3 long reasons + 14 days + 3 weekdays | 104 ✗ → **102** | 104 ✗ → **102** |
| S11 | Long medicine, brand and patient names + 1½/1/1½ + With Food GIVE + 30 days | 58, brand cut ⚠ → **blocked: patient name** (§3) | same |
| S12 | Everything (S7 + 1½ doses, Chewable, 3 long reasons, 7 weekdays, 30 days) | 167 ✗ → **149 ✗** | 204 ✗ → **163 ✗** |
| S13 | Very long medicine name (95 characters) | cut with "…" → **blocked: medicine name** | same |
| S14 | Long patient name, no brand (51 characters) | cut with "…" → **prints, name on 2 lines** | same |

✗ = blocked by the guard (never printed clipped).

**Print engine (Edge, PDF):** 14 labels gave 14 pages in each wording, and 3 labels from the real Print & Save gave 3 pages. Page size: 198 × 142.08 pt = 69.85 × 50.12 mm (Chromium rounds to whole points, as it did before). No blank extra page.

## 3. Names: shown in full or blocked (B7)

Before: the medicine and patient names were shortened with "…", and a long brand lost both ends with no "…" (the cell centred the text and hid the overflow). The guard did not notice, so these labels printed.

Now each name goes through these steps until it fits (fitted on the screen preview and on the hidden print copy alike):

| Name | One line, in steps | Then | If still too long |
|---|---|---|---|
| Medicine | 11.5 → 10.5 → 9.5 → 9 px | Two lines at 8 px | Blocked: "medicine name too long to print in full" |
| Alternative brand (32 mm cell) | 9 → 8.5 → 8 px | Two lines at 8 px | Blocked: "alternative brand name too long to print in full" |
| Patient (no brand) | 9.5 → 9 → 8.5 → 8 px | Two lines at 8 px | Blocked: "patient name too long to print in full" |
| Patient (beside a brand) | 9 → 8.5 → 8 px | Two lines at 8 px | Blocked, as above |

8 px is the smallest text already on the label (tags 8 px, phone 7.5 px). Names never go below it. Approving 8 px for names is item B9.

Rough limits (bold capitals): a medicine name of about 40 characters fits on one line. Two lines hold about 70–80 characters, and a 95-character name (S13) is blocked. A patient name next to a brand has the least room: about 30 characters (S11's 41 characters is blocked). Staff can enter a shorter form of the name, or Save without printing.

The brand row's two cells used to be 2 px wider than the space inside the label border; the patient cell now takes the remaining width.

## 4. The print guard (`lib/labelFit.ts`)

Print & Save is refused, with the reasons shown, when any of these is true:

| Check | Covers |
|---|---|
| Instruction content not at least 1 px inside the 30.5 mm area | Dose rows, interval line, Sinhala lines, reason, days, weekdays, STAT, tags |
| A name marked as not fitting (§3) | Medicine, alternative brand, patient |
| Any text in any row running past that row's edges | Product row, patient/brand row, instructions, expiry row, footer |

It runs on the review page's 1:1 preview after layout, again when a late font finishes loading, and again when Print & Save is pressed. The preview now loads the same font rules as the print, so it measures the font that will print. Before, the preview could fall back to Noto Sans Sinhala on some builds while the print used Gemunu Libre. The message names the label and the field, for example: "label 1: alternative brand name too long to print in full". **Save without printing** is never blocked. It records a **completed** prescription and dispenses stock for a stocked medicine, the same as Print & Save without the print.

## 5. STAT quantity: Option B (spec wording only)

| | Today's wording (switch off, what prints now) | Spec wording with Option B (switch on, after approval) |
|---|---|---|
| Sinhala STAT line | none | පළමුව පමණක් **②** ගන්න (number before the verb, as in the STAT sheet's example) |
| Quantity printed | Once, in the pill "STAT 2, then 8H" | Once, in the phrase. No pill |
| Fractions | "STAT 1½" | Circled badge showing "1½" |
| Follow-up | In the pill | Small tag "THEN 8H" (English, as before; A12 still open) |
| Daily doses | Dose row (උදේ ① දවල් ① රෑ ①) | Dose row, unchanged: STAT stays out of it |
| Order | — | STAT phrase (with ඉන්පසු) → daily phrase → administration sentence, as the builder orders them |
| GIVE / BEFORE / AFTER / forms with STAT | — | No approved wording: DONE refuses them (unchanged), so Option B never appears for them |
| Saved record | "STAT 2, then 8H" and the approved phrase text | Unchanged: the number is added only on the printed label |

Option B alters the owner's phrase on the printed label by inserting the number. **It needs the owner's and pharmacist's approval before the switch is turned on.**

## 6. Remaining overflow cases (blocked; nothing is split onto a second label)

| Case | Measured | What staff do |
|---|---|---|
| Busy label in spec wording (S7) | 124 / 115 px | Remove an instruction (e.g. And This Date, or one reason) |
| Everything selected (S12) | 149–163 / 115 px | Remove instructions |
| Very long medicine name (S13, about 70+ characters) | Doesn't fit on two lines at 8 px | Enter a shorter name, or Save without printing |
| Long patient name beside a brand (about 30+ characters) | Doesn't fit on two lines at 8 px | Shorten the name |

Second labels (L6) were not built, as instructed.

## 7. Files

| File | Change |
|---|---|
| `components/PrintableLabel.tsx` | P3 layout, `FitText` names, Option B rendering, row markers for the guard; print copy laid out off-screen (not `display: none`) so its names are fitted before printing; `PRINT_LABEL_CSS` shared with the review page |
| `lib/labelBuilder.ts` | Spec wording only: `statInPhrase` (phrase, quantity, follow-up) when the approved STAT phrase is produced |
| `lib/labelFit.ts` | `labelProblems` / `labelFitReport`: whole-label checks with reasons |
| `components/label/LabelActionPage.tsx` | Shows the reasons; loads the print font rules; re-measures on late fonts |
| `app/label/print-check/` | Development-only page: the real label for 14 sample prescriptions in both wordings, with the guard's verdict (`notFound()` in production). Replaces the prototype page |
| `apps/api/test/db/serve-local.ts` | Optional `LOCAL_API_PORT` (default 3001) so the local test API can run beside a real one |

## 8. Physical printer test checklist (B6, still to do)

Driver: **70 × 50 mm, scaling off ("Actual size" / 100 %), no margins**.

| # | Print | Check |
|---|---|---|
| 1 | S2 and S4 (today's wording) | Nothing cut at any edge; dose circles round; border on the label |
| 2 | Three labels in one Print & Save | Exactly three labels; no blank label after the last |
| 3 | Busy label S7 (today's wording) | Top dose row and bottom row (days, STAT, tags) both fully printed |
| 4 | Sinhala lines at line height 1.25 | Vowel signs above and below complete; lines don't touch; readable at arm's length |
| 5 | Expiry row (3.5 mm) | "DISPENSED BY" and "EXP DATE" fully printed, not touching the lines |
| 6 | Footer (6.5 mm) | Name, address and phone fully printed and readable |
| 7 | Long names: S11 brand and S14 patient on two lines at 8 px | Both lines readable; the second line not touching the row border |
| 8 | Smallest text: 8 px tags and names, 7.5 px phone | Readable on the printed label |
| 9 | Alignment | Label sits on one die-cut label |

Record: printer model, driver settings, label stock, photos, pass or fail per row. Labels to print can be prepared on the workstation, or viewed on a development machine at `/label/print-check`.

## 9. Verification limits

Measured with Edge's renderer and print engine (PDF). **Physical printing is not verified.** Printer drivers may add margins or scale.
