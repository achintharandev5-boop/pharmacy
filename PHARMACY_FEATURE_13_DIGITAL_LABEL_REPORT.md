# Feature 13 — Digital Label (BD/TDS)

Date: 24 October 2026.

**Feature #15 is complete. Feature #16 and later features have not started.**

Primary sources: `C:/Users/Achintha/Downloads/Document 5.pdf`, pages 22–25, including visual inspection of Picture No. 5, and Feature #15 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` in the same directory. Related interval, STAT/EOD and Weekly rules were checked against the completed policies and PDF pages 16–21, 31–32 and 37.

## Existing implementation audit

- The PDF defines Digital Label through **Morning, Lunch and Night**, rather than separate BD/TDS preset buttons. BD is equal positive Morning/Night with Lunch unselected; TDS is equal positive quantities at all three times. Single-time selections are explicitly supported.
- Existing independent +/−/X/Y controls, Number Pad, Back, label navigation and draft restoration were reusable. No separate BD/TDS state or new preset buttons were necessary.
- Feature 03 already supplied equal-dose consolidation, the product-type resolver and Weekly + equal BD/TDS wording. Feature 12 already refused interval/digital conflicts.
- The printed unequal-dose badges were arranged in a horizontal line. Picture No. 5 instead shows selected time rows stacked on the left, their quantities inside circles, row separators, and administration on the right of a slanted divider.
- Preview/save summaries used English time descriptions while printing used separate Sinhala labels. Equal-dose summaries could repeat quantities before the consolidated sentence.
- Invalid digital quantities and malformed draft slots lacked a single validation path covering review and both final actions. Current-mode Digital + Daily could bypass spec-only locking.
- The audit included the engine, builder, product-type policy, store, grid/tile, dosage/actions/selected panel, review/final page handlers, printable component and existing dosage, interval, BD/TDS and print-fit tests.

## Confirmed gaps and fixes

1. Added `digitalSchedule.ts`, a shared projection of the existing per-time dose records. It produces ordered numeric/formatted rows and derives BD/TDS through numeric equality. It adds no independent selection state.
2. Reused that projection in the product-type policy, builder and printable metadata. Equal doses produce the existing approved consolidated sentence exactly once. Unequal values retain all selected times and quantities and never imply a common dose.
3. Implemented Picture No. 5's unequal-dose arrangement using the existing circular CSS badge, vertically ordered time rows, horizontal row separators and a slanted column divider. The administration sentence remains on the right. No Unicode circled numeral or new time icon was introduced.
4. The normalized time text feeds preview/save summaries and printing. Morning `උදේට` and Night `රාත්‍රියට` follow Picture No. 5; Lunch retains the existing approved `දවල්`. Unrelated administration wording is unchanged.
5. Selected time quantity buttons turn blue and expose their selected state. Existing active editing indication, fraction controls, native disabled states, touch targets and workstation layout remain.
6. Added shared Digital/Daily refusal in both wording modes, including direct store/pad entry points. Existing interval restrictions remain active. Refused selections preserve existing doses and instructions.
7. Added non-negative finite quantity and malformed-draft checks. Missing draft slots remain invalid and correctable in the detached editor copy, rather than becoming an assumed dose. Legacy BD/TDS marker instructions are rejected for correction; actual selection still uses the three time controls.
8. Added `digitalPrintError`, which reuses DONE's `analyseLabel`, product-type requirements and existing USB/SAM checks. Review disables completed Save and Print and displays label-numbered errors. Both final handlers independently recheck current labels before any prescription API call.
9. Preserved the existing 70 × 50 mm sections, fonts and print-fit guard. No font shrinking or overflow bypass was added for the unequal layout.

## Zero, incomplete schedules and switching

Zero is an **unselected time**, not a prescribed zero-dose badge. Pages 22–23 explicitly permit individual times, and Picture No. 5 shows Morning/Night without a Lunch row. Only selected positive rows print.

There is no separate intended-BD/intended-TDS flag to go stale. Adding Lunch to equal Morning/Night creates TDS; removing Lunch returns to BD. Changing one quantity converts the schedule into individual rows. A single selected time remains a permitted individual-time instruction rather than an incomplete TDS label. No missing dose or administration action is inferred as 1/TAKE.

Negative/non-finite quantities, missing draft slots, conflicting legacy BD/TDS markers, interval/Daily conflicts, invalid SAM order and required missing product types are blocked. Users can correct the same label or remove conflicting selections.

