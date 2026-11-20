# Printed Label: Print Size and Layout Redesign Report

Date: 29 October 2026.

**Result:** the application already produced exactly 70 × 50 mm pages, one label per page. The "small label on Letter paper" preview comes from the printer driver's paper setting, which CSS cannot override (§1, §10). The printed label itself was redesigned:
- no blank placeholders;
- the space of omitted rows goes to the instructions;
- Sinhala instructions fitted from 17 px down to 13.5 px (the previous fixed size) and never smaller;
- a safe margin inside the label instead of a border on the paper edge;
- pharmacy branding taken from configuration instead of being hardcoded.

Instruction wording, line order, dosage logic, validation, Reasons and GRN expiry behaviour are unchanged. No backend, database, migration, deployment, commit or push was involved. Feature #21 and #22 staging verification remain pending. **Physical printer verification is pending (§11).**

The two screenshots mentioned in the brief did not come through. The analysis below is based on the code, the measured browser output and the description.

## 1. Root cause of the incorrect print size

- The print CSS was already correct: `@page { size: 70mm 50mm; margin: 0 }` in both `app/globals.css` and the label's own print stylesheet, `html, body` at 70 × 50 mm, and one `.print-label-page` per page.
- **Measured before any change:** headless Edge printing the 14-label check page to PDF with CSS page size honoured gave **14 pages, each 69.85 × 50.12 mm**. That is 70 × 50 mm rounded to whole PDF points (198 × 142 pt).
- **Why the preview shows "Paper size: Letter":** Chromium browsers apply the CSS page size when saving as PDF. When the destination is a **printer driver** (a label printer, or Windows' "Microsoft Print to PDF"), they use that driver's selected paper. A driver set to Letter makes the browser place the 70 × 50 mm page on a Letter sheet, shrunk and centred. That is the small label in the middle of the screenshot.
- **The fix is printer-driver configuration** (§10): a 70 × 50 mm custom paper size, scale 100 %, margins none. No web application can force a browser or driver to choose a custom paper size.
- No app-side cause was found: no transforms, zoom, scaling or centring in the print CSS.

## 2. Files changed

- `apps/web/components/PrintableLabel.tsx`: label redesign (rows, safe margin, optional rows, footer, fitted instruction size), print CSS (offline Sinhala fallbacks, `break-inside: avoid`, no break after the last label).
- `apps/web/lib/pharmacyBranding.ts` (new): pharmacy name, address and phone from `NEXT_PUBLIC_PHARMACY_NAME`, `NEXT_PUBLIC_PHARMACY_ADDRESS` and `NEXT_PUBLIC_PHARMACY_PHONE`.
- `apps/web/lib/labelFit.ts`: the guard also reports any row pushed past the label edges (e.g. a footer collision). The "expiry row" name was updated.
- `apps/web/.env.example`, `apps/web/.env.staging.example`: the three branding variables documented.
- `apps/web/.env.local` (local, git-ignored): set to the values that used to be hardcoded (SISILA CHEMIST, No200, Koralawella, Moratuwa, and the phone line), so this installation prints the same footer.
- Tests:
  - New `apps/web/components/LabelPrintLayout.test.tsx` (23 tests).
  - Assertions that pinned the old fixed row heights (30.5 / 34 mm), the old fixed `text-[13.5px]` class and "DISPENSED BY: SISILA" were updated in `AddExpiryDate`, `Daily`, `DigitalLabel`, `Weekly`, `NameOfDays` and `TillToDay`. They now check the new behaviour: the instruction area takes the free height, and the fitted size is never below 13.5 px.

## 3. Before / after layout

| | Before (P3) | Now |
|---|---|---|
| Label box | 70 × 50 mm, 1 px border on the paper edge | 70 × 50 mm, **no edge border**; safe margin 1 mm top/bottom, 1.5 mm sides |
| Medicine row | Fixed 5 mm; printed "MEDICINE" when no name | Shown only with a name or quantity; name in full (up to 2 lines) or blocked |
| Patient row | Fixed 4.5 mm; printed "Patient: ________" / "Pt: _____" when empty | Shown only with a patient or alternative brand |
| Instructions | Fixed 30.5 mm (34 mm without expiry); Sinhala 13.5 px | **All remaining height**; Sinhala **17 → 16 → 15 → 14 → 13.5 px**, the largest that fits |
| Reasons | Inside instructions, 12 px | Same place; 1.5 px smaller than the instruction size (12 px at the minimum) |
| Expiry | 3.5 mm row with "DISPENSED BY: SISILA" | Only when Add Expiry Date is selected; "EXP DATE : date" only |
| Footer | Hardcoded SISILA name, address and phone | Configured name, address (hidden by Remove Address) and phone, each omitted when unset; issue date always |

Measured in the browser (sample check page, both wordings):
- 22 of 28 cards print at **17 px**, and the busiest printable case (S12) at 15 px.
- **S7, S11 and S12 now print.** They were previously blocked by lack of space; S11 because its long patient name now wraps onto two lines.
- **S10** (three long reasons, 14 days, three weekdays and an expiry row) is still refused, as it was before. Re-applying the previous layout's metrics to the same content gives 32.4 mm of content in a 30.5 mm box, so it already overflowed. The guard refuses it rather than printing a clipped label.
- **S13** (95-character medicine name) is still refused, as designed.

## 4. Exact page dimensions

- Each label element: **264.56 × 188.97 CSS px = 70.00 × 50.00 mm** (measured in Edge).
- PDF (CSS page size honoured): **14 scenario labels → 14 pages**, and **the real workstation flow (two labels → review → Print layout preview) → 2 pages**. Every page is **69.85 × 50.12 mm**, which is 70 × 50 mm to whole PDF points.
- No blank pages: the last label has no page break after it. No breaks inside a label (`break-inside: avoid`).

## 5. Sinhala font and readability

- The fonts are unchanged: Gemunu Libre, then Noto Sans Sinhala (Google Fonts), both checked as loaded in the measurement run. **Iskoola Pota** and **Nirmala UI**, the Sinhala fonts that ship with Windows, were added as offline fallbacks, so shaping stays correct without internet.
- Printing still waits for `document.fonts.ready` and two animation frames (unchanged).
- Instruction size is fitted per label: the largest step that fits, re-fitted when fonts finish loading and when the area resizes. It never goes below the previous 13.5 px. Line height is 1.25, as before.
- Natural word wrapping. No text is shortened, summarised or re-ordered.

## 6. Optional-field handling

| Missing | Printed |
|---|---|
| Patient name | No patient row (and no "Patient:") |
| Medicine name | No name and no "MEDICINE"; the quantity alone keeps a small header; with neither, no header |
| Alternative brand | No "Brand:" |
| Expiry not selected | No expiry row |
| No reasons | No reasons block |
| Pharmacy name / address / phone not configured | Each omitted; the date still prints |

The space of every omitted row goes to the instructions. Saving, dispensing, product-type and clinical validation are unchanged and separate.

## 7. Overflow and safety validation

The existing guard (`lib/labelFit.ts`) still runs on the review page and again at the moment of printing. It refuses a label when:
- the instruction content overflows its area (vertical, with a 1 px printer margin);
- any text runs past its row (horizontal or vertical);
- a medicine, brand or patient name doesn't fit even on two lines;
- **(new)** any row is pushed past the label edge (e.g. a footer collision).

Space is reclaimed first, then the font steps down. At 13.5 px nothing shrinks further: the label is blocked with a named reason, and Save without printing remains available. Nothing is truncated or summarised.

## 8. Automated test results

| Check | Result |
|---|---|
| Full web Vitest | **58 files, 1,952 passed** (1,929 before + 23 new) |
| New `LabelPrintLayout.test.tsx` | 70 × 50 mm box and safe margin; `@page` / page breaks / no transforms; multiple labels as separate pages; patient, medicine, brand, expiry and reasons omitted when empty; no placeholders; footer configured / not configured / Remove Address; exact wording for basic, STAT, 5H, 6H, 8H, Daily, Weekly, Name of Days, Till to the Day and unequal circled rows; fitting picks the largest fitting size and stops at 13.5 px with the guard blocking; footer pushed past the edge is reported |
| Existing save/print safety, UI testing mode, expiry, Reasons suites | Passed (unchanged behaviour) |
| Web TypeScript | Passed |
| Web ESLint | Passed, 0 findings |
| Web production build | Passed |
| `git diff --check` | Passed |

No API or backend code changed, so the API suites were not rerun.

## 9. Browser / PDF verification

Headless Edge, UI testing mode (no backend):
- check page: 14 labels → 14 PDF pages at 69.85 × 50.12 mm;
- real workstation flow (two labels → review → Print layout preview, nothing saved): 2 pages, same size;
- label element 70.00 × 50.00 mm;
- 3× screenshots of S1, S4, S7, S10, S11 and S12 inspected (session scratchpad: `shots/label_after_*.png`; PDFs `after-printcheck.pdf`, `e2e-two-labels.pdf`).

**A browser PDF is not proof of physical printer output.**

## 10. Required printer-driver and browser settings

1. In the printer driver (Windows: Printer properties → Preferences / Page Setup → Paper or Stock), **create a custom paper size of 70 mm × 50 mm**. Select the label stock (gap or black-mark sensing) the printer uses.
2. In the browser print dialog, pick that printer and that paper size. **Paper size must not be Letter or A4.**
3. **Scale: 100 % / Actual size / Default**, not "Fit to page".
4. **Margins: None** (or Default, where the driver's own non-printable margin applies; the label keeps 1 mm / 1.5 mm inside its edges).
5. **Headers and footers: off.** Background graphics: on (black lines).
6. **Orientation:** as the printer feeds the stock. The label is landscape (70 mm wide, 50 mm tall); some drivers need "Landscape", others a 70 × 50 portrait stock. Check with the first test print.
7. For "Save as PDF", the browser uses the label's 70 × 50 mm page size automatically.

## 11. Physical printer verification checklist (pending; not verified)

For each printer model, record PASS/FAIL with a photo (see also `PHARMACY_PRINTER_ACCEPTANCE_CHECKLIST.md`):
- [ ] 70 × 50 mm stock loaded; custom 70 × 50 mm paper size created and selected in the driver.
- [ ] Orientation correct; label not rotated or shifted on the stock.
- [ ] Scale 100 % / actual size; ruler check: printed area 70 × 50 mm, text 1 mm from the top/bottom edges and 1.5 mm from the sides.
- [ ] Margins none; no text or line clipped at any edge.
- [ ] Sinhala sharp and correctly shaped at 17 px, 15 px and the 13.5 px minimum (S1, S12 and a dense label); combining marks intact.
- [ ] Badges (circled doses), separators and EXP DATE legible.
- [ ] Multi-label print: one label per stock, no blank labels, no drift across 10+ labels, feed and gap sensing correct.
- [ ] Footer branding correct as configured; Remove Address hides only the address.
- [ ] Offline test: Sinhala still correct with the Windows fallback fonts.

## 12. Remaining blockers and notes

- **Physical printer verification is pending (§11).** Browser and PDF results do not prove printer accuracy.
- **Branding must be configured in every deployment.** Set `NEXT_PUBLIC_PHARMACY_NAME`, `NEXT_PUBLIC_PHARMACY_ADDRESS` and `NEXT_PUBLIC_PHARMACY_PHONE` before building. If unset, the footer prints only the date. No API serves `pharmacy_settings` yet; reading it would be a backend change, which this task excluded.
- **"DISPENSED BY: SISILA" is no longer printed:** it was hardcoded, and the footer now names the configured pharmacy. Please confirm with the pharmacist if a separate "dispensed by" line is required.
- The SMS message text in the review page (`LabelActionPage.tsx`) still contains the SISILA name and phone. That is workstation UI, outside this label-only task.
- Feature #21 and #22 staging verification remain pending.
