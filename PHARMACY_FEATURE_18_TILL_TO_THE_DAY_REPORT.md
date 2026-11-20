# Feature 18 — Till to the Day (Feature #20)

Date: 25 October 2026.

## Audit recorded before source changes

Checked Document 5.pdf pp28–29, Feature #20 of the supplied gap plan, and the existing engine, builder, store, grid/tile, administration, selected panel, review/final handlers, print component and scheduling tests.

The PDF defines weekday endpoints, not calendar dates. Actual order: Name of Days → one first day → Done → TILL TO THE DAY → Name of Days → one second day → Done → Digital/Daily/Evening → USB/SAM. Its locks are EOD, STAT, 8H, 6H, 5H and Weekly. Existing Name of Days single/multiple formatting remains separate. The PDF does not define a same-day restriction or week-boundary arithmetic; the user explicitly confirmed identical endpoints are allowed without inferred duration.

Confirmed gaps: the grid exposes old Till Date/And This Date text toggles; the builder maps old tags to unrelated date phrases. There is no distinct range metadata, endpoint editor, range workflow validation, saved endpoint representation or range-specific regression coverage. Existing weekday names, day editor, confirmation/cancel snapshots, label isolation, administration policies, product-type policy, day validation boundaries and print heading/fit safeguards can be extended without rewriting working schedules.

The implementation will convert only a single confirmed weekday into a range start, refuse conversion of multiple independent weekdays, keep endpoint edits separate and reversible, and block legacy date tags until corrected. Feature #21 and later remain out of scope.

## Confirmed fixes

- `nameOfDays.ts` now includes the shared weekday-range type, endpoint formatter, activation/refusal rules and range validation. The seven existing Sinhala mappings are reused unchanged. Start and end are explicit weekday identifiers; there is no date picker, numeric day sorting, duration calculation or automatic wrap calculation.
- A range can begin only from exactly one confirmed Name of Days selection before a dosing schedule. Activating Till to the Day deliberately transfers that single selection into the start endpoint and opens no default end. Multiple independent day selections are never converted or replaced.
- The existing seven-day panel serves the end endpoint by default after activation. Its heading states which endpoint is being edited; the current start/end values remain visible. One endpoint is selected at a time, selected buttons are blue, and Select All is natively disabled in range mode. Done needs a valid selected endpoint. Endpoints remain unconfirmed until Done.
- The old Till Date control is replaced by Till to the Day. The old And This Date slot becomes Edit start day, preserving the workstation grid. Editing the start preserves the end; editing the end preserves the start. Same-day endpoints are permitted exactly as chosen, per user clarification. A Sunday-to-Monday range remains Sunday-to-Monday.
- Cancel/Back and label navigation restore endpoint snapshots. Number Pad Back preserves committed endpoints and quantities. Reset and Clear All also abandon pending editor snapshots so a later navigation cannot resurrect a removed range. Deselecting a range restores its single start day as the original ordinary qualifier; starting a new range requires a new end selection.
- Range mode and individual/multiple Name of Days mode are mutually exclusive. Independent multi-day joining and ordering remain unchanged, including `සහ`. Raw legacy date tags are refused for new selections and restored legacy tags block completion until explicitly removed and corrected; their old translations are not printed.
- The builder supplies one shared range prefix before the existing dose schedule and administration. PrintableLabel reuses its existing day-heading rendering; no physical layout, dimensions, instruction font sizes or circled-dose rendering changed. Incomplete or malformed endpoints produce no completed instruction text. Review and printing remain blocked until all schedule/administration requirements are met.
- Existing `daysPrintError`/`analyseLabel` now cover range metadata and legacy markers. DONE, review, review callbacks, final Save and final Print all use that policy; the final handlers read current labels before any API write. No parallel administration validator was introduced.
- An optional nested `weekdayRange` DTO validates exact endpoint identifiers and confirmation. The API preserves it in the existing `instructions_json` field alongside the exact `final_instruction_text`. There is no schema change or migration, and historical payloads without the optional metadata remain valid.

## Exact Sinhala output

The weekday names reuse Feature #19: සඳුදා, අඟහරුවාදා, බදාදා, බ්‍රහස්පතින්දා, සිකුරාදා, සෙනසුරාදා and ඉරිදා.

