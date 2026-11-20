# Feature 04 — Chewing (හපලා) SAM

Date: 24 October 2026.

**Feature #6 is complete. Feature #7 (the separate Dissolve and Drink feature) has not started.**

Requirements were checked against `Document 5.pdf`, pages 4–5, at `C:/Users/Achintha/Downloads/Document 5.pdf` and Feature #6 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` from the same directory.

## Existing implementation findings

- `CHEWABLE` is the existing internal code and “Chewable” is the existing UI label. Both are retained.
- The engine already supported the four standalone TAKE/GIVE + BEFORE/AFTER instructions. Spec mode also supported With Food → Chewable, but current mode treated that combination as With Food alone.
- Empty Stomach → Chewable was missing. Form mutual exclusivity removed the meal condition when Chewable was selected.
- The store refused Chewable → With Food only in spec mode. Other prohibited selections could replace Chewable, and the grid did not natively disable the four incompatible SAM tiles.
- Existing `InstructionTile.tsx` already provided native disabled behavior, faded styling and blue selected states. The new policy supplies its disabled/locked state rather than adding a new control.
- `labelBuilder.ts` already obtains administration text from the engine. `SelectedInstructionsPanel.tsx` and `PrintableLabel.tsx` already consume the resulting data. Those components and the Feature 03 printing policy were reused without changing their output rules or dimensions.

## Implementation

- Added an ordered Empty Stomach + Chewable workflow to the existing engine.
- Both ordered meal-condition combinations now work in current and spec modes. The store retains the condition selected before Chewable and removes stale BEFORE/AFTER selections.
- Added a shared Chewing selection-refusal policy used by the grid and store. Disabled UI tiles do not activate; direct store calls are also refused without replacing the selected Chewable instruction.
- The engine rejects reversed/incompatible combinations restored from older drafts. It generates no administration sentence for those invalid states.
- With Food/Empty Stomach combinations require TAKE or GIVE and do not require or append meal timing. Standalone Chewable continues to require both an action and meal timing.
- Chewing-related selected administration buttons now use blue, matching the existing blue SAM tiles. Existing responsive layout, focus handling and touch targets remain intact.
- A shared Chewing print check reuses the engine's required-input/order validation on review and at the final print action. Invalid or incomplete Chewing cannot be printed even if a selection changes after review.
- Existing deselection, reset, number-pad Back, label navigation, draft restoration and STAT cancellation behavior is preserved. No new Chewing-specific screen or Back button was introduced.

## Chewing compatibility and locking matrix

These rules apply in both wording modes. A selected condition can still be deselected to correct a label.

| Selection/order | Allowed? | TAKE/GIVE | BEFORE/AFTER | Other SAM behavior |
| --- | --- | --- | --- | --- |
| Chewable first | Yes | Required | Required and available | Dissolve and Drink, With Food, Empty Stomach and Keep in Mouth are locked |
| With Food → Chewable | Yes | Required | Locked; omitted from output | Keep the selected With Food condition; incompatible unselected SAMs remain locked |
| Empty Stomach → Chewable | Yes | Required | Locked; omitted from output | Keep the selected Empty Stomach condition; incompatible unselected SAMs remain locked |
| Chewable → With Food | No | Existing valid choices remain available | Standalone timing remains available | With Food is disabled; direct selection is refused |
| Chewable → Empty Stomach | No | Existing valid choices remain available | Standalone timing remains available | Empty Stomach is disabled; direct selection is refused |
| Chewable → Dissolve and Drink / Keep in Mouth | No | Existing valid choices remain available | According to the current valid Chewing workflow | Target button is disabled; direct selection is refused |
| Restored reversed/incompatible combination | Invalid | Correct or remove the conflicting selection | Engine reports the missing/invalid step | Review and final print action refuse printing |
| Remove Chewable | Yes | Existing selection rules apply | According to the remaining condition | Chewing-specific locks are released |

Existing STAT-step restrictions on editing the main label's administration remain in effect.

## Exact Sinhala examples and wording-mode difference

PDF/spec standalone outputs:

| Selection | Spec-mode output |
| --- | --- |
| Chewable + TAKE + BEFORE | හපලා කන්න කෑමට පෙර |
| Chewable + TAKE + AFTER | හපලා කන්න කෑමට පසු |
| Chewable + GIVE + BEFORE | හපලා කන්න දෙන්න කෑමට පෙර |
| Chewable + GIVE + AFTER | හපලා කන්න දෙන්න කෑමට පසු |

