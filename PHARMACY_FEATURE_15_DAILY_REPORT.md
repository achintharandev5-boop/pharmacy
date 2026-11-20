# Feature 15 — Daily Dosing Instructions

Date: 24 October 2026.

**Feature #17 is complete. Feature #18 and later features have not started.**

Primary sources: the attached Feature 15 request, Feature #17 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `Document 5.pdf` in the same directory. Daily requirements are on pages 33–35; related Weekly/Daily availability is on pages 35–37. Existing STAT, EOD, interval, Digital Label, Evening and administration policies were retained.

## Existing implementation audit

- The PDF explicitly defines **`දිනකට`**, not `දිනපතා`, for Daily. Its diagram contains **Select Qty → USB/SAM → output**. Daily is therefore a quantity-bearing schedule in this implementation, not a complete text-only instruction or an assumed once-daily administration action.
- Daily already selected the existing `frequencyDosage` Number Pad. Whole/fraction/mixed quantity entry, Back, independent STAT quantity and per-label state were reusable.
- Existing rendering used an English `DAILY` tag and the legacy frequency phrase `බැගින් දිනපතා`; preview/save summaries could repeat the quantity separately.
- The existing interval, Digital and Evening policies covered many conflicts. Daily itself lacked a complete shared refusal/restored-state policy; some frequency selections could replace it. Its Done/Back layout controls were missing.
- DONE already used centralized readiness, but review and the final Save/Print callbacks had no dedicated Daily adapter covering all invalid quantities/conflicts and latest-state changes.
- The audit covered the engine, builder, product-type policy, store, grid/tile, dosage/actions/selected panel, review, printable component, final page handlers and related tests. Existing shared preview/print components and physical dimensions required no redesign.

## Confirmed gaps and fixes

1. Added `dailyPolicy.ts` for shared quantity/conflict validation and selection refusal. It is used by the existing grid, Digital controls and direct store/pad entry points.
2. Daily and incompatible Digital/interval/Evening/frequency selections are refused without replacing or clearing a valid existing schedule. Existing selected conflicts remain removable for correction. Deselecting Daily releases its own locks while other policies retain theirs.
3. Reused the existing `frequencyDosage` record as Daily's sole dose source. No independent Daily quantity or new schedule mode was introduced. Invalid, non-finite, non-positive and missing quantities are blocked.
4. Added compact Done/Back controls to the existing administration card. Number Pad Enter commits the quantity; Done returns to the Function Pad without assuming an action or unlocking incompatible schedules. Back cancels pending pad input and preserves the last committed quantity using existing semantics.
5. The builder now generates **`දිනකට [selected quantity] [existing administration]`**. It suppresses the redundant frequency row/summary and the English control tag. No product type, frequency number, TAKE/GIVE or meal timing is inferred.
6. Added `dailyPrintError` as an adapter over existing `analyseLabel`. DONE, review, review callbacks and both final callbacks use centralized readiness, including existing USB/SAM and modifier-order checks. Final Save/Print independently inspect current labels before any prescription API write.
7. Daily removal/reset clears its associated quantity, including invalid legacy values, so hidden frequency data cannot affect later output. Existing navigation, serialized-draft detachment and other dose records are retained.
8. The existing product-type printing policy, Digital/Evening normalization and circled-row renderer were reused unchanged. ENT bypasses the oral Daily policy and retains its existing templates/units.

## Weekly clarification and scope

The PDF permits Weekly + Daily but does not supply a complete output sentence for that combination. The user explicitly selected **retain `සතියකට වරක්` before Daily**, while leaving the separate Weekly workflow for Feature #18.

Accordingly, either supported modifier order retains one Weekly phrase before the Daily sentence. This does not introduce an independent Weekly quantity, a new Weekly Done state or historical Weekly editing. Existing STAT/EOD first-selection restrictions remain authoritative even though the Daily page lists those buttons as available.

## PDF-grounded compatibility matrix

