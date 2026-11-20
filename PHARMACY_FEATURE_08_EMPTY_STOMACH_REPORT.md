# Feature 08 — Empty Stomach (හිස් බඩ)

Date: 24 October 2026.

**Feature #10 is complete. Feature #11 and later features have not started.**

Requirements were checked against the attached Feature 08 request, `C:/Users/Achintha/Downloads/Document 5.pdf` (Empty Stomach section, pages 10–11 and related SAM rules), and Feature #10 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` in the same directory.

## Existing implementation audit

- Standalone TAKE/GIVE constants and spec-mode output already matched `හිස් බඩ ගන්න` / `හිස් බඩ දෙන්න`. Both modes already required an action at DONE.
- Current-mode preview nevertheless generated `හිස්බඩ ගන්න` when no action was selected, including an assumed TAKE. A restored timing-only Empty Stomach selection could also reach the ordinary timing fallback.
- Earlier SAM features already implemented all six ordered Empty Stomach combinations in both modes. The store retains Empty Stomach before the chosen method and clears stale BEFORE/AFTER. Those generators and state transitions were reused without rewriting them.
- Shared grid/store refusal already enforces reverse-order restrictions, With Food mutual exclusion and incompatible-method locks. Native disabled/faded controls, deselection, reset, Number Pad Back, independent labels and restoration were suitable.
- Standalone Empty Stomach's administration buttons lacked the blue selected treatment added to the other recent SAM features.
- Review and final Save/Print did not have an Empty Stomach guard. Existing guards covered some combined workflows, but could not guarantee rejection of standalone incomplete Empty Stomach or reversed Chewing + Empty Stomach at completed Save.
- The audit covered the engine, store, builder, grid/tile, administration actions, selected panel, review, final page handlers, printable component and existing SAM suites. The builder already filters English SAM control tags and supplies the same generated sentence to preview/review/save/print. No rendering or physical layout change was necessary.

## Confirmed gaps and fixes

1. Removed only the incomplete current-mode Empty Stomach fallback. No action now means no administration sentence; selecting TAKE or GIVE still uses the existing approved constants.
2. Added `emptyStomachPrintError`, a small adapter over existing `analyseAdministration`. It validates standalone and combined Empty Stomach labels using the existing requirements/order checks; it introduces no parallel validation rules or administration state.
3. Review shows label-numbered errors and disables completed Save and Print. Review callbacks and both final page callbacks recheck current labels before any API write, including changes after review.
4. Selected standalone Empty Stomach TAKE/GIVE controls now turn blue using the existing control styling.
5. Added regression tests for the already completed locks/combinations and integration tests for the gaps. No store, grid, SAM combination formatter, product-type printing policy, dosage formatter, API or schema changes were needed.

## Compatibility and locking matrix

These rules apply in both wording modes. Selected options remain removable to correct an invalid draft.

| Selection/order | Allowed? | Administration | Locks |
| --- | --- | --- | --- |
| Empty Stomach alone | Yes | TAKE/GIVE required | With Food, BEFORE and AFTER; all three compatible methods remain available |
| Empty Stomach → Chewing | Yes | TAKE/GIVE required | BEFORE/AFTER, With Food, Dissolve and Keep in Mouth |
| Empty Stomach → Dissolve | Yes | TAKE/GIVE required | BEFORE/AFTER, With Food, Chewing and Keep in Mouth |
| Empty Stomach → Keep in Mouth | Yes | TAKE/GIVE required | BEFORE/AFTER, With Food, Chewing and Dissolve |
| Chewing/Dissolve/Keep in Mouth → Empty Stomach | No | Correct the order | Native disabled UI and direct-store refusal; no replacement |
| Empty Stomach → With Food | No | Existing selection retained | Native disabled UI and direct-store refusal |
| With Food → Empty Stomach | No | Existing selection retained | Native disabled UI and direct-store refusal |
| Deselect Empty Stomach alone | Yes | Existing remaining selections apply | Empty Stomach-specific locks released |
| Deselect Empty Stomach from a combination | Yes | Remaining SAM requires its standalone timing | Remaining SAM's own locks remain |
| Invalid/reversed restored draft | Invalid | Correct conflicting selections/order | Completed Save and Print blocked |
| Missing TAKE/GIVE | Incomplete | Choose an action | No administration sentence; completed Save and Print blocked |

## Exact Sinhala output

Both modes produce the same Empty Stomach sentences:

| Selection | Output |
| --- | --- |
| Empty Stomach + TAKE | හිස් බඩ ගන්න |
| Empty Stomach + GIVE | හිස් බඩ දෙන්න |
| Empty Stomach → Chewing → TAKE | හිස් බඩ හපලා කන්න |
| Empty Stomach → Chewing → GIVE | හිස් බඩ හපලා කන්න දෙන්න |
| Empty Stomach → Dissolve → TAKE | හිස් බඩ දිය කර බොන්න |
| Empty Stomach → Dissolve → GIVE | හිස් බඩ දිය කර බොන්න දෙන්න |
| Empty Stomach → Keep in Mouth → TAKE | හිස් බඩ දිව මත තබා ගන්න |
| Empty Stomach → Keep in Mouth → GIVE | හිස් බඩ දිව මත තබන්න |

The extracted PDF page 10 output bullet contains `පෙන්න`, while the same page's GIVE action legend uses `දෙන්න`. This feature retains `දෙන්න`, matching that legend, the explicit request, existing approved constants and spec mapping. No unrelated phrase or wording-mode setting was changed; Chewing's inherited standalone current/spec distinction remains unchanged.

Combined sentences contain one Empty Stomach phrase and no appended BEFORE/AFTER. Examples through the unchanged product-type printing policy:

- `පැකට් 1½ බැගින් පැය 8කට වරක් හිස් බඩ ගන්න`
- `පැකට් 1½ බැගින් පැය 6කට වරක් හිස් බඩ ගන්න`
- `පැකට් 1½ බැගින් පැය 5කට වරක් හිස් බඩ ගන්න`
- `පැකට් 1½ බැගින් දිනකට 2 වරක් හිස් බඩ ගන්න`
- `පැකට් 1½ බැගින් දිනකට 3 වරක් හිස් බඩ ගන්න`
- `දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 6කට වරක් හිස් බඩ දෙන්න`

STAT keeps its separate dose and existing phrase/pill. Product-type words remain subject to Feature 03's existing conditions.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | Suppress assumed TAKE and expose centralized Empty Stomach final-action validation |
| `apps/web/components/label/LabelActions.tsx` | Blue selected standalone administration controls |
| `apps/web/components/label/LabelActionPage.tsx` | Review/callback Save and Print validation and errors |
| `apps/web/app/label/page.tsx` | Independent final Save/Print guards before API writes |
| `apps/web/components/label/EmptyStomach.test.tsx` | 56 new tests across both modes |
| `apps/web/app/label/page.test.tsx` | Six additional DONE/final-action/save-payload tests |
| `apps/web/lib/instructionEngine.test.ts` | Replace the assumed-TAKE preview expectation with null |
| `PHARMACY_FEATURE_08_EMPTY_STOMACH_REPORT.md` | This report |

Earlier uncommitted work was preserved. This list describes this feature's edits, not ownership of complete working-tree diffs. Audited files not listed above were reused unchanged.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **35 files, 777 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings**, unchanged from Feature 07 |
| Web production build | Passed; generated 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The 62 added tests cover both standalone actions and all six combinations in both modes, timing/With Food locks, compatible-method availability, incompatible method refusal, reversed order, native disabled/faded states, direct actions, incomplete/invalid drafts, correction, deselection, reset/Back, per-label navigation/restoration, exact selected/preview/review/print text, mixed quantities, 8H/6H/5H, BD/TDS, STAT/EOD, all three product types and fixed dimensions. Features 01–07 and ENT regression suites pass.

Final-action tests bypass review's disabled controls to verify independent rejection of missing actions and reversed Chewing + Empty Stomach before prescription API calls. The valid Save test captures `finalInstructionText` at the API boundary and verifies the generated Sinhala instruction; a simulated failure response prevents any real write. API tests use the existing in-memory harness, including intentionally simulated error paths.

Vitest and the web build ran outside the sandbox to permit worker spawning. Full API lint was diagnostic only; no unrelated files were auto-fixed and no rules suppressed.

## Remaining limitations and safeguards

- Full API lint remains an unrelated repository-wide release blocker.
- Physical printer alignment, paper output and actual Sinhala font rendering still require device verification. The existing 70 × 50 mm dimensions and print-fit safeguards remain unchanged.
- No live database integration was performed. Existing historical editing, browser-reload draft-storage and numeric precision limitations remain unchanged.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #10. Feature #11 requires separate approval.