| Selection | Generated output |
| --- | --- |
| Monday → Friday range | සඳුදා සිට සිකුරාදා දක්වා |
| Sunday → Monday range | ඉරිදා සිට සඳුදා දක්වා |
| Monday → Monday range | සඳුදා සිට සඳුදා දක්වා |
| Monday → Friday + Daily ½ + Empty Stomach + TAKE | සඳුදා සිට සිකුරාදා දක්වා දිනකට ½ හිස් බඩ ගන්න |
| Monday → Friday + equal Evening/Digital four doses of 1, Karal | සඳුදා සිට සිකුරාදා දක්වා කරල් 1 බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න |

Every range has exactly one `සිට` and one `දක්වා`, no `සහ` and no English control tag. Same-day endpoints repeat the selected weekday at its two explicit positions; they imply no duration. Ordinary multi-day instructions retain their existing distinct output, e.g. `සඳුදා සහ බදාදා`.

## PDF-grounded compatibility matrix

Both wording modes follow the same range rules. Existing wording differences in unrelated administration remain unchanged.

| Selection/order | Rule |
| --- | --- |
| Name of Days → one day → Done → Till to the Day → Name of Days → one day → Done | Required activation/endpoint sequence, PDF pp28–29 |
| Till to the Day without a confirmed first day | Refused; no assumed start |
| More than one independent weekday → Till to the Day | Refused; preserves all independent days |
| Existing Digital/Daily/Evening → new range | Refused; range comes before the dosing schedule |
| Complete range → Digital | Allowed; actual time quantities required |
| Complete range → Daily | Allowed; existing positive quantity and administration required |
| Complete range → Evening | Allowed; existing positive quantity and administration required |
| Complete range → equal BD/TDS | Existing Digital consolidation and centralized product-type printing retained |
| Complete range → unequal Digital | Existing independent circled rows retained below the range heading |
| Complete range → Evening + Digital / four daily doses | Existing Evening confirmation, equal-dose consolidation and unequal-row rules retained |
| Incomplete range → dosing schedule | Refused by UI and direct store actions; select and confirm the missing endpoint |
| Range alone | Incomplete qualifier; PDF requires Digital/Daily/Evening and USB/SAM; no automatic dose/action/product type |
| Range + Weekly | Refused in both directions; explicit PDF lock |
| Range + EOD | Refused in both directions; explicit PDF lock |
| Range + STAT, including STAT first | Refused; explicit PDF STAT lock; existing STAT + ordinary Name of Days remains intact |
| Range + 8H/6H/5H | Refused in both directions; explicit PDF locks |
| Range + raw BD/TDS, 4H/CUSTOM/SOS or ENT | Unsupported range workflows refused; ordinary ENT remains unchanged |
| Range + independent selected weekdays | Invalid restored draft; correct the conflicting qualifier |
| Range + TAKE/GIVE + BEFORE/AFTER | Existing ordinary administration rules retained |
| Range + With Food / Empty Stomach | Existing action requirement and timing lock retained |
| Range + Chewing / Dissolve / Keep in Mouth | Existing standalone timing and ordered SAM compatibility retained |
| Weekly + ordinary Name of Days | Existing Feature #19 refusal preserved |
| Identical endpoints | Allowed by explicit user decision; no duration inferred |
| End earlier in calendar list than start | Retain entered endpoint order; PDF defines no sorting or week-length arithmetic |
| Endpoint correction | Explicit Edit start day or Name of Days/end editor; Done confirms, Cancel restores |

## Files changed for this feature

