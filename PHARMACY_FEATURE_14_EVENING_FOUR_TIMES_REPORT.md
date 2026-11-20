# Feature 14 — Evening and Four-Times-Daily Dosing

Date: 24 October 2026.

**Feature #16 is complete. Feature #17 and later features have not started.**

Sources: the attached Feature 14 request, Feature #16 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `Document 5.pdf` in the same directory, particularly pages 30–33. Digital Label rules/Picture No. 5 and completed STAT/EOD/USB/SAM policies were reused.

## Audit and confirmed gaps

- Evening is both a standalone time instruction and an independent additional time alongside Digital Label. It is not an interval or an alias for Night. Its existing `frequencyDosage` record already holds its independent quantity.
- Quantity entry already used the shared Number Pad, but there was no explicit Evening Done confirmation. Digital controls could be used without the PDF's confirmation step.
- Evening could replace an incompatible frequency, or be added after existing Digital doses, contrary to the specified Evening → quantity → Done → Digital order.
- The existing product-type policy already consolidated four equal doses using the required Sinhala words. It correctly required all three Digital times plus Evening, and was retained.
- Unequal Evening quantity was printed separately from the Digital badges. The shared normalized rows had no Evening slot, so the combined schedule did not have one chronological circled-row representation.
- Standalone output used an English control tag/frequency-style wording rather than the exact `හවසට` sentence. Preview/save summaries could repeat its quantity.
- Existing generic USB/SAM guards did not guarantee validation of Evening confirmation and all schedule conflicts at completed Save/Print.

## Specification decisions

1. **All four positive doses are required for “four times daily.”** The PDF's broad “all selected times” wording could otherwise describe partial schedules as four doses. The user explicitly selected the all-four requirement during this task. Partial selections retain individual circled rows, even when their selected quantities match. No missing dose is inserted as 1.
2. **Evening alone remains type-free.** PDF page 32 includes Product Type in its standalone example, but this request's section 9 explicitly requires the existing type-free policy. That explicit instruction was followed; no standalone product-type injection was introduced.
3. **Existing STAT/EOD selection order takes precedence over the Evening page's list of available buttons.** STAT/EOD may precede Evening; selecting them late does not bypass their completed first-selection rules.

## Implementation

- Added shared `eveningSelectionRefusal`/`eveningProblem` policies and a small `eveningPrintError` adapter over existing DONE readiness. The grid, native disabled Digital controls and direct store entry points use the same restrictions.
- Reused `frequencyDosage` for the Evening quantity. Its optional `confirmed` metadata records the explicit Done step; there is no second Evening dose value or independent normalization system.
- Added compact Done/Back controls to the existing administration card. USB/SAM remain available for Evening alone. Done is disabled until a positive finite quantity has been committed with Number Pad Enter; it enables Digital Label. Back cancels pending Number Pad input and returns to the Function Pad using existing semantics.
- Editing the committed Evening quantity or its fraction invalidates Digital confirmation while preserving existing Digital quantities. Done reconfirms it. Cancelling a pending pad edit preserves the prior committed quantity/confirmation.
- Evening-first is required for new combined selections. Incompatible or late selections are refused without deleting existing doses. Removing Evening clears its quantity and releases only Evening's restrictions; existing Digital quantities remain. Selected-instruction reset clears Evening quantity/confirmation to prevent hidden stale frequency data.
- Extended the existing `digitalSchedule` projection with `printRows`: Morning → Lunch → Evening → Night, omitting unselected zero Digital slots. The original BD/TDS rows/pattern detection remain intact.
- Reused the Feature 13 circled-row renderer for partial/unequal Evening combinations. Evening is included once in the same rows; its separate frequency badge is suppressed. Four equal positive doses retain the existing product-type sentence.
- Standalone sentences use `quantity + හවසට + existing administration`. No English `EVENING` tag, duplicated dose, extra schedule or new medical verb is generated. The selected preview, review, saved text and printed card consume the same built data.
- DONE, review, review callbacks and final Save/Print validate current state. Final handlers independently recheck labels before any prescription API write. Invalid labels have label-numbered errors and remain editable.
- ENT's own frequency editor/templates bypass oral Evening gating. Existing physical dimensions, font loading and print-fit code were retained.

