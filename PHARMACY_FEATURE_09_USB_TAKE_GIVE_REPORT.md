# Feature 09 — USB Take/Give Administration Controls

Date: 24 October 2026.

**Feature #11 is complete. Feature #12 and later features have not started.**

Requirements were checked against the attached Feature 09 request, Feature #11 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and the USB section of `Document 5.pdf`, pages 11–12, together with the completed SAM rules.

## Existing USB audit

The PDF explicitly calls USB **“USUAL Administration Buttons.”** It describes TAKE and GIVE as the ordinary administration actions that also combine with SAM buttons. This report retains that project-specific term. Existing internal `NAB` workflow identifiers and the Administration UI were not renamed.

- `SPEC_NAB`, current-mode ordinary constants and the method-specific verb mappings already existed. Correct completed sentences did not need rewriting.
- The store already replaces TAKE with GIVE, and GIVE with TAKE, in `additionalInstructions`. Deselecting an action, reset, Number Pad Back, independent labels and serialized restoration were suitable. No duplicate action state was necessary.
- Completed SAM combination order, compatibility and timing locks were already centralized. They were inspected and reused unchanged.
- Ordinary selected controls retained their older category colours. Earlier SAM selections turned administration controls blue, but ordinary TAKE/GIVE did not consistently do so.
- Current-mode timing-only preview assumed TAKE. Chewing with no action also produced a partial action phrase. These previews contradicted the required-input guidance.
- A restored draft containing both TAKE and GIVE was not rejected; text generation chose one action. Direct store actions already avoided this state, but draft restoration correctly preserved its raw data for review.
- Default current mode allowed a dose or supported oral interval with no administration selections through engine validation. Spec mode already required an action, but did not list ordinary timing as missing until an action was selected.
- Review/final guards covered individual SAM features but omitted ordinary incomplete USB. Completed Save also lacked coverage for some incomplete Chewing-only labels.
- The audit included the engine, store, constants, builder, grid, administration controls, selected panel, review, printable component, final handlers and existing administration/SAM suites. Preview, review, saved text and printed labels already shared built instruction data. No formatter duplication or physical layout change was needed.

## Verified gaps and fixes

1. Ordinary selected administration controls now use the existing blue treatment. Idle styles, touch targets, keyboard focus and native timing locks remain intact.
2. Removed assumed-TAKE/partial-action fallbacks. Neither wording generates an administration sentence without the required action/timing.
3. Added a centralized conflicting-action check. Both-action legacy drafts produce no administration sentence and a clear correction message; deselecting an action or selecting a valid restored draft resolves the error.
4. Existing administration analysis now requires USB/SAM completion for oral Morning/Lunch/Night doses and supported 8H/6H/5H, Daily and Evening schedules in both modes. Ordinary schedules require an action and meal timing; meal-condition SAMs keep their existing timing exceptions. No dosing format or selection-order rule was rewritten.
5. Added `usbPrintError`, an adapter over the existing administration analysis, for review and both final action callbacks. Review disables completed Save and Print; final handlers independently recheck the latest labels before API writes. DONE continues to use the same engine through its existing validation path.
6. ENT retains its own units/actions and validation. Text-only labels are not globally forced through USB, and STAT-only labels retain their separate administration workflow rather than being forced to select ordinary meal timing. No new STAT or EOD feature was implemented.

## TAKE/GIVE compatibility matrix

These rules apply in both wording modes. “Required timing” means BEFORE or AFTER.