| Selection/order | Classification and behavior |
| --- | --- |
| Daily → quantity → complete USB/SAM | Allowed; selected quantity required, no assumed administration |
| Daily alone with no quantity/action | Incomplete; no complete label can be saved/printed |
| Daily + TAKE/GIVE and BEFORE/AFTER | Allowed when the existing USB requirements are complete |
| Daily + With Food/Empty Stomach | Allowed with an action; their existing timing locks remain |
| Daily + Chewing/Dissolve/Keep in Mouth | Existing standalone/ordered combination requirements retained |
| Daily ↔ 8H/6H/5H | Disallowed; remove the existing schedule before selecting another |
| Daily ↔ Digital/BD/TDS/four-times-daily | Disallowed; Digital controls are natively disabled while Daily is selected |
| Daily ↔ Evening | Disallowed; no existing Evening quantity or confirmation is silently replaced |
| STAT first → Daily | Allowed; initial and Daily quantities independent; one STAT prefix |
| Daily → new STAT | Refused under completed STAT-first policy |
| EOD first → Daily | Allowed; text-only EOD modifier before the Daily sentence |
| Daily → EOD | Refused under completed EOD-first policy |
| EOD alone | Existing text-only `දිනක් හැර දිනක්`; no invented quantity/action |
| Weekly + Daily | Allowed as an existing modifier; output follows the explicit user clarification above |
| Other/duplicate restored frequencies or invalid SAM order | Rejected for correction; no completed API write |
| Missing/unsupported product type | Existing warning retained; valid Daily is type-free and is not blocked solely for that value |
| ENT Daily | Existing ENT template/quantity rules retained |

The compatibility basis is PDF pages 33–34 and the completed schedules' own restrictions, with the Weekly output clarification above. No new combination is inferred merely by concatenating raw control names.

## Exact Sinhala examples

Both modes, using the selected meal-condition combinations:

- `දිනකට 1 හිස් බඩ ගන්න`
- `දිනකට ½ කෑමත් සමඟ දෙන්න`
- `දිනකට 1½ හිස් බඩ දිය කර බොන්න`
- `දිනකට 1 1/3 හිස් බඩ දිව මත තබා ගන්න`
- `පළමුව පමණක් 2½ ගන්න ඉන්පසු, දිනකට ½ හිස් බඩ දෙන්න`
- `දිනක් හැර දිනක්, දිනකට ½ හිස් බඩ දෙන්න`
- User-approved modifier: `සතියකට වරක් දිනකට 1½ කෑමත් සමඟ ගන්න`

For ordinary TAKE + AFTER:

| Wording mode | Output |
| --- | --- |
| Current | දිනකට 1 කෑමට පසු ගන්න |
| Spec | දිනකට 1 ගන්න කෑමට පසු |

The quantity shown is the explicitly selected dosage, not a generated frequency count. The Daily-only correction replaces the old frequency-style `දිනපතා` output; unrelated phrases, including existing Digital wording and the inherited standalone Chewing mode difference, remain unchanged.

## Quantity, state and printing verification

- The existing Number Pad and Feature 01 formatter handle integers, half/quarter glyphs, mixed numbers and thirds. Plus/Minus and fraction corrections remain scoped to the existing frequency quantity; STAT retains its separate record.
- Cancelling uncommitted Number Pad input retains the prior quantity. Removing/resetting Daily clears its quantity. Per-label navigation and serialized `LabelData` restoration retain independent values without mutating the saved draft object.
- Selected preview, live print component, review and saved `finalInstructionText` consume the same built instruction. Daily's obsolete English tag and redundant quantity summary are absent from completed output.
- The API already stores `frequency_type: DAILY`, `frequency_qty`, instructions JSON, independent STAT fields and exact `final_instruction_text`. New in-memory API tests verify plain Daily and STAT/EOD/Weekly modifiers without production writes.
- Existing 70 × 50 mm dimensions, 30.5 mm instruction area, Sinhala font loading and print-fit measurements were unchanged. Overflow is still rechecked at click time and blocks printing. No font reduction or structured badge changes were introduced.
- Historical prescription reprinting remains unavailable under the existing implementation; this feature does not add a historical editing/reprint path or claim physical printer fidelity.

