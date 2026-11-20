# Feature 17 ? Name of Days (Feature #19)

Date: 24 October 2026.

## Audit before source changes

Document 5.pdf pp25?27 authorizes Name of Days ? day(s) ? Done ? Digital Label, Daily or Evening ? USB/SAM. STAT may precede it; intervals and EOD are locked. Weekly + selected days is unspecified and the user explicitly chose to block it. The examples retain selection order (Sunday, Wednesday, Friday). The prose says ?after the final day?, but the examples and gap plan use ?? before the final day; these examples govern formatting.

Confirmed gaps: English weekday controls/summary/print tags; calendar sorting overrides selection order; no required-day Done gate; no shared day validation at completion boundaries; no Weekly/day incompatibility; day entry can occur after the dosing schedule. Existing label state, cancellation, reset, product-type policy and print-fit checks can be reused. Changes will preserve working workflows and stop before Feature #20.

PDF English weekday options and Sinhala output examples were checked; the full Sinhala mapping is supplied by Feature #19 of the gap plan (PDF extraction corrupts several Sinhala glyphs).

## Implementation and confirmed fixes

- Added `nameOfDays.ts` for shared day names, joining, selection refusal and restored-state validation. Existing `selectedDaysOfWeek` is retained; `daysConfirmed` records Done on each label without adding a second day collection. Old drafts with days but no confirmation require explicit correction/Done.
- Seven touch/keyboard native buttons display Sinhala, expose `aria-pressed`, and turn blue when selected. Done requires at least one valid, unique day. Cancel restores the original selection and confirmation. Remove selected days exits the qualifier without changing the dosing schedule. Selected-panel removal also releases its locks.
- Kept selection order. Repeated clicks deselect; bulk assignment deduplicates valid identifiers without sorting. Unknown and duplicate restored values block completion. No default day, dose, action or Weekly modifier is inferred.
- Shared refusal is applied to grid controls, Digital controls and direct store actions. Incompatible selections remain removable. Day selection cannot be started after an existing Digital, Daily or Evening schedule; an existing day qualifier can be reopened for correction.
- Preview, review and saved text use the builder's common Sinhala day prefix. Print renders that prefix after any initial STAT phrase and before dosing, replacing the old English day pill. Existing circled-dose rows and consolidated product-type sentences remain intact.
- DONE, review, review callbacks and both independent final Save/Print handlers check the latest label state. An open day editor also blocks these actions, including an empty editor. Final guards run before prescription API writes.
- Product-type policy, administration generators, font safeguards, label dimensions and print-fit detection were reused. Long day headings are measured at existing font sizes and printing is rejected on overflow.

## Exact mappings

| Identifier | Sinhala |
| --- | --- |
| MONDAY | ????? |
| TUESDAY | ????????? |
| WEDNESDAY | ????? |
| THURSDAY | ?????????????? |
| FRIDAY | ???????? |
| SATURDAY | ????????? |
| SUNDAY | ????? |

Two days: `????? ?? ??????????????`. Three days selected Sunday ? Wednesday ? Friday: `?????, ????? ?? ????????`. There is exactly one conjunction before the last day; no trailing separator.

## PDF-grounded compatibility and selection order

Rules below apply to oral labels in both wording modes. Existing administration requirements still apply.

| Workflow | Policy and basis |
| --- | --- |
| Name of Days ? day(s) ? Done ? Digital | Allowed, PDF pp25?27; selected time quantities required |
| Name of Days ? day(s) ? Done ? Daily | Allowed, PDF p26; Daily quantity and existing administration required |
| Name of Days ? day(s) ? Done ? Evening | Allowed, PDF p26; Evening quantity and existing administration required |
| Day(s) without a subsequent dosing schedule | Incomplete; standalone weekday-only printing is not specified |
| Digital/Daily/Evening ? new Name of Days | Refused; PDF day-first order; remove the schedule first |
| Reopen already selected day(s) after dosing | Allowed for correction; Done confirms changes, Cancel restores the draft |
| STAT ? Name of Days | Allowed, PDF p27; preserves independent initial quantity and existing STAT-first rules |
| Name of Days ? new STAT | Refused by existing STAT-first rule |
| Selected days + 8H/6H/5H/EOD | Refused in both directions; explicit PDF p27 locks |
| Selected days + Weekly | Refused in both directions; unspecified in the Name of Days section and explicitly rejected by the user |
| Weekly without selected days | Existing valid workflows preserved; day selection is not mandatory for Weekly |
| Selected days + BD/TDS | Derived from actual Digital quantities; existing equal-dose consolidation/product-type policy retained |
| Selected days + unequal Digital | Existing independent circled dose rows retained below day heading |
| Selected days + four daily doses | Through the existing Evening + Digital workflow; existing confirmation/quantity rules retained |
| Selected days + TAKE/GIVE | Existing ordinary meal timing required |
| Selected days + With Food / Empty Stomach | Existing action required; meal timing remains locked |
| Selected days + Chewing / Dissolve / Keep in Mouth | Existing standalone timing and ordered SAM combination rules retained |
| Selected days + ENT | Not an approved oral day workflow; new combination refused; existing ENT without selected days preserved |
| Selected days + legacy 4H/CUSTOM/SOS or raw BD/TDS tags | Refused; no approved Name of Days workflow for these tags |
| TILL TO THE DAY/date range | Not implemented; Feature #20 remains separate |