| Workflow | TAKE/GIVE | Meal timing | Verb source |
| --- | --- | --- | --- |
| Ordinary oral administration | One required | Required | Existing ordinary constants/spec mapping |
| Chewing alone | One required | Required | Existing current/spec Chewing verbs |
| With Food → Chewing | One required | Locked | Existing combined Chewing sentence |
| Empty Stomach → Chewing | One required | Locked | Existing combined Chewing sentence |
| Dissolve alone | One required | Required | Existing Dissolve sentence |
| With Food/Empty Stomach → Dissolve | One required | Locked | Existing combined Dissolve sentence |
| With Food alone | One required | Locked | Existing With Food verbs |
| Empty Stomach alone | One required | Locked | Existing Empty Stomach verbs |
| Keep in Mouth alone | One required | Required | Existing Keep in Mouth verbs |
| Empty Stomach → Keep in Mouth | One required | Locked | Existing combined Keep in Mouth sentence |
| Oral dose/interval with no SAM | One required | Required | Ordinary workflow; no assumed TAKE |
| ENT | Existing ENT rules | Existing ENT rules | ENT template, not oral USB |
| STAT-only | Existing separate STAT rules | Not forced through ordinary timing | Existing STAT phrase/pill rules |
| Text-only label without an oral dose/USB/SAM | Not globally required | Not globally required | Existing text-only behavior |
| Restored TAKE + GIVE | Invalid | Correct the action first | No administration sentence; Save/Print blocked |

TAKE → GIVE and GIVE → TAKE replace the previous action immediately. Deselecting the only action makes a workflow that requires it incomplete. The selected product, doses and method order remain unchanged.

## Exact Sinhala examples and preserved wording differences

Ordinary completed administration retains its existing order:

| Selection | Current mode | Spec mode |
| --- | --- | --- |
| TAKE + BEFORE | කෑමට පෙර ගන්න | ගන්න කෑමට පෙර |
| TAKE + AFTER | කෑමට පසු ගන්න | ගන්න කෑමට පසු |
| GIVE + BEFORE | කෑමට පෙර දෙන්න | දෙන්න කෑමට පෙර |
| GIVE + AFTER | කෑමට පසු දෙන්න | දෙන්න කෑමට පසු |

The PDF extraction contains `පෙන්න` in some GIVE bullets and `දෙන්න` in its action legend. The explicit request, gap plan and existing approved mappings use `දෙන්න`; that wording is preserved. Wording-mode configuration/defaults were not changed.

| Method | TAKE example | GIVE example |
| --- | --- | --- |
| Chewing alone, spec | හපලා කන්න කෑමට පසු | හපලා කන්න දෙන්න කෑමට පසු |
| Chewing alone, current | සපලා කන්න කෑමට පසු | සපලා කන්න දෙන්න කෑමට පසු |
| With Food → Chewing, both modes | කෑමත් සමඟ හපලා කන්න | කෑමත් සමඟ හපලා කන්න දෙන්න |
| Empty Stomach → Chewing, both modes | හිස් බඩ හපලා කන්න | හිස් බඩ හපලා කන්න දෙන්න |
| Dissolve alone, both modes | දිය කර බොන්න කෑමට පසු | දිය කර බොන්න දෙන්න කෑමට පසු |
| With Food → Dissolve, both modes | කෑමත් සමඟ දිය කර බොන්න | කෑමත් සමඟ දිය කර බොන්න දෙන්න |
| Empty Stomach → Dissolve, both modes | හිස් බඩ දිය කර බොන්න | හිස් බඩ දිය කර බොන්න දෙන්න |
| With Food alone, both modes | කෑමත් සමඟ ගන්න | කෑමත් සමඟ දෙන්න |
| Empty Stomach alone, both modes | හිස් බඩ ගන්න | හිස් බඩ දෙන්න |
| Keep in Mouth alone, both modes | දිව මත තබා ගන්න කෑමට පසු | දිව මත තබන්න කෑමට පසු |
| Empty Stomach → Keep in Mouth, both modes | හිස් බඩ දිව මත තබා ගන්න | හිස් බඩ දිව මත තබන්න |

There is no generic TAKE/GIVE suffix appended to specialized verbs. In particular, Keep in Mouth GIVE remains `තබන්න`. Combined meal conditions do not append BEFORE/AFTER.

