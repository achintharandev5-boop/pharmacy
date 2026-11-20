# Feature 07 — Keep in Mouth (දිව මත)

Date: 24 October 2026.

**Feature #9 is complete. Feature #10 and later features have not started.**

Requirements were checked against `C:/Users/Achintha/Downloads/Document 5.pdf`, pages 9–11, Feature #9 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` in the same directory, and the attached Feature 07 request.

## Existing implementation and root causes

- Spec mode already defined the four standalone Sinhala sentences. Current mode excluded Keep in Mouth from administration workflows and form exclusivity. It retained an English tag and generated an ordinary administration sentence instead of the required Keep in Mouth instruction.
- Empty Stomach → Keep in Mouth had no workflow or combined sentence. Spec-mode form replacement discarded the preceding Empty Stomach selection.
- Existing Chewing, Dissolve and With Food policies covered several conflicts, but Keep in Mouth first did not consistently lock all incompatible methods. Empty Stomach also allowed With Food to replace it.
- DONE and the selected panel already consumed centralized administration analysis. Review and final Save/Print needed the equivalent Keep in Mouth validation used by recent SAM features.
- `InstructionTile.tsx`, `SelectedInstructionsPanel.tsx` and `PrintableLabel.tsx` were inspected and reused. Existing native disabled/faded styling, selected blue tiles, preview data and print rendering were suitable. No physical layout change was needed.

## Implementation

- Added shared Keep in Mouth selection-refusal, restored-state validation and sentence generation in the existing instruction engine. Both wording modes use its existing PDF-approved words, including GIVE `තබන්න`.
- Standalone Keep in Mouth requires TAKE/GIVE and BEFORE/AFTER. No administration sentence is generated before those inputs are complete.
- Added Empty Stomach → Keep in Mouth in both modes. The store preserves the preceding condition and removes stale meal timing. The combined sentence requires an action and omits BEFORE/AFTER.
- The grid and direct store actions share the same refusal policy. Incompatible methods cannot silently replace Keep in Mouth, and selected invalid draft options remain removable for correction.
- Existing timing locks, reset, Number Pad Back, label navigation and serialized-draft restoration are reused. Keep in Mouth administration buttons now turn blue when selected.
- The builder consumes the shared sentence and removes Keep in Mouth from raw control tags in both modes. It no longer emits an English Keep in Mouth tag beside an unrelated instruction.
- DONE uses the existing engine validation. Review disables completed Save and Print and displays a label-numbered error. Both final callbacks independently recheck current labels before any prescription API write, including edits after review.
- Chewing/Dissolve formatters, product-type printing rules, dosage formatting, ENT and wording-mode configuration remain unchanged.

## Compatibility and locking matrix

The same rules apply in current and spec modes.

| Selection/order | Allowed? | Required inputs | Locks |
| --- | --- | --- | --- |
| Keep in Mouth alone | Yes | TAKE/GIVE and BEFORE/AFTER | Chewing, Dissolve, With Food and Empty Stomach |
| Empty Stomach first | Yes | Existing administration choices | With Food and BEFORE/AFTER; Keep in Mouth, Chewing and Dissolve remain available |
| Empty Stomach → Keep in Mouth | Yes | TAKE/GIVE | BEFORE/AFTER, Chewing, Dissolve and With Food |
| Keep in Mouth → Empty Stomach | No | Correct the order | Refused in UI and direct store actions |
| Keep in Mouth → Chewing/Dissolve/With Food | No | Remove the existing method first | Refused without replacement |
| Chewing/Dissolve/With Food → Keep in Mouth | No | Remove the existing method first | Refused without replacement |
| Deselect Keep in Mouth | Yes | According to remaining selections | Keep in Mouth-specific locks released; Empty Stomach timing locks remain if selected |
| Invalid/reversed restored draft | Invalid | Correct conflicting selections/order | Completed Save and Print blocked |
| Incomplete standalone/combined draft | Incomplete | Select missing action/timing as applicable | No complete administration sentence; completed Save and Print blocked |

## Exact Sinhala examples

Both wording modes produce these sentences:

