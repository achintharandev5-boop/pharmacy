# Feature 05 — Dissolve and Drink SAM

Date: 24 October 2026.

**Feature #7 is complete. Feature #8 and later features have not started.**

Primary specification: the Dissolve and Drink section of `C:/Users/Achintha/Downloads/Document 5.pdf`, pages 6–7, starting at the end of page 5. Feature #7 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` was also checked. Implementation follows the attached Feature 05 request.

## Root cause and previous gaps

- The engine already supported standalone TAKE/GIVE + BEFORE/AFTER, but used `දියකර` without the space requested by the PDF and this feature.
- Both meal-condition combinations were missing. Form mutual exclusivity removed With Food/Empty Stomach when Dissolve and Drink was selected, and the text generator did not recognize a combined Dissolve workflow.
- Dissolve had no shared selection-refusal rule. Incompatible SAMs could replace it instead of being disabled, and legacy combinations lacked specific order validation.
- Feature 04 supplied a suitable pattern for store/UI refusal, restored-state validation and final print checks. This feature adds equivalent Dissolve-specific policies without changing the completed Chewing policy.
- `labelBuilder.ts` already takes its administration sentence from the engine. The selected panel, review and printed card already consume that built data, so no parallel formatter or separate screen was necessary.
- Save without printing records a completed prescription, not a draft. It needed its own Dissolve validation in addition to DONE and print validation.

## Implementation

- The existing `DISSOLVE AND DRINK` code and UI label remain.
- Added ordered With Food + Dissolve and Empty Stomach + Dissolve workflows in both wording modes. The store retains the preceding meal condition and clears stale BEFORE/AFTER selections.
- Added `dissolveSelectionRefusal`, shared by the grid and store. Incompatible tiles are natively disabled and faded; direct store actions also refuse them without replacing the existing method.
- Selecting Dissolve over an existing Keep in Mouth is refused rather than creating an invalid pair or silently replacing that method. Existing Chewing-first refusal remains unchanged.
- The engine rejects reversed/incompatible restored combinations and returns no administration sentence for invalid or incomplete Dissolve selections.
- Standalone Dissolve requires TAKE/GIVE and BEFORE/AFTER. Combined meal-condition workflows require TAKE/GIVE but disable and omit meal timing.
- Dissolve-related administration selections turn blue, using the existing controls and touch/focus behavior.
- `dissolvePrintError` reuses the workflow analysis for DONE/review/final-action validation. Review disables both completed Save and Print for invalid/incomplete Dissolve; both final callbacks independently check current state before any API save.
- Deselecting the method releases its locks. Existing Back, reset, label navigation, draft restoration and STAT cancellation rules remain intact.
- `InstructionTile.tsx`, `SelectedInstructionsPanel.tsx`, `labelBuilder.ts` and `PrintableLabel.tsx` were inspected and reused. Their layout and rendering did not require changes for this feature.

## Selection-order and locking matrix

The same rules apply in current and spec modes. Already selected options remain removable so an invalid draft can be corrected.

| Selection/order | Allowed? | Required administration | Meal timing | Locking behavior |
| --- | --- | --- | --- | --- |
| Dissolve first | Yes | TAKE or GIVE | BEFORE or AFTER required | Chewing, With Food, Empty Stomach and Keep in Mouth locked |
| With Food → Dissolve | Yes | TAKE or GIVE | Locked and omitted | Retain With Food; incompatible unselected methods locked |
| Empty Stomach → Dissolve | Yes | TAKE or GIVE | Locked and omitted | Retain Empty Stomach; incompatible unselected methods locked |
| Dissolve → With Food | No | Correct the selection order | Not added | Disabled in UI; refused by store |
| Dissolve → Empty Stomach | No | Correct the selection order | Not added | Disabled in UI; refused by store |
| Dissolve → Chewing | No | Remove Dissolve first | Existing valid timing retained | Disabled in UI; refused by store |
| Dissolve → Keep in Mouth | No | Remove Dissolve first | Existing valid timing retained | Disabled in UI; refused by store |
| Keep in Mouth → Dissolve | No | Remove Keep in Mouth first | Existing selection retained | Refused without replacing the existing method |
| Invalid legacy/restored combination | Invalid | Correct order/conflict | Engine reports required inputs | Completed Save and Print blocked |
| Deselect Dissolve | Yes | According to remaining selections | According to remaining meal condition | Dissolve-specific locks released |

## Exact Sinhala TAKE/GIVE output

These outputs are identical in current and spec modes for Dissolve and Drink:

| Selection | Generated administration sentence |
| --- | --- |
| Dissolve + TAKE + BEFORE | දිය කර බොන්න කෑමට පෙර |
| Dissolve + TAKE + AFTER | දිය කර බොන්න කෑමට පසු |
| Dissolve + GIVE + BEFORE | දිය කර බොන්න දෙන්න කෑමට පෙර |
| Dissolve + GIVE + AFTER | දිය කර බොන්න දෙන්න කෑමට පසු |
| With Food → Dissolve → TAKE | කෑමත් සමඟ දිය කර බොන්න |
| With Food → Dissolve → GIVE | කෑමත් සමඟ දිය කර බොන්න දෙන්න |
| Empty Stomach → Dissolve → TAKE | හිස් බඩ දිය කර බොන්න |
| Empty Stomach → Dissolve → GIVE | හිස් බඩ දිය කර බොන්න දෙන්න |

The existing approved GIVE wording **`බොන්න දෙන්න`** is preserved. The previous Dissolve-only spelling `දියකර` changes to the explicitly requested **`දිය කර`**. Wording-mode configuration and unrelated Sinhala phrases, including the inherited Chewing current/spec distinction, remain unchanged.

Integration examples through the existing product-type printing policy:

- `කරල් 1½ බැගින් පැය 6කට වරක් කෑමත් සමඟ දිය කර බොන්න`
- `කරල් 1½ බැගින් පැය 5කට වරක් හිස් බඩ දිය කර බොන්න දෙන්න`
- `කරල් 1 බැගින් දිනකට 2 වරක් හිස් බඩ දිය කර බොන්න`
- `කරල් 1 බැගින් දිනකට 3 වරක් හිස් බඩ දිය කර බොන්න`
- `දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ දිය කර බොන්න`

The STAT dose remains separate from its follow-up instruction. Combined meal-condition sentences contain no appended BEFORE/AFTER phrase or duplicate action wording.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | Dissolve-specific combinations, order/refusal policy, sentence generation and validation |
| `apps/web/constants/oabInstructions.ts` | Requested spacing in Dissolve-only wording; existing verbs retained |
| `apps/web/store/labelStore.ts` | Refuse prohibited actions and retain the preceding meal condition |
| `apps/web/components/label/InstructionGrid.tsx` | Use Dissolve selection locks for disabled/faded tiles |
| `apps/web/components/label/LabelActions.tsx` | Combined-workflow names and blue selected Dissolve administration controls |
| `apps/web/components/label/LabelActionPage.tsx` | Review Save/Print guards and validation message |
| `apps/web/app/label/page.tsx` | Independent final Save and Print validation before API calls |
| `apps/web/components/label/DissolveSam.test.tsx` | 56 new tests across both modes |
| `apps/web/app/label/page.test.tsx` | Five additional DONE/final Save/Print tests |
| `apps/web/lib/instructionEngine.test.ts` | Dissolve spacing and suppression of the old incomplete sentence |
| `apps/web/lib/oabLogic.test.ts` | Dissolve-only expected spacing |
| `apps/web/components/label/Workstation.test.tsx` | Dissolve-only expected spacing |
| `apps/web/components/label/WorkflowGuide.test.tsx` | Dissolve-only expected spacing |
| `PHARMACY_FEATURE_05_DISSOLVE_AND_DRINK_REPORT.md` | This report |

Earlier uncommitted work was preserved. This list identifies this feature's edits rather than ownership of the complete working-tree diff. Chewing's dedicated tests and policy, product-type mapping/printing rules, dosage formatter, API source and database schema were preserved.

## Test results

| Verification | Result |
| --- | --- |
| Full web Vitest | **32 files, 619 tests passed** |
| Relevant API Jest suites: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings**, unchanged from Feature 04 |
| Web production build | Passed; generated 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

The 61 added tests cover standalone TAKE/GIVE and timing, both ordered meal combinations, missing inputs, reverse/incompatible selections, native disabled behavior, direct store refusal, invalid drafts, selected text, exact preview/print output, review Save/Print, final-action checks bypassing review controls, BD/TDS, intervals, STAT/EOD, fractions, navigation, restoration, Back and reset. All existing Chewing, dosage, product-type and ENT regressions pass.

Vitest and the web production build used execution outside the sandbox to allow worker spawning. API tests used the existing in-memory database harness. Their deliberate failure-path logs do not represent production operations.

## Remaining limitations and safeguards

- Full API lint remains an unrelated repository-wide release blocker; no rules were suppressed or unrelated API code auto-fixed.
- Device verification is still needed for physical printer alignment, paper output and actual Sinhala font rendering. Existing 70 × 50 mm dimensions and print-fit safeguards remain unchanged.
- Existing historical-label editing/browser-reload draft-storage and numeric precision boundaries remain unchanged.
- No live database integration was performed. No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #7. Feature #8 requires separate approval.
