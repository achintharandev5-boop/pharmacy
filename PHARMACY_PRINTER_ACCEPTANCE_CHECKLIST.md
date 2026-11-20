# Pharmacy Label Printer Acceptance Checklist

**Target output:** prescription label 70×50 mm.  
**Status:** physical acceptance NOT TESTED. PDF/browser layout is not proof of physical output. This checklist must be completed on the actual supported workstation, printer, driver and label roll.

## Test environment record

- Pharmacy/branch: ____________________
- Workstation OS/build: ____________________
- Browser/version: ____________________
- Printer make/model/serial (restrict serial if policy requires): ____________________
- Driver/name/version: ____________________
- Connection/interface: ____________________
- Label manufacturer/stock/roll and gap/mark specification: ____________________
- Printer resolution/darkness/speed: ____________________
- App build/commit/template version: ____________________
- Date/time/timezone/operator/witness: ____________________
- Pharmacist reviewer: ____________________

Use synthetic patient data. Record measurements and anonymized images under the pharmacy’s approved evidence-retention policy. Do not capture real patient data for this test.

## Setup

- [ ] Confirm roll matches the template size/orientation and is loaded per manufacturer instructions.
- [ ] Set print scale to 100% / actual size; disable fit-to-page and unwanted margins/headers/footers.
- [ ] Verify selected paper size is 70×50 mm or the driver’s correct equivalent; check rotation/orientation.
- [ ] Print and measure a calibration pattern at edges and center; record width/height and offsets before clinical content tests.
- [ ] Confirm printer firmware/driver settings and browser print dialog are recorded and repeatable.
- [ ] Confirm saved label/prescription is not reported as physically printed solely because the browser dialog opened.

## Acceptance cases

For every case record: **PASS / FAIL / BLOCKED**, measured result, photo/evidence ID, operator initials and pharmacist initials. Any wrong patient, medicine, strength, dose, quantity or expiry; unreadable directions; clipped content; or unexplained duplicate is an immediate fail.

| ID | Scenario | Expected result / checks | Result / evidence |
|---|---|---|---|
| L01 | Basic 70×50 mm label | Actual printed size and orientation match template; all content inside safe area. | |
| L02 | Sinhala-only dosage directions | Correct Sinhala glyphs/shaping/diacritics, no substitutions or broken combining marks; pharmacist confirms readability. | |
| L03 | English-only label | Medicine/patient/directions and punctuation render without clipping. | |
| L04 | Mixed Sinhala and English | Correct font fallback, line order and direction; no overlap or unexpected wrap. | |
| L05 | Long patient and medicine names | Fit guard result matches preview; text remains legible or printing is explicitly blocked with actionable reason. No silent truncation. | |
| L06 | Dense dosage instructions and maximum approved content | All dose, frequency, duration, quantity and STAT/follow-up details are readable; blocked cases do not print incomplete data. | |
| L07 | Expiry/date details | Correct value and format from saved record; visually distinct and legible; no date rollover/timezone mismatch. | |
| L08 | Multiple labels in one job | Correct ordering, one label per intended item, page breaks/feed gaps correct; no missing or duplicated labels. | |
| L09 | Margins and die-cut alignment | Measure top/left/right/bottom offsets on multiple labels and record tolerance approved by hardware owner/pharmacist. No content enters cut zone. | |
| L10 | Repeat feed / continuous run | Print at least the pharmacy-approved run count; measure drift at first, middle and last labels. | |
| L11 | Cancel before browser dialog submission | No false “printed” status; saved record and subsequent operator action are clear. | |
| L12 | Printer offline, out of labels or jam | App does not claim physical success. Staff recovery/retry path is clear; no duplicate dispense/stock deduction. | |
| L13 | Retry after uncertain output | Operator can distinguish saved, dialog invoked and operator-confirmed output. Retry is reasoned and must not create a second dispense. | |
| L14 | Reprint from history | Reprint references same saved prescription/label snapshot and records actor/reason if supported. No stock movement or prescription duplication. | |
| L15 | Darkness/contrast/read distance | Text and key clinical data remain readable under pharmacy lighting; pharmacist approves. | |

## Pass criteria and sign-off

- Every safety-critical content case passes on the exact approved printer/driver/stock combination.
- Measurements fall within written hardware-owner tolerances and repeat-feed alignment remains acceptable.
- Overflow block and operator recovery procedure are understood and tested.
- No test represents browser-dialog invocation as printer acknowledgement; reprint causes no second stock deduction.
- Retest after any driver, browser, template, font, printer firmware or stock change that may affect output.

Overall outcome: **PASS / FAIL / NOT COMPLETED**  
Approved printer/driver/stock combination: ____________________  
Exceptions and remediation: ____________________  
Operator: ____________________ Date: __________  
Pharmacist: ____________________ Date: __________  
Hardware/operations owner: ____________________ Date: __________

Current repository evidence: print layout targets 70×50 mm and PDF/browser tests exist; physical output remains **NOT TESTED**.
