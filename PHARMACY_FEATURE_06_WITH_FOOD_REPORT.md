# Feature 06 — With Food (කෑමත් සමඟ)

Date: 24 October 2026.

**Feature #8 is complete. Feature #9 and later features have not started.**

Requirements were checked against `C:/Users/Achintha/Downloads/Document 5.pdf`, pages 8–9, Feature #8 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` from the same directory, and the attached Feature 06 request.

## Existing implementation findings and remaining gaps

- The completed With Food → Chewing and With Food → Dissolve combinations already generated the requested sentences in both wording modes. Their formatters and selection-order policies were reused without rewriting them.
- WITH FOOD already locked BEFORE/AFTER and removed stale timing when selected. Existing native disabled/faded controls, blue SAM tiles, reset, Back, label switching and restoration were suitable.
- Spec-mode standalone With Food wording was correct. Current-mode constants used `සමග` rather than `සමඟ` and added a full stop to GIVE. Current mode also generated a fallback TAKE phrase when no administration action had been selected.
- With Food alone did not lock Empty Stomach or Keep in Mouth. Empty Stomach could replace it; Keep in Mouth could be added to an incompatible selection.
- The engine did not reject those standalone incompatible restored selections, and final Save/Print guards covered the newer SAMs but not standalone With Food.
- `labelBuilder.ts`, `SelectedInstructionsPanel.tsx`, `PrintableLabel.tsx` and `InstructionTile.tsx` were inspected. Their existing shared-data/rendering path already met the feature's needs and was left unchanged.

## Necessary changes

- Corrected only the standalone With Food constants to the exact requested TAKE/GIVE sentences. No unrelated Sinhala wording or wording-mode configuration changed.
- Removed the incomplete current-mode fallback that assumed TAKE before the user selected an action.
- Added a shared With Food selection-refusal policy to the existing grid/store policy chain. Empty Stomach and Keep in Mouth are natively disabled/faded while With Food is selected, and direct store actions are refused.
- With Food cannot be added over an existing Keep in Mouth selection to create an invalid pair or silently replace the existing method. This is a With Food compatibility check, not implementation of Feature #9.
- Added engine validation for incompatible With Food drafts and a shared With Food Save/Print check. DONE, review, final completed Save and final Print use the existing administration analysis.
- Review disables completed Save and Print on invalid/incomplete With Food. Final handlers independently recheck current labels before calling the prescription API, including changes made after review.
- Standalone With Food's selected administration controls now turn blue, consistent with its existing SAM tile and completed combinations.
- Added focused regression and integration tests. Existing Chewing/Dissolve policy functions, dosage controls, product-type printing rules, ENT behavior and physical label dimensions were preserved.

## Compatibility and locking matrix

The same rules apply in current and spec modes. Selected incompatible draft options remain removable to allow correction.

| Selection/order | Allowed? | TAKE/GIVE | BEFORE/AFTER | Other method behavior |
| --- | --- | --- | --- | --- |
| With Food alone | Yes | One required | Locked; omitted | Chewing and Dissolve available; Empty Stomach and Keep in Mouth locked |
| With Food → Chewing | Yes | One required | Locked; omitted | Both selections retained; completed Chewing locks apply |
| With Food → Dissolve | Yes | One required | Locked; omitted | Both selections retained; completed Dissolve locks apply |
| Chewing → With Food | No | Existing valid choices retained | According to remaining valid workflow | Existing reverse-order refusal preserved |
| Dissolve → With Food | No | Existing valid choices retained | According to remaining valid workflow | Existing reverse-order refusal preserved |
| With Food → Empty Stomach | No | Existing selection retained | Locked | Native disabled state and direct-store refusal |
| With Food → Keep in Mouth | No | Existing selection retained | Locked | Native disabled state and direct-store refusal |
| Keep in Mouth → With Food | No | Existing selection retained | Existing rules retained | Refused without silently replacing the method |
| Deselect With Food alone | Yes | Existing selection rules apply | Available again | With Food-specific locks released |
| Deselect With Food from a completed combination | Yes | According to remaining SAM | Standalone Chewing/Dissolve timing becomes required | Remaining SAM's own locks apply |
| Restored invalid/incomplete With Food | Invalid/incomplete | Correct the required selection | No extra timing generated | Completed Save and Print blocked |

## Exact Sinhala output

Both wording modes now produce these exact With Food sentences:

| Selection | Administration sentence |
| --- | --- |
| With Food + TAKE | කෑමත් සමඟ ගන්න |
| With Food + GIVE | කෑමත් සමඟ දෙන්න |
| With Food → Chewing → TAKE | කෑමත් සමඟ හපලා කන්න |
| With Food → Chewing → GIVE | කෑමත් සමඟ හපලා කන්න දෙන්න |
| With Food → Dissolve → TAKE | කෑමත් සමඟ දිය කර බොන්න |
| With Food → Dissolve → GIVE | කෑමත් සමඟ දිය කර බොන්න දෙන්න |

The standalone correction replaces the prior current-mode `කෑමත් සමග ගන්න` / `කෑමත් සමග දෙන්න.` variants. The completed combined phrases were already correct and remain unchanged. No BEFORE/AFTER text is appended, and an incomplete With Food selection no longer assumes an action.

Examples through the unchanged product-type printing policy:

- `පැකට් 1½ බැගින් පැය 8කට වරක් කෑමත් සමඟ ගන්න`
- `පැකට් 1½ බැගින් පැය 6කට වරක් කෑමත් සමඟ ගන්න`
- `පැකට් 1½ බැගින් පැය 5කට වරක් කෑමත් සමඟ ගන්න`
- `පැකට් 1½ බැගින් දිනකට 2 වරක් කෑමත් සමඟ ගන්න`
- `පැකට් 1½ බැගින් දිනකට 3 වරක් කෑමත් සමඟ ගන්න`
- `දිනක් හැර දිනක්, පැකට් ½ බැගින් පැය 6කට වරක් කෑමත් සමඟ දෙන්න`

STAT retains its own dose and existing phrase/pill separately from the following With Food interval instruction. Type-free workflows continue to follow Feature 03's printing rules.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | With Food refusal, restored-state validation, incomplete-text suppression and shared final-action check |
| `apps/web/constants/oabInstructions.ts` | Exact requested standalone With Food wording |
| `apps/web/store/labelStore.ts` | Reuse the new policy in direct actions |
| `apps/web/components/label/InstructionGrid.tsx` | Native disabled/faded With Food locks |
| `apps/web/components/label/LabelActions.tsx` | Blue selected standalone With Food administration controls |
| `apps/web/components/label/LabelActionPage.tsx` | Review Save/Print guard and label-numbered message |
| `apps/web/app/label/page.tsx` | Independent final Save/Print validation |
| `apps/web/components/label/WithFood.test.tsx` | 38 new tests in both wording modes |
| `apps/web/app/label/page.test.tsx` | Six additional entry-point/save-payload tests |
| `apps/web/lib/instructionEngine.test.ts` | Standalone wording and incomplete-selection expectations |
| `apps/web/lib/oabLogic.test.ts` | Standalone With Food exact-output expectations |
| `apps/web/components/label/Workstation.test.tsx` | Updated standalone With Food wording expectation |
| `PHARMACY_FEATURE_06_WITH_FOOD_REPORT.md` | This report |

Earlier uncommitted work was preserved. This list describes this feature's edits, not ownership of entire Git diffs. No new UI screen, parallel formatter, database schema or API source change was introduced.

## Verification results

| Check | Result |
| --- | --- |
| Full web Vitest suite | **33 files, 663 tests passed** |
| Relevant API Jest suites: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings**, unchanged from Feature 05 |
| Web production build | Passed; generated 27 static pages |
| API build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

The 44 added tests cover TAKE/GIVE, completed ordered combinations, reverse-order refusal, Empty Stomach/Keep in Mouth locks, timing locks and stale-timing removal, direct actions, invalid/incomplete restored state, correction, selection display, blue selected states, deselection/reset/Back, label navigation/restoration, intervals, BD/TDS, mixed quantities, STAT/EOD and dynamic product-type output.

The final-action tests bypass the review component's disabled controls and confirm that invalid/incomplete With Food does not call the prescription API. A separate test captures the valid Save request and verifies that its `finalInstructionText` contains the same generated With Food instruction as preview/print. Its response is a simulated failure; no real record is written.

The completed Chewing and Dissolve suites remain passing, together with Features 01–05 and ENT regressions. Vitest and the web build ran outside the sandbox for worker spawning. API tests use the existing in-memory harness, including deliberately simulated error paths.

## Remaining issues and safeguards

- Full API lint remains an unrelated release blocker. No rules were suppressed and unrelated API code was not auto-fixed.
- Physical printer alignment, actual Sinhala font rendering and paper output still need device verification. Automated checks include rendered instruction text, application guards and unchanged 70 × 50 mm dimensions.
- Live database integration was not performed; save consistency was checked at the API-call boundary. Existing historical-label editing/browser-reload draft-storage and numeric-precision limitations remain unchanged.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #8. Feature #9 requires separate approval.