| Selection | Output |
| --- | --- |
| Keep in Mouth + TAKE + BEFORE | දිව මත තබා ගන්න කෑමට පෙර |
| Keep in Mouth + TAKE + AFTER | දිව මත තබා ගන්න කෑමට පසු |
| Keep in Mouth + GIVE + BEFORE | දිව මත තබන්න කෑමට පෙර |
| Keep in Mouth + GIVE + AFTER | දිව මත තබන්න කෑමට පසු |
| Empty Stomach → Keep in Mouth → TAKE | හිස් බඩ දිව මත තබා ගන්න |
| Empty Stomach → Keep in Mouth → GIVE | හිස් බඩ දිව මත තබන්න |

Spec-mode standalone wording was already correct. Current mode previously omitted the Sinhala Keep in Mouth method; it now uses the explicitly requested PDF wording. No unrelated Sinhala phrases were changed. GIVE is `තබන්න`, not a duplicated TAKE/GIVE phrase. Combined output contains no appended meal timing.

Examples through the unchanged product-type printing policy:

- `පැකට් 1½ බැගින් පැය 8කට වරක් හිස් බඩ දිව මත තබා ගන්න`
- `පැකට් 1½ බැගින් පැය 6කට වරක් හිස් බඩ දිව මත තබා ගන්න`
- `පැකට් 1½ බැගින් පැය 5කට වරක් හිස් බඩ දිව මත තබා ගන්න`
- `පැකට් 1½ බැගින් දිනකට 2 වරක් හිස් බඩ දිව මත තබා ගන්න`
- `පැකට් 1½ බැගින් දිනකට 3 වරක් හිස් බඩ දිව මත තබා ගන්න`
- `දිනක් හැර දිනක්, පැකට් ½ බැගින් පැය 6කට වරක් හිස් බඩ දිව මත තබන්න`

STAT retains its existing separate dose and phrase/pill. No product type is injected into type-free workflows.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | Ordered workflow, common Sinhala generation, selection refusal and validation |
| `apps/web/store/labelStore.ts` | Shared refusal and preservation of preceding Empty Stomach |
| `apps/web/lib/labelBuilder.ts` | Remove the English control tag in both modes; use shared sentence |
| `apps/web/components/label/InstructionGrid.tsx` | Native disabled/faded policy locks |
| `apps/web/components/label/LabelActions.tsx` | Combined workflow name and blue selected administration controls |
| `apps/web/components/label/LabelActionPage.tsx` | Review and callback Save/Print validation |
| `apps/web/app/label/page.tsx` | Independent final Save/Print checks before API calls |
| `apps/web/components/label/KeepInMouth.test.tsx` | 46 new tests across both wording modes |
| `apps/web/app/label/page.test.tsx` | Six new DONE/final-action/save-payload tests |
| `apps/web/lib/instructionEngine.test.ts` | Replace expectations for superseded current-mode English-tag behavior |
| `apps/web/store/labelStore.buttons.test.ts` | Verify required Empty Stomach → With Food refusal and correction |
| `PHARMACY_FEATURE_07_KEEP_IN_MOUTH_REPORT.md` | This report |

Earlier uncommitted work was preserved. The list describes this feature's edits, not ownership of entire working-tree diffs. No API source or database schema was changed.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **34 files, 715 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing failure: **1,064 errors, 63 warnings**, unchanged from Feature 06 |
| Web production build | Passed; generated 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

The 52 added tests cover all six sentences in both modes, ordering, native disabled/faded controls, direct-store refusal, missing inputs, invalid restored drafts, review correction, selected instructions, preview/print text, fixed dimensions, reset/Back, per-label navigation and restoration, mixed quantities, 8H/6H/5H, BD/TDS, STAT/EOD and dynamic product types. Existing Features 01–06 and ENT suites pass.

Final-action tests bypass review's disabled controls and verify that incomplete/reversed Keep in Mouth prevents prescription API calls. A separate test captures a valid Save request's `finalInstructionText` and checks the same generated instruction; its API response is a simulated failure, so no real prescription is written. API tests use the existing in-memory harness and deliberately simulated failure paths.

Vitest and the web build ran outside the sandbox to permit worker spawning. Initial test failures for superseded behavior and incorrectly encoded new fixtures were corrected before the successful full rerun.

## Remaining limitations and safeguards

- Full API lint remains an unrelated repository-wide release blocker. No rules were suppressed or unrelated API code auto-fixed.
- Physical printer alignment, paper output and actual Sinhala font rendering still require device verification. The existing 70 × 50 mm layout and print-fit safeguards remain unchanged.
- No live database integration was performed. Existing historical editing, browser-reload draft-storage and numeric-precision limitations remain unchanged.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #9. Feature #10 requires separate approval.