## Files changed

Paths are relative to `apps/web/`, unless stated otherwise:

| File | Change |
| --- | --- |
| `lib/dailyPolicy.ts` | New shared Daily wording constant, refusal and invalid-state checks |
| `lib/instructionEngine.ts` | Central readiness integration and Daily completion adapter |
| `store/labelStore.ts` | Daily Done action, shared refusal and scoped quantity clearing |
| `lib/labelBuilder.ts` | Exact Daily sentence/modifier handling and duplicate-summary suppression |
| `components/label/InstructionGrid.tsx` | Shared native disabled schedule locks |
| `components/label/DosagePanel.tsx` | Shared Digital refusal |
| `components/label/LabelActions.tsx` | Done/Back within the existing administration card |
| `components/label/LabelActionPage.tsx` | Review/callback guards and label-numbered errors |
| `app/label/page.tsx` | Independent final Save/Print checks |
| `components/label/Daily.test.tsx` | 66 new cases across both wording modes |
| `app/label/page.test.tsx` | 22 new DONE/final-action/payload cases |
| `components/PrintedInterval.test.tsx` | Update the obsolete Daily frequency-string assertion |
| `components/label/Workstation.test.tsx` | Verify the exact Daily preview instead of its old English summary |
| `apps/api/src/prescriptions/daily-label.spec.ts` | Four new persistence cases; API-root path |
| `PHARMACY_FEATURE_15_DAILY_REPORT.md` | This report; repository-root path |

Earlier uncommitted work was preserved. The list describes this feature's edits rather than ownership of complete working-tree diffs. No API production code, schema, product-type mapping, dosage formatter or physical print layout was changed.

## Verification

| Check | Result |
| --- | --- |
| Dedicated Daily Vitest | **66 tests passed** |
| Full web Vitest | **42 files, 1,412 tests passed** |
| Relevant API Jest, including Digital/Evening/Daily persistence | **6 suites, 65 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Targeted API ESLint on new test | Passed |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings** |
| Web production build | Passed, exit 0; generated all 27 static pages; native shutdown diagnostic remains (see limitations) |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

New cases cover exact quantities/wording, action and timing requirements, all completed SAM combinations, bidirectional refusal, invalid restored schedules, reverse modifier order, product-type boundaries, selected/disabled states, Back/correction/reset, label independence/restoration, print content and print-fit rejection.

All completed Features 01–14 and ENT regressions pass. The obsolete Daily frequency-string and English-summary expectations were updated before the successful full run. This feature adds 88 web cases and four API persistence cases.

Final-action tests bypass review controls and mutate current labels after review. Both Save and Print reject invalid quantity, interval/Evening/Digital conflict, reverse EOD order, missing action and invalid SAM order before API calls. Valid Save tests inspect the independent quantity and exact text; simulated failure responses avoid real record writes.

Vitest uses at most two workers and a 15-second per-test timeout without changing repository configuration. Worker spawning/build required running outside the sandbox. API tests use the existing in-memory harness, including deliberately simulated failure paths. No lint rules were suppressed or unrelated API files auto-fixed.

## Remaining limitations and safeguards

- Existing repository-wide API lint remains a release blocker.
- The web build emits `Shutting down failed: Failed to compact database`, including on a sequential rerun. The exact diagnostic is present in Next's installed native `next-swc.win32-x64-msvc.node` library; it is a build-tool shutdown message, not a pharmacy database operation. Compilation, typechecking and route generation complete; the build's final exit status is recorded above. No cache deletion, dependency/configuration change or unrelated remediation was performed.
- Physical printer alignment, actual Sinhala font rendering and paper output remain pending device verification. Oversized text is blocked rather than shrunk to fit.
- Weekly's separate quantity/Done workflow remains Feature #18. The limited modifier behavior here follows the user's explicit clarification.
- Existing historical reprint/editing, browser-reload draft-storage and numeric precision boundaries remain unchanged. No live database integration was performed.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #17. Feature #18 requires separate approval.
