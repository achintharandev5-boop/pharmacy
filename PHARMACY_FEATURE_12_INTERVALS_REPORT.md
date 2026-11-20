# Feature 12 — 8H / 6H / 5H Dosing Intervals

Date: 24 October 2026.

**Feature #14 is complete. Feature #15 and later features have not started.**

Requirements were checked against the attached Feature 12 request, Feature #14 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `Document 5.pdf` in the same directory. The primary interval rules are on pages 16–21; selected-day restrictions are on page 27. Existing STAT/EOD and administration rules were retained.

## Existing implementation audit

- All three interval tiles, quantity Number Pad, fraction controls and blue selected states already existed. The existing Feature 01 formatter and Feature 03 product-type policy already generated the requested interval wording.
- `productType.ts` already supplied the single Sinhala product-type mapping. No new product-type map or dosage state was necessary.
- STAT and EOD already preserved their own prefixes and restricted interval combinations. Ordinary intervals did not consistently use equivalent locking rules: another interval could replace the active one, and Weekly could coexist with it.
- Digital Label prevented interval selection only in spec mode. Selecting an interval first still allowed digital quantities through the ordinary controls/store in some paths. Current-mode restored interval/digital conflicts were not consistently rejected.
- Quantity checks used `qty > 0`, which accepts positive infinity. The product-type prefix formatter had the same finite-value gap.
- DONE already used centralized readiness analysis. Review/final actions had several USB/SAM/STAT/EOD guards, but no interval-specific adapter guaranteeing rejection of every restored schedule conflict or a missing product type at completed Save.
- The builder generated the correct printed interval line but also retained a redundant frequency summary in `finalInstructionText`. Selected preview, review and saved text could therefore repeat the interval quantity before the printed sentence.
- `InstructionTile.tsx`, `LabelActions.tsx`, `SelectedInstructionsPanel.tsx`, `PrintableLabel.tsx` and existing interval/USB/SAM tests were inspected and reused. Their shared render path and existing control styling required no changes for this feature.

## Confirmed gaps and fixes

1. Added `intervalPolicy.ts` as a shared compatibility/refusal policy for the existing grid and store. It follows refusal, not replacement: remove the active interval before choosing another interval or schedule.
2. Disabled/faded the incompatible oral schedule tiles and Digital Label controls in both wording modes. Kept the workstation layout and touch targets. The request explicitly permits disabled Digital Label controls; the PDF's hidden-panel rule is implemented through this disabled alternative without a layout redesign.
3. Direct store actions refuse incompatible selections without clearing existing quantities, products or schedules. Digital Number Pad opening/confirmation and increment actions enforce the same restriction. Selected-day entry/setters cannot add a conflicting schedule. Existing invalid selections remain removable.
4. Added finite positive quantity checks and restored-state conflict validation. `intervalPrintError` delegates completion to the existing `analyseLabel`, including USB/SAM order, ENT validation and product-type requirements; it does not introduce a second administration engine.
5. DONE uses the same readiness analysis. Review disables completed Save and Print and shows label-numbered errors. Review callbacks and final Save/Print independently recheck current labels before prescription API calls.
6. Removed the redundant frequency summary when the shared interval sentence replaces the frequency row. Selected preview, review, saved `finalInstructionText` and the printed instruction now use the same single sentence for valid oral intervals.
7. Preserved ENT's existing frequency editor/replacement behavior. The new oral selection locks do not redesign ENT. ENT interval readiness continues to use its own template/unit validation and bypasses oral product-type requirements.

## PDF-grounded compatibility matrix

These oral rules apply in both wording modes. Existing selected options remain removable so invalid drafts can be corrected.

| Selection/order | Result | Basis |
| --- | --- | --- |
| 8H, 6H or 5H first | One interval; positive quantity; existing USB/SAM requirements | Pages 16–20 |
| Active interval → another interval | Disabled/refused; selected interval and confirmed quantity retained | Pages 17–18 |
| Active interval → Daily/Evening/Weekly | Disabled/refused | Pages 17–18 |
| Active interval → STAT/EOD | Refused; modifier must precede interval | Pages 18–20 |
| STAT first → interval → administration | Allowed; initial and follow-up quantities independent | Pages 18–21 and completed Feature 11 |
| EOD first → interval → administration | Allowed; text-only EOD prefix retained | Pages 18–21 and completed Feature 10 |
| STAT → EOD → interval | Existing completed modifier rules retained | Existing STAT/EOD policies |
| Interval + Digital/BD/TDS/four doses | Refused; digital controls disabled | Page 16; digital schedules use the existing Morning/Lunch/Night fields |
| Digital/Daily/Evening/Weekly already selected → interval | Refused without replacing or clearing the schedule | Interval/digital exclusivity, pages 16–20 |
| Selected days/date-range schedule + interval | Refused/rejected | Page 27 and existing selected-day workflow boundaries |
| Interval + TAKE/GIVE and BEFORE/AFTER | Allowed when complete | Pages 19–21 and completed USB rules |
| Interval + completed SAM combinations | Allowed according to existing selection order/timing locks | Page 20 and completed SAM rules |
| Missing/unsupported product type | No inferred Sinhala type; completed Save and Print blocked | Existing Feature 03 policy |
| Multiple intervals or conflicting restored schedules | Rejected; conflicting selections remain removable | Same compatibility rules applied to restored state |
| Remove interval | Digital/schedule availability restored when no other policy blocks it | Lock release; existing deselection behavior |
| ENT | Existing ENT editor and units retained | Explicit regression safeguard |

