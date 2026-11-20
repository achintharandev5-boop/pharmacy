# Feature 16 — Weekly Dosing Instructions

Date: 24 October 2026.

**Feature #18 is complete. Feature #19 (Name of Days) and later features have not started.**

## Specification and audit

Checked the attached Feature 16 request, Feature #18 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `Document 5.pdf`, pages 35–38, in the same directory. Earlier product-type, Digital, Evening and Daily rules were retained.

The PDF defines Weekly as a quantity-bearing standalone workflow and as a modifier for a subsequent Digital, Daily or Evening schedule. Its phrase is **`සතියකට වරක්`**. Standalone Weekly needs its quantity and administration; Weekly Done is needed to unlock a subsequent schedule, rather than to print standalone Weekly.

Confirmed gaps were documented before source changes: Weekly had no general quantity entry, only STAT + Weekly used the shared frequency quantity, no Weekly Done gate existed, and unequal/single-time Weekly Digital patterns were rejected. Standalone Weekly could emit the English control tag. Weekly + Daily was incorrectly included in the old conflict warning. Existing product-type consolidation for equal Weekly BD/TDS was already correct and was preserved.

The user confirmed that unequal Weekly Digital doses should retain Weekly above their circled rows without a product-type word. Their earlier decision to retain Weekly before Daily also remains in effect.

## Implementation

- Added `weeklyDosage` to each label and its existing active-label mirror, using the existing dosage entry shape, integer-numerator stepping, fraction formatter and Number Pad. No default dose is inferred. Whole, fractional and mixed quantities use the existing +, − and X/Y controls.
- Weekly selection opens its own quantity pad. Enter retains the value; Back cancels only pending pad input. Its existing-style quantity/Done/Back controls allow correction. Done confirms a valid positive quantity and unlocks Digital/Daily/Evening. Editing the Weekly value clears confirmation; a compound label must be confirmed again.
- Shared `weeklySelectionRefusal` supplies native disabled/faded UI controls and direct-store refusal. Incompatible frequencies cannot replace Weekly. Removing Weekly clears its own quantity and confirmation while preserving subsequent schedule values.
- `weeklyProblem` and the existing readiness analysis validate quantities, order, confirmation, administration, SAM compatibility and required product types. DONE, review, review callbacks and final Save/Print handlers enforce this policy. Final handlers read current labels before any prescription API write. Pending Weekly pad edits also block completion, review, Save and Print until Enter or Back; the last committed quantity is not silently printed during an edit.
- Weekly's entry is independent workflow metadata. In a compound workflow, the subsequent Digital/Daily/Evening quantities govern the actual printed doses; the initial Weekly entry is not printed as an additional initial dose. STAT keeps its separate prescribed initial dose.
- The builder supplies shared generated instructions to selection preview, review, saved `finalInstructionText` and print. Nonconsolidated Weekly Digital labels have a Weekly heading above their original circled rows. Equal BD/TDS uses the unchanged Feature 03 resolver and consolidation policy.
- Added optional validated Weekly metadata to the existing prescription DTO and `instructions_json.weekly`. No database schema change is required. Existing records without this metadata remain readable and are not updated. Serialized `LabelData` drafts retain their own quantity/confirmation and remain detached from the source draft.
- Legacy editor drafts without a required Weekly quantity are flagged for explicit correction; no quantity is inferred from an unrelated frequency field. No historical-prescription editor or browser-reload draft storage was added.

## Compatibility and locking matrix

Both wording modes follow the same schedule and locking policy; their existing administration wording remains unchanged.