## Generated examples

- Single day + Daily ? + Empty Stomach + TAKE: `????? ????? ? ???? ?? ????`
- Monday + Thursday + Daily ?: `????? ?? ?????????????? ????? ? ???? ?? ????`
- Sunday ? Wednesday ? Friday + Daily ?: `?????, ????? ?? ???????? ????? ? ???? ?? ????`
- STAT 1 then Monday + Daily ?: `????? ????? 1 ???? ??????, ????? ????? ? ???? ?? ????`

Digital examples retain the existing product-type wording and structured dose rows. A standalone day qualifier does not inject `????`, `????` or `?????`. Current/spec differences in unrelated administration phrases are unchanged.

## Files changed for this feature

| File | Purpose |
| --- | --- |
| `apps/web/lib/nameOfDays.ts` | Central weekday mapping, formatter and policy |
| `apps/web/lib/instructionEngine.ts` | DONE/readiness and shared final-action day validation |
| `apps/web/lib/labelBuilder.ts` | Sinhala day prefix and saved text |
| `apps/web/store/labelStore.ts` | Day confirmation, ordering, correction, removal and direct-action restrictions |
| `apps/web/app/label/DaysOfWeekPanel.tsx` | Seven Sinhala buttons, blue state, Done gate and explicit removal |
| `apps/web/components/label/InstructionGrid.tsx` | Shared locks and translated day caption |
| `apps/web/components/label/DosagePanel.tsx` | Digital entry lock before day confirmation |
| `apps/web/components/label/SelectedInstructionsPanel.tsx` | Immediate Sinhala day summary |
| `apps/web/components/PrintableLabel.tsx` | Day heading before dosing; suppress English weekday pill |
| `apps/web/components/label/LabelActionPage.tsx` | Review errors, disabled actions and callback revalidation |
| `apps/web/app/label/page.tsx` | DONE and latest-state final Save/Print guards |
| `apps/web/components/label/NameOfDays.test.tsx` | 70 weekday integration/regression tests across both modes |
| `apps/web/app/label/page.test.tsx` | 16 final-action rejection cases and exact saved-payload test |
| `apps/web/components/label/Workstation.test.tsx` | Update existing weekday control expectation to Sinhala |
| `apps/web/store/labelStore.buttons.test.ts` | Update existing day expectations to selection order |
| `PHARMACY_FEATURE_17_NAME_OF_DAYS_REPORT.md` | Audit, decisions and verification report |

Earlier uncommitted work was preserved. This list describes this feature's edits, not ownership of entire working-tree diffs. No API source changes were needed: the existing prescription payload already stores selected days and generated instruction text.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest (`--maxWorkers=4 --minWorkers=2`) | **44 files, 1,587 tests passed** |
| New weekday tests | **70 passed**, both wording modes |
| New final-action/API-payload tests | **17 passed** within the full suite |
| Relevant API Jest | **7 suites, 77 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing **1,064 errors, 63 warnings** |
| Web production build | Passed; 27 static pages generated |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

An earlier unrestricted-worker full run had one existing STAT UI test exceed its five-second timeout while builds were running. The final full run with four workers passed all 1,587 tests, including all 96 STAT workflow tests. No timeout or test behavior was relaxed. Vitest and the web build required execution outside the sandbox to permit worker spawning. API tests used the existing in-memory harness, including intentional simulated error paths.

The new cases cover all seven names, ordering/conjunctions, deselection, duplicate prevention, blue/disabled controls, store refusal, schedule compatibility, every ordered SAM combination with TAKE/GIVE, product types, STAT, reset, Back, cancel/navigation rollback, per-label JSON restoration, legacy correction, selected panel/print consistency and measured seven-day overflow. Final-page tests deliberately bypass review controls and mutate labels after review to prove independent Save/Print refusal. The valid API-boundary test uses a simulated failure response and performs no real write.

## Remaining limitations and scope

- Full API lint remains an existing repository-wide failure; no unrelated auto-fixes or rule suppression were applied.
- DOM tests verify overflow detection and blocked printing using measured rectangles. Actual font shaping, paper alignment and physical printer output require device verification. The 70 ? 50 mm dimensions, existing instruction font sizes and fit safeguards are unchanged.
- Serialized editor drafts preserve per-label day confirmation. Historical prescription editing and browser-reload draft storage are existing limitations; neither was added. Legacy drafts without confirmation must be reviewed explicitly, rather than inferring their selection history.
- PDF Sinhala extraction has damaged glyphs; exact complete weekday spellings follow the supplied gap-plan mapping. The examples/plan resolve the PDF's contradictory conjunction prose, using selection order and final-day joining as documented in the audit.
- No database schema changes, migrations, production-data changes, deployment, commit or GitHub push occurred.

**Feature #19 is complete.** Feature #20 and later features were not implemented.