## PDF-grounded compatibility matrix

| Selection | Behavior | Basis |
| --- | --- | --- |
| Equal Morning/Night, Lunch zero | BD: shared quantity, permitted product type and twice-daily sentence | Pages 23–24 |
| Equal Morning/Lunch/Night | TDS: shared quantity, permitted product type and three-times-daily sentence | Pages 23–24 |
| Unequal selected times | Ordered individual circled quantities; no oral product-type word or misleading common frequency | Page 24, Picture No. 5 and Feature 03 |
| Single selected time | Retain that time/quantity; no invented BD/TDS pattern | Pages 22–23 |
| STAT first + Digital | Existing initial prefix and independent regular doses retained | Page 24 and completed STAT policy |
| EOD first + Digital | Existing text-only modifier/order rules retained | Page 24 and completed EOD policy |
| Weekly + equal BD/TDS | Type + common quantity + `සතියකට වරක්` + administration | Page 37 |
| Weekly + unequal/single-time Digital | Blocked: the supplied Weekly printing rule defines equal BD/TDS, not an alternative unequal format | Page 37; no new wording invented |
| Evening + Digital | Existing combination behavior retained, including existing four-equal-dose consolidation | Pages 24–25 and existing Feature 03 policy |
| Digital + Daily | Mutually refused in both wording modes | Page 25 |
| Digital + 8H/6H/5H | Mutually refused; restored conflicts blocked | Pages 16 and 25; Feature 12 |
| TAKE/GIVE + BEFORE/AFTER | Existing complete USB instructions retained | Existing approved USB rules |
| With Food/Empty Stomach and their supported SAM combinations | Existing action, timing and order rules retained | Completed Features 04–08 |
| Chewing/Dissolve/Keep in Mouth alone | Existing standalone action/timing requirements retained | Completed SAM policies |
| ENT | Existing ENT templates/units retained; oral Digital validation does not replace ENT validation | Explicit regression safeguard |

This feature does not implement the separate Evening/four-times-daily workflow or alter its state machine. Their previously implemented integration is covered by regression tests.

## Exact Sinhala examples

Equal-dose examples using the shared instruction output:

- `පෙති 1 බැගින් දිනකට 2 වරක් කෑමත් සමඟ ගන්න`
- `කරල් ½ බැගින් දිනකට 3 වරක් හිස් බඩ දෙන්න`
- `පැකට් 1½ බැගින් දිනකට 2 වරක් හිස් බඩ දිව මත තබා ගන්න`
- `කරල් 1 සතියකට වරක් හිස් බඩ ගන්න`

For unequal Morning 1½ / Night ½ with Empty Stomach + GIVE:

- Left column: `උදේට` + circled `1½`, followed by `රාත්‍රියට` + circled `½`.
- Right column: `හිස් බඩ දෙන්න`.
- Saved/selected text: `උදේට 1½  |  රාත්‍රියට ½ | හිස් බඩ දෙන්න`.

For unequal Morning ½ / Lunch 1½ / Night 2, the left rows remain Morning → Lunch → Night. The exact saved text is `උදේට ½  |  දවල් 1½  |  රාත්‍රියට 2 | හිස් බඩ දෙන්න`.

The bars in text are separators, not printed circled numerals. Printing uses structured rows and CSS circles. Existing current/spec USB suffix ordering and the inherited standalone Chewing wording distinction remain unchanged. Quantities use the existing Feature 01 formatter, including thirds.

## Saved representation and printing boundary