Changing intervals is intentionally a remove-then-select operation. A refused tap never resets the confirmed quantity. Removing the selected interval clears its quantity using the existing store behavior; choosing a new interval opens quantity entry. This prevents a stale dose from being silently assigned to a different schedule.

## Exact Sinhala examples

The approved current-mode TAKE + AFTER sentences remain:

| Selection | Output |
| --- | --- |
| Pethi, 1, 8H | පෙති 1 බැගින් පැය 8කට වරක් කෑමට පසු ගන්න |
| Karal, ½, 6H | කරල් ½ බැගින් පැය 6කට වරක් කෑමට පසු ගන්න |
| Packet, 1½, 5H | පැකට් 1½ බැගින් පැය 5කට වරක් කෑමට පසු ගන්න |

Spec mode retains its existing `ගන්න කෑමට පසු` suffix. No wording-mode default or unrelated Sinhala phrase was changed.

Examples identical across both modes:

- `පෙති 1 බැගින් පැය 8කට වරක් කෑමත් සමඟ ගන්න`
- `කරල් ½ බැගින් පැය 6කට වරක් හිස් බඩ දිය කර බොන්න`
- `පැකට් 1½ බැගින් පැය 5කට වරක් හිස් බඩ දිව මත තබා ගන්න`
- `පළමුව පමණක් 2 ගන්න ඉන්පසු, දිනක් හැර දිනක්, පෙති ½ බැගින් පැය 8කට වරක් හිස් බඩ දෙන්න`

The existing spelling `8කට`/`6කට`/`5කට`, fraction glyphs, ratio formatting and administration verbs are preserved. Product-type words appear only in the permitted dosing sentence, never in the initial STAT or EOD-only phrase. No duplicate meal timing or action is appended to combined SAM sentences.

## Files changed

Paths are relative to `apps/web/`:

| File | Change |
| --- | --- |
| `lib/intervalPolicy.ts` | New shared interval selection/refusal and restored-state checks |
| `lib/instructionEngine.ts` | Central readiness integration, finite quantity checking and interval completion adapter |
| `store/labelStore.ts` | Shared refusal, digital pad/increment and selected-day guards |
| `components/label/InstructionGrid.tsx` | Disabled/faded schedule tiles and selected-day entry |
| `components/label/DosagePanel.tsx` | Disable Digital Label controls during an oral interval |
| `components/label/LabelActionPage.tsx` | Review/callback Save and Print guards and messages |
| `app/label/page.tsx` | Independent final Save/Print validation |
| `lib/productTypePrinting.ts` | Refuse non-finite quantities when building a product-type prefix |
| `lib/labelBuilder.ts` | Use the shared interval sentence without redundant frequency summary |
| `components/label/Intervals.test.tsx` | 68 new tests across both wording modes |
| `app/label/page.test.tsx` | 18 new DONE/final-action/payload tests |
| `components/label/Workstation.test.tsx` | Replace obsolete automatic-interval-replacement expectation |
| `components/label/WorkflowGuide.test.tsx` | Verify native digital lock rather than activating a conflict |
| `store/labelStore.buttons.test.ts` | Verify interval refusal rather than replacement/Weekly coexistence |
| `lib/instructionEngine.test.ts` | Separate valid interval-only and invalid interval/digital fixtures |

This report is also new. Earlier uncommitted work was preserved; the list describes this feature's edits rather than ownership of entire Git diffs. No API source, database schema, product-type mapping, dosage formatter or physical label dimensions were changed.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **39 files, 1,145 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated all 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The 86 new tests cover exact output for all three intervals/product types, whole/half/mixed/third quantities, selection locks and refusal, existing USB/SAM combinations, independent STAT quantity, EOD prefixes, invalid/non-finite quantities, conflicting restored state, correction, missing/unsupported types, selected preview, rendered print content, review controls, Back/reset, label navigation/restoration and ENT.

Final-action tests bypass review's disabled controls, mutate current labels after review, and verify that both Save and Print reject invalid quantities, digital conflicts, multiple intervals, missing product types/actions and reversed SAM order before any API call. Valid Save tests verify exact `finalInstructionText`, interval code and quantity at the API boundary; a simulated failure response prevents any real record write.

All completed Features 01–11 and ENT regression suites pass. Older expectations for interval replacement, interval/digital coexistence and Weekly coexistence were updated to the explicitly requested PDF rules. Failures found during implementation were corrected before the successful full rerun.

The web suite uses one worker and a 15-second per-test timeout, as in Feature 11, without changing repository test configuration. Worker execution/build required running outside the sandbox. API tests use the existing in-memory harness, including intentionally simulated failure paths.

## Remaining limitations and safeguards

- Existing repository-wide API lint remains a release blocker. No rules were suppressed and unrelated API files were not auto-fixed.
- Physical printer alignment, Sinhala font rendering and paper output still require device verification. Existing 70 × 50 mm dimensions and print-fit safeguards are unchanged.
- No live API/database integration was performed. Historical editing/browser-reload draft-storage and numeric precision limitations from completed features remain unchanged.
- No database schema changes, migrations, production-data changes, deployment, commit or GitHub push were performed.

Implementation stops at Feature #14. Feature #15 requires separate approval.