## Compatibility matrix

| Selection/order | Result |
| --- | --- |
| Evening alone → quantity → complete USB/SAM | Allowed without Digital Done; type-free `හවසට` sentence |
| Evening → quantity → Done → Digital | Allowed; independent quantities retained |
| All four positive and equal | Existing product type + common quantity + `බැගින් දිනකට හතර වරක්` + administration |
| Partial or unequal selected times | Chronological individual circled rows; no false common frequency or product-type word |
| Evening → 8H/6H/5H/Daily/other frequency | Refused; selected options faded and natively disabled |
| Interval/Daily/Digital already selected → Evening | Refused without replacing the existing schedule; remove the conflicting selection first |
| STAT → Evening | Existing independent initial prefix retained; late STAT remains refused |
| EOD → Evening | Existing text-only modifier retained; late EOD remains refused |
| Weekly + Evening alone | Existing Weekly modifier retained; no separate Weekly workflow implemented |
| Weekly + Evening + Digital | Blocked: no approved combined four-dose frequency sentence is specified; ordinary Weekly + BD/TDS without Evening is unchanged |
| TAKE/GIVE + BEFORE/AFTER | Existing complete USB requirements and wording modes retained |
| With Food/Empty Stomach and completed SAM combinations | Existing action, timing and selection-order rules retained |
| Missing/unsupported product type | Blocks true four-equal-dose output; standalone/partial/unequal type-free formats remain available |
| Invalid/unconfirmed restored combination | Correctable; completed Save/Print blocked until required correction/Done |
| Remove Evening | Its quantity/confirmation cleared; Digital doses preserved; remaining policies continue to apply |
| ENT Evening | Existing templates, units and frequency behavior preserved |

The four-dose count and Evening/partial print rules follow the user clarification above. The compatibility basis is PDF pages 30–33, completed interval/STAT/EOD rules, and the existing Digital/Weekly specification boundaries. This task does not implement Daily or Weekly feature changes.

## Exact Sinhala output

Examples valid in both modes when using the indicated meal-condition combinations:

- Evening 1½ + Empty Stomach + TAKE: `1½ හවසට හිස් බඩ ගන්න`
- Evening ½ + With Food + GIVE: `½ හවසට කෑමත් සමඟ දෙන්න`
- Four equal Karal doses 1½ + Empty Stomach + TAKE: `කරල් 1½ බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න`
- Four equal Packet doses ½ + Empty Stomach → Dissolve + GIVE: `පැකට් ½ බැගින් දිනකට හතර වරක් හිස් බඩ දිය කර බොන්න දෙන්න`
- STAT 2 then four equal Karal doses 1: `පළමුව පමණක් 2 ගන්න ඉන්පසු, කරල් 1 බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න`
- EOD then four equal Karal doses 1: `දිනක් හැර දිනක්, කරල් 1 බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න`

For unequal Morning 1 / Lunch 2 / Evening 1½ / Night 3 with GIVE:

- Left column: `උදේට` circled `1`, `දවල්` circled `2`, `හවසට` circled `1½`, `රාත්‍රියට` circled `3`.
- Right column: `හිස් බඩ දෙන්න`.
- Exact saved/selected text: `උදේට 1  |  දවල් 2  |  හවසට 1½  |  රාත්‍රියට 3 | හිස් බඩ දෙන්න`.

Current/spec administration suffix ordering and the inherited standalone Chewing wording distinction remain unchanged. The existing fraction formatter handles whole, half, mixed and third quantities; the existing numeric precision boundary remains.

## Structured printing and saved representation

- The existing 70 × 50 mm label and 30.5 mm instruction area are unchanged. Four individual rows reuse the same circular CSS badge, row separators and administration column introduced in Feature 13. No badge/font reduction or overflow bypass was added.
- Print-fit rejection remains active at review and again at the click. Automated tests simulate overflow and verify no print callback is invoked. Actual paper/font alignment remains a device check.
- The existing API payload stores Morning/Lunch/Night as `dosage` and Evening as `frequency: EVENING` plus `frequencyQty`. The service already writes separate `morning_qty`, `lunch_qty`, `night_qty`, `frequency_type`, `frequency_qty`, instructions JSON and final text. New API tests verify those values independently in the in-memory harness.
- `frequencyDosage.confirmed` is editor workflow metadata preserved by serialized `LabelData` drafts and per-label navigation. It is not a new database column. Historical API records are not claimed to round-trip this editor flag.
- The existing historical prescription reprint path remains disabled. This feature preserves structured numeric data and editor-draft restoration; it does not add historical reprinting or claim physical badge fidelity from a historical record.