| Workflow | Rule |
| --- | --- |
| Weekly alone | Positive own quantity and complete administration; Weekly Done optional |
| Weekly + ordinary TAKE/GIVE | One action and BEFORE/AFTER required; existing wording mode retained |
| Weekly + With Food / Empty Stomach | One action; meal timing locked and omitted |
| Weekly + Chewing / Dissolve / Keep in Mouth | Existing standalone and ordered SAM requirements retained |
| Weekly → quantity → Done → Digital | Allowed; actual selected Digital quantities preserved |
| Weekly + equal BD/TDS | Consolidate actual common dose with the selected Sinhala product type and Weekly phrase |
| Weekly + unequal/partial Digital | User-confirmed Weekly heading and individual circled doses; no product-type injection |
| Weekly → quantity → Done → Daily | Allowed; Weekly modifier precedes existing Daily quantity/instruction |
| Weekly → quantity → Done → Evening | Allowed; actual Evening quantity and wording preserved |
| Digital/Daily/Evening → Weekly | Refused; remove the subsequent schedule and select Weekly first |
| Weekly + 8H/6H/5H/EOD | Incompatible; native UI lock, store refusal, restored-state validation |
| STAT → Weekly | Existing STAT initial dose retained before Weekly follow-up |
| Weekly → STAT | Existing STAT-first restriction retained |
| Weekly + Evening + Digital/four doses | Existing refusal retained: no approved combined frequency wording; no invented Weekly four-times instruction |
| ENT | Existing ENT-specific rendering, units and validation retained; oral Weekly policy bypassed |
| Name of Days | Separate feature not implemented |

## Exact generated Sinhala examples

The examples below use With Food/Empty Stomach wording shared by both modes. Standalone ordinary BEFORE/AFTER keeps the existing current/spec ordering. No unrelated translation changed.

| Selection | Output |
| --- | --- |
| Weekly 1½ + With Food + TAKE | සතියකට වරක් 1½ කෑමත් සමඟ ගන්න |
| Weekly ½ + Empty Stomach + GIVE | සතියකට වරක් ½ හිස් බඩ දෙන්න |
| Weekly 1 + With Food → Chewing + TAKE | සතියකට වරක් 1 කෑමත් සමඟ හපලා කන්න |
| Weekly 1 + Empty Stomach → Dissolve + GIVE | සතියකට වරක් 1 හිස් බඩ දිය කර බොන්න දෙන්න |
| Weekly 1 + Empty Stomach → Keep in Mouth + TAKE | සතියකට වරක් 1 හිස් බඩ දිව මත තබා ගන්න |
| Karal + Weekly + equal BD/TDS 1½ + Empty Stomach + TAKE | කරල් 1½ සතියකට වරක් හිස් බඩ ගන්න |
| Weekly + Daily ½ + Empty Stomach + TAKE | සතියකට වරක් දිනකට ½ හිස් බඩ ගන්න |
| Weekly + Evening ½ + Empty Stomach + TAKE | සතියකට වරක් ½ හවසට හිස් බඩ ගන්න |
| STAT 2 → Weekly ½ + Empty Stomach + TAKE | පළමුව පමණක් 2 ගන්න ඉන්පසු, සතියකට වරක් ½ හිස් බඩ ගන්න |

Unequal Digital output renders `සතියකට වරක්` above the circled rows, with the administration alongside. Saved text preserves the same heading, selected times and exact quantities; it does not substitute a common dose or product type.

## Files changed for this feature

