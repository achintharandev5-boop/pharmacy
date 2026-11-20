# Feature 11 — STAT (පළමුව පමණක්)

Date: 24 October 2026.

**Feature #13 is complete. Feature #14 and later features have not started.**

Requirements: the attached Feature 11 request, Feature #13 in `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `C:/Users/Achintha/Downloads/Document 5.pdf`, particularly pages 13–16 and the related combinations on pages 18–24, 27–28 and 32–37.

## Audit and root causes

- STAT quantity already had its own store record and fraction controls. Those were reused; no parallel dosage state was introduced.
- The old workflow required separate initial-administration/follow-up panels instead of returning to the Function Pad after quantity confirmation. Current wording mode also rendered an English STAT pill, while spec mode inserted the quantity separately during rendering.
- The initial quantity was consequently absent from some generated instruction strings and saved summaries. Follow-up rows could precede STAT on the printed card.
- STAT was treated as a competing frequency. Order enforcement and completed Save/Print validation were incomplete, particularly for restored drafts, pending edits and changes after review.

## Implementation

- STAT must be selected before the regular dosing workflow. Its marker uses the existing ordered instruction array, and its quantity remains in the existing `stat` record.
- Whole, fractional and mixed initial quantities use the Feature 01 formatter. Initial and subsequent quantities remain independent.
- Done confirms a positive finite quantity, retains the PDF's intrinsic TAKE instruction and returns to the normal Function Pad in both wording modes. Back/cancellation restores the previous confirmed state or removes a new unconfirmed STAT selection.
- Main dosing/administration controls and duration/expiry controls are locked while the initial quantity is being edited. Existing native disabled/faded and blue selected styles are reused. Direct store entry points also enforce order and incompatible schedule rules.
- `statPolicy.ts` centralizes order, quantity, follow-up and prefix rules. The instruction engine exposes its validation through DONE, review and final Save/Print. Final callbacks independently inspect current state before any prescription API call.
- The builder supplies one initial-dose prefix and a shared `finalInstructionText` to selected preview, review and saved payload. Printing consumes the same generated lines and places STAT before the subsequent dose rows. There is no repeated initial quantity, English STAT pill or duplicated administration phrase.
- Existing product-type printing applies only to the follow-up patterns covered by Feature 03. STAT's initial prefix has no product type. ENT templates and units are preserved.
- Daily/Evening and STAT + Weekly use their existing frequency wording with the independent follow-up quantity. Weekly quantity entry reuses the existing Number Pad specifically for this combination; this does not implement a separate Weekly feature.

## Compatibility and locking

| Workflow | Behavior |
| --- | --- |
| STAT → 8H / 6H / 5H | Independent follow-up quantity and existing USB/SAM requirements |
| STAT → Digital / BD / TDS / four equal doses | Existing digital fields and product-type policy retained |
| STAT → EOD | Text-only EOD remains valid; no invented EOD quantity or action |
| STAT → EOD → interval / Digital | Existing EOD compatibility and validation apply |
| STAT → Daily / Evening / Weekly | Follow-up quantity and administration are validated |
| STAT → supported SAM | Completed Chewing, Dissolve, With Food, Empty Stomach and Keep in Mouth rules remain active |
| Selected days with Digital | Existing selected-day workflow retained; interval conflicts rejected |
| STAT after regular dosing | Refused without replacing the existing schedule |
| Conflicting intervals/digital or date-range follow-ups | Refused in selection or rejected when restored |
| Oral 4H / CUSTOM / SOS | Unsupported with STAT; existing ENT exceptions remain available |
| Initial quantity editing | Normal dosing and administration cannot be changed until confirmation/cancellation |
| Missing/invalid quantity, unsupported metadata, incomplete follow-up | Completed Save and Print blocked |

Pages 13–15 describe an initial dose before regular dosing, and the approved prefix ends with “then”. No completed STAT-only format is supplied. Accordingly, a completed label requires an actual follow-up selection; text-only EOD qualifies. A saved `followUp` string alone cannot substitute for the actual schedule fields.

Legacy initial GIVE/timing combinations have no approved initial-dose wording in this specification and are rejected for correction rather than silently translated. GIVE remains available for the subsequent administration where its workflow permits it.

## Exact Sinhala examples

The initial prefix is identical in both modes:

- Quantity 1: `පළමුව පමණක් 1 ගන්න ඉන්පසු,`
- Quantity ½: `පළමුව පමණක් ½ ගන්න ඉන්පසු,`
- Quantity 2½: `පළමුව පමණක් 2½ ගන්න ඉන්පසු,`

Examples using existing spec-mode follow-up wording:

- `පළමුව පමණක් 2½ ගන්න ඉන්පසු, කරල් ½ බැගින් පැය 8කට වරක් ගන්න කෑමට පසු`
- `පළමුව පමණක් 1 ගන්න ඉන්පසු, දිනක් හැර දිනක්`

Only the STAT prefix is standardized here. Existing current/spec administration ordering, SAM wording differences and product-type conditions remain unchanged. Physical label dimensions remain 70 × 50 mm.

## Files changed

Production paths are relative to `apps/web/`:

| File | Change |
| --- | --- |
| `lib/statPolicy.ts` | New shared STAT policy and dynamic initial prefix |
| `lib/instructionEngine.ts` | Shared validation and existing frequency-text helper |
| `store/labelStore.ts` | Ordered selection, confirmation/cancellation, independent quantities and refusal guards |
| `lib/labelBuilder.ts` | Initial-first shared text and scoped follow-up composition |
| `components/PrintableLabel.tsx` | Render shared STAT line first; avoid duplicate initial quantity |
| `components/StatPanel.tsx` | Positive finite quantity check and initial-dose guidance |
| `components/label/InstructionGrid.tsx` | Shared selection locks |
| `components/label/DosagePanel.tsx` | Disabled incompatible/pending dosage controls |
| `components/label/LabelActions.tsx` | Lock follow-up administration during initial editing |
| `components/label/BottomActionBar.tsx` | Pending-edit duration/expiry and DONE locks |
| `components/label/SelectedInstructionsPanel.tsx` | Shared final-text preview |
| `components/label/LabelActionPage.tsx` | Review and callback guards |
| `app/label/page.tsx` | DONE/final Save/Print checks and shared saved text |

New tests: `components/label/StatWorkflow.test.tsx` (96 tests). `app/label/page.test.tsx` adds 11 entry-point/payload tests.

Existing expectations were updated in `StatFlow.test.tsx`, `StatWorkstation.test.tsx`, `labelStore.buttons.test.ts`, `Workstation.test.tsx`, `WorkflowGuide.test.tsx`, `labelBuilder.test.ts`, `ownerPhrases.test.ts`, `PrintedInterval.test.tsx`, `ProductTypePrinting.test.tsx`, `Eod.test.tsx`, `UsbAdministration.test.tsx`, and the Chewing/Dissolve/Keep in Mouth/With Food/Empty Stomach suites. These replace obsolete STAT panel/pill expectations while retaining their unrelated assertions.

Earlier uncommitted changes were preserved. This list describes this feature's edits, not ownership of entire working-tree diffs. No API source or schema was changed.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **38 files, 1,059 tests passed** |
| Final STAT/page/store regression rerun | **3 files, 196 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web and API TypeScript | Passed |
| Web ESLint | Passed |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated all 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

Coverage includes quantities, ordering, independent follow-up values, button locks/direct refusal, all permitted follow-ups, unsupported drafts, Back/reset, multiple labels, restoration, exact preview/print text, saved `finalInstructionText`, pending edits after review and independent final-action rejection before API calls. Existing Features 01–10 and ENT regressions pass.

The full web run used one worker and a 15-second per-test timeout after concurrent runs encountered environment timing failures; no repository test configuration or assertions were relaxed. Worker execution required running outside the sandbox. API tests use the existing in-memory harness; intentional failure-path logging does not represent production operations.

## Remaining limitations and safeguards

- Existing API lint remains a repository-wide release blocker; no unrelated auto-fix or suppression was applied.
- Legacy drafts without an ordered STAT marker cannot prove historical click order. Their actual quantities/schedules are validated; new selections retain the marker. Invalid drafts remain editable and are not destructively migrated.
- Physical printer alignment, paper output and actual Sinhala font rendering require device verification. Automated checks cover content, ordering, application guards and unchanged dimensions.
- Existing historical editing/browser-reload draft-storage and numeric precision limits remain. No live database integration was performed.
- No database schema changes, migrations, production-data changes, deployment, commit or GitHub push were performed.

Implementation stops at Feature #13. Feature #14 requires separate approval.