## Files changed

Production paths below are relative to `apps/web/`:

| File | Change |
| --- | --- |
| `lib/eveningPolicy.ts` | New shared selection, quantity and confirmation validation |
| `lib/digitalSchedule.ts` | Extend the existing projection with ordered Evening print rows |
| `lib/instructionEngine.ts` | DONE readiness and shared final-action adapter |
| `store/labelStore.ts` | Confirmation metadata/action, selection refusal and Evening-specific reset |
| `lib/labelBuilder.ts` | Exact standalone/structured text and suppression of duplicate frequency output |
| `components/PrintableLabel.tsx` | Reuse shared circled rows while preserving consolidated four-dose output |
| `components/label/LabelActions.tsx` | Compact Done/Back and accessible confirmation state |
| `components/label/InstructionGrid.tsx` | Native disabled incompatible selections |
| `components/label/DosagePanel.tsx` | Digital confirmation gate |
| `components/label/LabelActionPage.tsx` | Review/callback Save and Print checks |
| `app/label/page.tsx` | Independent final Save/Print checks |

Tests: new `components/label/Evening.test.tsx`; additional `app/label/page.test.tsx` entry-point/payload tests; related fixtures/assertions updated in `DigitalLabel.test.tsx`, `StatWorkflow.test.tsx`, `UsbAdministration.test.tsx`, `WorkflowGuide.test.tsx`, `Workstation.test.tsx`, `PrintedInterval.test.tsx` and `ProductTypePrinting.test.tsx`. New API test: `apps/api/src/prescriptions/evening-label.spec.ts`. This report is also new.

Earlier uncommitted changes were preserved. This list describes this feature's edits, not ownership of complete working-tree diffs. The product-type resolver/policy, dosage formatter, API production code and database schema were reused without changes.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **41 files, 1,324 tests passed** |
| Relevant API Jest, including Digital/Evening persistence | **5 suites, 61 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Targeted API ESLint on new test | Passed |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated all 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

New tests cover Evening-only wording/actions, explicit confirmation, native locking/direct refusal, quantity editing and Back, equal four-dose output for all product types, partial/unequal row order, fractions/mixed/thirds, invalid quantities and drafts, corrected confirmation, Weekly boundary, STAT/EOD, all completed SAM combinations, per-label navigation/restoration, reset and print-fit rejection.

The feature adds 66 dedicated web cases, 21 final-page cases and two API persistence cases. All Features 01–13 and ENT regressions pass. Related four-dose fixtures now follow Evening → quantity → Done → Digital, and old frequency-style Evening preview assertions were updated to the required `හවසට` output before the successful full rerun.

Final-action tests bypass review controls, mutate labels after review and verify both Save and Print refuse invalid quantities, unconfirmed Digital combinations, interval/Daily conflicts, missing type/action and invalid SAM order before API calls. Valid Save tests inspect exact generated text and independent numeric quantities; simulated failure responses avoid real writes.

Vitest uses a 15-second per-test timeout and at most two workers without changing repository configuration. Worker spawning/build required execution outside the sandbox. API tests use the existing in-memory harness. No rules were suppressed and no unrelated API auto-fixes were applied.

## Remaining limitations and safeguards

- Existing full API lint remains a repository-wide release blocker.
- Physical printer alignment, actual Sinhala font rendering and four-row paper output remain unverified. Four rows plus STAT, reasons or other modifiers may exceed the fixed instruction area; measured overflow blocks printing rather than shrinking text or forcing it onto the label.
- Existing historical reprint/editing, browser-reload draft-storage and numeric precision boundaries remain. No live database integration was performed.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #16. Feature #17 requires separate approval.