The existing current-mode standalone configuration uses **`සපලා` instead of `හපලා`** in all four lines. That existing wording was preserved, not silently corrected or made the default for spec mode. `NEXT_PUBLIC_LABEL_WORDING` and its default remain unchanged. The PDF/current difference remains a wording review item.

The ordered combined instructions below use the PDF's explicit wording in **both modes**. Current mode previously had no correct combined Chewing sentence for these selections.

| Selection | Output in both modes |
| --- | --- |
| With Food → Chewable → TAKE | කෑමත් සමඟ හපලා කන්න |
| With Food → Chewable → GIVE | කෑමත් සමඟ හපලා කන්න දෙන්න |
| Empty Stomach → Chewable → TAKE | හිස් බඩ හපලා කන්න |
| Empty Stomach → Chewable → GIVE | හිස් බඩ හපලා කන්න දෙන්න |

Integration examples generated through the existing Feature 03 policy:

- `කරල් 1½ බැගින් පැය 6කට වරක් කෑමත් සමඟ හපලා කන්න`
- `කරල් 1½ බැගින් පැය 5කට වරක් හිස් බඩ හපලා කන්න දෙන්න`
- `කරල් 1 බැගින් දිනකට 2 වරක් හිස් බඩ හපලා කන්න`
- `දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ හපලා කන්න`

No extra `කෑමට`, BEFORE or AFTER phrase is appended to the meal-condition combinations. The existing STAT dose remains separate from the following interval's Chewing instruction.

## Files changed by this feature

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | Ordered combinations, shared selection locks, restored-state checks and print validation |
| `apps/web/store/labelStore.ts` | Refuse locked selections in both modes and retain the preceding meal condition |
| `apps/web/components/label/InstructionGrid.tsx` | Native disabled/locked states from the shared policy |
| `apps/web/components/label/LabelActions.tsx` | Combined-workflow label and blue selected Chewing administration buttons |
| `apps/web/components/label/LabelActionPage.tsx` | Review validation and disabled Print & Save for invalid/incomplete Chewing |
| `apps/web/app/label/page.tsx` | Independent Chewing validation at the final print action |
| `apps/web/components/label/ChewingSam.test.tsx` | 44 new tests across current and spec modes |
| `apps/web/app/label/page.test.tsx` | Two additional final-action tests that bypass the review button's guard |
| `apps/web/lib/instructionEngine.test.ts` | Update the old current-mode expectation for With Food + Chewable |
| `apps/web/components/label/WorkflowGuide.test.tsx` | Verify native disabled behavior instead of expecting a click handler on the locked tile |
| `PHARMACY_FEATURE_04_CHEWING_SAM_REPORT.md` | This report |

Many files already contained uncommitted work. Earlier changes were preserved; this list describes Feature 04 edits rather than ownership of the entire Git diff. The product-type printing module, Sinhala product-type mapping, dosage formatter, database schema and API source were not changed by this feature.

## Test results

| Check | Result |
| --- | --- |
| Web Vitest suite | **31 files, 558 tests passed** |
| Relevant API Jest suites: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing failure: **1,064 errors, 63 warnings**, unchanged from Feature 03 |
| Web production build | Passed; generated 27 static pages |
| API build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

The 46 additional tests cover all eight requested action/condition combinations in both modes, ordering, disabled/faded buttons, direct-call refusal, invalid restored drafts, selected instructions, exact preview/print text, interval and Digital Label integration, STAT/EOD combinations, fractional quantities, reset/Back, navigation, restoration and final-action validation before any save. Existing Feature 01, Feature 02, Feature 03 and ENT tests pass.

Vitest and the web build used execution outside the sandbox for worker spawning. API tests used the existing in-memory database harness; failure-path logs represent intentionally simulated errors, not production operations.

## Remaining issues and safeguards

- The inherited current-mode standalone `සපලා` versus PDF/spec `හපලා` difference remains documented above. Unrelated Sinhala wording was not rewritten.
- Full API lint remains an unrelated repository-wide release blocker. No lint rules were suppressed.
- Physical printer alignment, paper output and actual Sinhala font rendering still require device verification. Automated checks cover instruction text, rendered label content and print guards.
- Existing historical-label editing and numeric precision boundaries from earlier features remain unchanged.
- No database schema changes, migrations, production-data updates, deployment, commit or GitHub push were performed.

Implementation stops at Feature #6. Feature #7 requires separate approval.