Integration examples under the unchanged product-type printing policy:

- Current: `කරල් 1½ බැගින් පැය 6කට වරක් කෑමට පසු දෙන්න`
- Spec: `කරල් 1½ බැගින් පැය 6කට වරක් දෙන්න කෑමට පසු`
- Spec BD: `කරල් 1½ බැගින් දිනකට 2 වරක් දෙන්න කෑමට පසු`
- Spec TDS: `කරල් 1½ බැගින් දිනකට 3 වරක් දෙන්න කෑමට පසු`
- Spec four-dose: `කරල් 1½ බැගින් දිනකට හතර වරක් දෙන්න කෑමට පසු`

STAT retains its own dose/action separately from the follow-up USB sentence. EOD remains the existing modifier when combined with a supported interval.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/instructionEngine.ts` | Conflicting-action checks, incomplete-text suppression, oral USB requirements and shared final-action adapter |
| `apps/web/components/label/LabelActions.tsx` | Consistent blue selected controls using the existing styles |
| `apps/web/components/label/LabelActionPage.tsx` | USB review/callback Save/Print guard and label-numbered error |
| `apps/web/app/label/page.tsx` | Independent final Save and Print USB validation |
| `apps/web/components/label/UsbAdministration.test.tsx` | 68 new tests across both modes |
| `apps/web/app/label/page.test.tsx` | 11 new DONE/final-action/save-text tests |
| `apps/web/lib/instructionEngine.test.ts` | Update expectations for assumed TAKE and unvalidated oral schedules |
| `apps/web/components/PrintedInterval.test.tsx` | Verify missing administration alongside missing interval quantity |
| `PHARMACY_FEATURE_09_USB_TAKE_GIVE_REPORT.md` | This report |

Earlier uncommitted work was preserved. This list describes this feature's edits rather than ownership of complete Git diffs. The store, constants, builder, grid, selected panel, printable component, dosage formatter, product-type policy, API and schema were reused unchanged.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest: `pnpm exec vitest run --maxWorkers=2 --minWorkers=1` | **36 files, 856 tests passed** |
| Final page-handler rerun after removing a redundant DONE check | **38 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings**, unchanged from Feature 08 |
| Web production build | Passed; generated 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The 79 added tests cover ordinary TAKE/GIVE, keyboard/touch activation, blue/idle states, both replacement orders, deselection, all completed SAM combinations, method-specific verbs, timing requirements/locks, invalid legacy actions, correction, reset/Back, label independence/restoration, exact preview/print text, saved `finalInstructionText`, dose/product preservation, 8H/6H/5H, BD/TDS/four-dose patterns, mixed/fractional quantities, Pethi/Karal/Packet, STAT/EOD and ENT/text-only exceptions. Existing Features 01–08 suites pass.

Final-action tests bypass disabled review controls and mutate state after review to verify that missing actions, missing timing and conflicting actions cause no prescription API call. Valid ordinary TAKE/GIVE tests capture the Save payload's generated text; simulated failure responses prevent real writes. API tests use the existing in-memory harness with deliberate simulated failures.

The initial unrestricted worker run exposed obsolete expectations, a new-test optional-field type error, and UI test timeouts with a cascading failure in the following test. Expectations/type handling were corrected; the full rerun passed with two workers and unchanged test timeouts. Vitest and the web build used execution outside the sandbox for worker spawning. API lint was diagnostic only, without auto-fixing or rule suppression.

## Remaining limitations and safeguards

- Full API lint remains an unrelated repository-wide release blocker.
- Physical printer alignment, paper output and actual Sinhala font rendering still require device verification. The existing 70 × 50 mm layout and print-fit safeguards remain unchanged.
- No live database integration was performed. Existing historical editing, browser-reload draft-storage, numeric precision and separate STAT wording limitations remain unchanged.
- No database schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #11. Feature #12 requires separate approval.