- The workstation payload already carries numeric `dosage.morning/lunch/night`, administration instructions and `finalInstructionText`. It continues to send those fields; normalized row metadata is derived rather than becoming a second stored dosage state.
- `PrescriptionsService` already writes `morning_qty`, `lunch_qty`, `night_qty`, `instructions_json.instructions` and `final_instruction_text`. The schema uses unrestricted `NUMERIC` columns for the three quantities; no schema change was needed or executed.
- New API harness tests verify both unequal two-time and three-time records preserve their individual numeric values and exact supplied instruction text. Web final-action tests verify the matching request payload.
- Serialized `LabelData` restoration regenerates the same badge metadata from its numeric dose slots, including mixed quantities. Original draft objects remain detached from editor changes.
- The existing prescription detail page displays saved quantities/text and deliberately disables historical reprinting through `REPRINT_UNAVAILABLE_REASON`. It does **not** reconstruct a `LabelCard` from a historical prescription. No historical reprint route was added, and historical physical badge fidelity is not claimed. The preserved columns/instructions are structured data, not only a flattened text snapshot.
- Automated tests verify DOM row order, selected quantities, circular styling, the administration column, fixed dimensions and overflow rejection. Actual printer/font rendering still requires device verification.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/digitalSchedule.ts` | Shared normalized rows, derived patterns, compatibility and invalid-state checks |
| `apps/web/lib/productTypePrinting.ts` | Reuse numeric BD/TDS detection; existing product-type map/wording retained |
| `apps/web/lib/instructionEngine.ts` | Shared readiness and final-action Digital adapter |
| `apps/web/store/labelStore.ts` | Digital/Daily refusal, direct pad guards and malformed draft handling |
| `apps/web/lib/labelBuilder.ts` | Shared row metadata and consistent text; no duplicate consolidated dose summary |
| `apps/web/components/PrintableLabel.tsx` | Picture No. 5 unequal-row layout and normalized time text |
| `apps/web/components/label/DosagePanel.tsx` | Blue selected quantity controls and shared Daily restriction |
| `apps/web/components/label/InstructionGrid.tsx` | Native disabled Digital/Daily locks |
| `apps/web/components/label/LabelActionPage.tsx` | Review/callback validation and label-numbered errors |
| `apps/web/app/label/page.tsx` | Independent final Save/Print checks |
| `apps/web/components/label/DigitalLabel.test.tsx` | 70 new tests across both wording modes |
| `apps/web/app/label/page.test.tsx` | 22 new DONE/final-action/saved-payload tests |
| `apps/web/components/label/Workstation.test.tsx` | Update preview assertions to shared Sinhala time text |
| `apps/web/components/label/DosageQuantityControls.test.tsx` | Retain fraction regression with the shared Sinhala preview text |
| `apps/web/components/ProductTypePrinting.test.tsx` | Retain unequal Evening regression with Picture No. 5's Morning label |
| `apps/web/components/label/WorkflowGuide.test.tsx` | Verify native disabled state rather than expecting a disabled button's click handler |
| `apps/api/src/prescriptions/digital-label.spec.ts` | Two new structured persistence tests |
| `PHARMACY_FEATURE_13_DIGITAL_LABEL_REPORT.md` | This report |

Earlier uncommitted changes were preserved. This list describes this feature's edits rather than ownership of complete working-tree diffs. No API production code, database schema, product-type mapping or dosage formatter was changed.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **40 files, 1,237 tests passed** |
| Relevant API Jest, including new Digital persistence suite | **4 suites, 59 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Targeted API ESLint on new test | Passed |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated all 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

New coverage includes equal and unequal BD/TDS, all three product types, half/mixed/third quantities, zero/unselected slots, malformed/legacy drafts, switching through Lunch controls, blue/native disabled states, fraction editing/Back/reset, both directions of interval/Daily refusal, STAT/EOD/Weekly/Evening integration, all completed SAM combinations, per-label independence/restoration and print-fit rejection.

All completed Features 01–12 and ENT regression suites pass. Obsolete assertions for English preview summaries, old Morning print text and disabled-button click handlers were corrected before the successful full rerun; unrelated instruction assertions remain intact.

Final-action tests bypass review controls, change labels after review and verify that completed Save and Print reject invalid quantities, schedule/type/action/order conflicts before any prescription API write. Valid Save tests inspect the structured quantities and exact text at the API boundary; simulated failure responses avoid real record writes.

Vitest uses a 15-second per-test timeout without changing repository test configuration. Diagnostic runs used one worker; final verification uses at most two workers. Worker spawning/build execution require running outside the sandbox. API tests use the existing in-memory database harness. No lint rules were suppressed or unrelated API files auto-fixed.

## Remaining limitations and safeguards

- Existing full API lint remains a repository-wide release blocker.
- Physical alignment, real Sinhala font rendering, fractional circle appearance and paper output still require printer verification. The fixed 70 × 50 mm size, 30.5 mm instruction section and print-fit safeguard remain unchanged.
- No live database integration or historical prescription reprint was performed. Existing browser-reload draft storage, historical editing and numeric storage precision limitations remain unchanged.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #15. Feature #16 requires separate approval.