| File | Change |
| --- | --- |
| `apps/web/lib/weeklyPolicy.ts` | New shared Weekly selection/quantity/confirmation policy |
| `apps/web/store/labelStore.ts` | Independent per-label Weekly quantity, pad targets, confirmation, stepping, locks and reset |
| `apps/web/lib/instructionEngine.ts` | Weekly administration readiness and final-action adapter |
| `apps/web/lib/digitalSchedule.ts` | Permit user-confirmed unequal Weekly circled rows |
| `apps/web/lib/statPolicy.ts` | Read Weekly's independent follow-up quantity |
| `apps/web/lib/labelBuilder.ts` | Shared standalone/compound Weekly text and circled-row heading |
| `apps/web/components/PrintableLabel.tsx` | Render Weekly heading once above structured rows |
| `apps/web/components/NumberPad.tsx` | Weekly quantity/fraction labels |
| `apps/web/components/label/InstructionGrid.tsx` | Weekly detail and native schedule locks |
| `apps/web/components/label/DosagePanel.tsx` | Weekly Done gate for Digital controls |
| `apps/web/components/label/LabelActions.tsx` | Existing-style Weekly quantity/Done/Back controls |
| `apps/web/components/label/SelectedInstructionsPanel.tsx` | Real-time Weekly quantity chip |
| `apps/web/components/label/LabelActionPage.tsx` | Review and callback validation |
| `apps/web/app/label/page.tsx` | Final Save/Print guards and independent quantity payload |
| `apps/web/components/label/Weekly.test.tsx` | New Weekly workflow, output and regression tests |
| `apps/web/app/label/page.test.tsx` | Weekly final-entry-point/payload tests and completed Daily fixture |
| `apps/web/components/label/DigitalLabel.test.tsx` | Complete Weekly Done and retain approved unequal rows |
| `apps/web/components/label/Daily.test.tsx` | Complete Weekly-first flow; reject reverse order |
| `apps/web/components/label/Evening.test.tsx` | Complete Weekly Done before Evening |
| `apps/web/components/label/Workstation.test.tsx` | Follow the quantity pad/Back flow and approved Weekly + Daily gate |
| `apps/web/components/label/UsbAdministration.test.tsx` | Require administration for quantity-bearing Weekly |
| `apps/web/components/ProductTypePrinting.test.tsx` | Supply required Weekly quantity while retaining type-free assertion |
| `apps/api/src/prescriptions/dto/weekly-dosage.dto.ts` | New optional metadata validation |
| `apps/api/src/prescriptions/dto/create-prescription.dto.ts` | Accept nested Weekly metadata |
| `apps/api/src/prescriptions/prescriptions.service.ts` | Preserve Weekly metadata in existing JSON |
| `apps/api/src/prescriptions/weekly-label.spec.ts` | Metadata persistence/validation tests |
| `PHARMACY_FEATURE_16_WEEKLY_REPORT.md` | This report |

Many files already contained uncommitted changes. This list describes Feature 16 edits, not ownership of complete Git diffs. Existing work, including unrelated step-dose types, was retained.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest | **43 files, 1,500 tests passed** |
| Relevant API Jest: products service/type, prescriptions service, Digital, Evening, Daily and Weekly | **7 suites, 77 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| API ESLint on new Weekly DTO/spec | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated all 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The 88 added web tests cover Weekly quantity entry, whole/fraction/mixed values and thirds, Done gating, native disabled/faded controls, direct-store refusal, compatibility/order, complete TAKE/GIVE and ordered SAM combinations in both modes, independent subsequent quantities, all three product types, equal BD/TDS, user-approved unequal/partial circled rows, STAT/EOD restrictions, review/print-fit safeguards, Back/reset, per-label navigation, detached draft restoration and invalid legacy-draft correction. Final Save/Print tests bypass disabled review controls and verify rejection before API calls, including pending quantity edits. Six payload tests capture exact generated text and independent Weekly metadata for standalone, Daily, Evening, equal/unequal Digital and STAT workflows. Their simulated failure responses prevent real writes.

Twelve new API tests verify metadata persistence across these supported representations, numeric validation, nested DTO whitelisting and compatibility with existing API records that omit the optional metadata. All completed Features 01?15 and ENT regressions pass. The new policy reuses the shared dose normalization and existing product-type mapping/printing rules.

Earlier test failures came from superseded Weekly fixtures, a stale DOM reference after Number Pad replacement and a new fixture's TypeScript union inference. They were corrected before the successful full rerun. The first production build failed on that fixture type error; the completed rerun passed. Vitest and the web build ran outside the sandbox to permit worker spawning. The successful final web build did not emit the previously observed native cache-compaction shutdown warning.

## Remaining limitations and safeguards

- Full API lint is an inherited repository-wide release gate; unrelated API code is not auto-fixed and no rules are suppressed.
- Physical printer alignment, paper output, actual Sinhala font rendering and device print-fit verification remain manual. The existing 70 × 50 mm layout, 30.5 mm instruction area, fonts and overflow checks are unchanged.
- No live database integration or production data access was performed. API tests use the existing in-memory harness; simulated save failures verify the web API boundary without real writes.
- Historical editing, browser-reload draft-storage and existing numeric precision limitations remain unchanged.
- The drive filled during an edit. The store was recovered from its existing local build source map and checked against that snapshot: only intended Weekly changes remain. Generated Next caches were removed to free space; no application data was removed.
- No schema changes, migrations, production-data changes, deployment, commit or GitHub push were performed. Implementation stops at Feature #18.