| File | Purpose |
| --- | --- |
| `apps/web/lib/nameOfDays.ts` | Shared range type, formatter, compatibility and validation |
| `apps/web/store/labelStore.ts` | Activation, endpoint editor, snapshots, reset/removal and store refusals |
| `apps/web/app/label/DaysOfWeekPanel.tsx` | Endpoint mode on the existing seven buttons |
| `apps/web/components/label/InstructionGrid.tsx` | Till to the Day/Edit start controls and locks |
| `apps/web/constants/instructions.ts` | Align matrix identifiers with replacement controls |
| `apps/web/components/label/SelectedInstructionsPanel.tsx` | Range summary, correction notice and removal |
| `apps/web/lib/instructionEngine.ts` | Reuse day readiness/final-action guards for ranges |
| `apps/web/lib/labelBuilder.ts` | Exact range prefix; remove legacy translations and suppress incomplete range output |
| `apps/web/app/label/page.tsx` | Include separate weekday endpoints in the existing saved payload |
| `apps/api/src/prescriptions/dto/weekday-range.dto.ts` | Optional nested endpoint metadata validation |
| `apps/api/src/prescriptions/dto/create-prescription.dto.ts` | Expose optional range payload |
| `apps/api/src/prescriptions/prescriptions.service.ts` | Preserve range in existing JSON instructions |
| `apps/web/components/label/TillToDay.test.tsx` | Range workflow, UI, formatter, state and overflow regressions |
| `apps/web/app/label/page.test.tsx` | DONE, independent final-action rejection and saved-text consistency tests |
| `apps/api/src/prescriptions/weekday-range.spec.ts` | DTO validation, persistence and backward compatibility |
| `apps/web/components/label/Workstation.test.tsx` | Remove three superseded legacy-date toggle/text assertions; range tests replace them |
| `apps/web/components/label/Eod.test.tsx` | Assert replacement controls retain EOD locks |
| `PHARMACY_FEATURE_18_TILL_TO_THE_DAY_REPORT.md` | This report |

Earlier uncommitted work, including database-free UI testing changes, was preserved. This table describes this feature's edits rather than ownership of entire working-tree diffs. LabelActions, InstructionTile, PrintableLabel, review/final day guards and the existing schedule/SAM/product-type formatters were audited and reused; those components did not require a separate range implementation.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest (`--maxWorkers=4 --minWorkers=2`) | **48 files, 1,725 tests passed** |
| Range integration/regression tests | **78 passed**, both wording modes |
| New DONE/final-action/save-payload tests | **37 passed** within the full web suite |
| Existing Name of Days suite | **70 passed**, both wording modes |
| Relevant API Jest | **8 suites, 87 tests passed**, including 10 new range cases |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing **1,064 errors, 63 warnings**, unchanged total |
| Web production build | Passed; 27 static pages generated |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The final run includes completed dosage, product-type, SAM, USB, EOD, STAT, interval, Digital, Evening, Daily, Weekly, Name of Days and ENT regressions, plus the existing database-free UI tests. An earlier full run found two corrupted Sinhala expected strings in the newly added four-dose test; those test literals were corrected to UTF-8 and the entire suite was rerun successfully. No test was disabled or timeout relaxed. Vitest and the web build ran outside the sandbox to allow worker spawning. API checks used the in-memory test harness, including intentional simulated database error paths.

The range tests cover all seven end values, single-day and cross-week ranges, the user-approved identical endpoints, activation order, missing/unknown endpoints, marker/metadata mismatch, duplicate markers, reversed restored schedule order, multi-day refusal, blue/disabled controls, store refusal, every approved ordered SAM combination with TAKE/GIVE, all three product types, Digital/Evening/Daily, four doses, Back/cancel/reset/navigation, independent labels and detached serialized restoration. Range and individual-day suites both run under current/spec wording.

Final-page tests bypass review controls and inject invalid state after review to prove independent Save/Print rejection before prescription API calls. Valid boundary tests capture exact Sinhala `finalInstructionText` and endpoint metadata, then return a simulated failure to avoid a real write. API tests use the existing in-memory FakeSupabase harness. Overflow tests measure deliberately overflowing range headings at the existing font size and prove printing remains blocked.

## Remaining limitations and safeguards

- Physical printer alignment, paper output and actual Sinhala font shaping remain pending device checks. DOM rectangle tests verify overflow rejection, not physical text fit. Font-loading safeguards and 70 × 50 mm dimensions remain unchanged.
- Historical prescription editing and browser-reload draft storage remain existing limitations. JSON editor drafts retain endpoint state and confirmation; old date-tag drafts require explicit correction rather than inferred endpoints.
- The PDF defines no calendar duration or same-day semantics. The user explicitly allowed identical endpoints without inferred duration. The implementation stores/prints weekday endpoints exactly as selected.
- Full API lint remains a pre-existing repository-wide failure; no unrelated auto-fixes or suppressions were applied.
- No schema changes, migrations, production-data modifications, deployment, commit or GitHub push occurred.

**Feature #20 is complete.** Feature #21 and later features have not been implemented.
