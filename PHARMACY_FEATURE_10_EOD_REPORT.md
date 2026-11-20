# Feature 10 — EOD (Every Other Day)

Date: 24 October 2026.

**Feature #12 is complete. Feature #13 and later features have not started.**

Requirements were checked against the attached Feature 10 request, Feature #12 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`, and `Document 5.pdf`. Primary references: text/order rules on page 13; interval rules on pages 17–21; Digital Label integration on page 24; day/date conflicts on pages 27–28; Evening/Daily availability on pages 32–34; Weekly exclusion on page 37.

## Existing implementation audit

- EOD was included in the store's frequency group, engine quantity codes and builder frequency list. Selecting it opened a quantity pad; printing could incorrectly show a per-dose EOD quantity.
- Feature 03 already generated the correct EOD prefix for consolidated product-type instructions, but accepted either selection order. There was no general text-only EOD output for type-free labels.
- EOD could replace another frequency or be discarded when selecting Daily/Evening. Invalid interval-first, SAM-first, Weekly/day/date and multiple-interval combinations lacked shared EOD validation.
- The existing STAT follow-up selector stored `followUp: EOD` without selecting EOD in the main instruction list. This could leave an English EOD tag rather than the required Sinhala follow-up instruction.
- Existing blue/disabled tile styling, per-label instruction arrays, draft restoration, dosage formatter and shared builder/preview/print data were suitable for reuse.
- The audit covered the engine, store, builder, product-type printing policy, grid/tile, dosage and administration controls, selected panel, review, printable component, final handlers and existing EOD/STAT/USB/SAM tests.

## Confirmed gaps and fixes

- Removed EOD from quantity-bearing frequency lists. EOD-only opens no pad, assumes no quantity/action, and requires no product type or meal timing. Its only generated sentence is `දිනක් හැර දිනක්`.
- Added `eod.ts` as the shared ordering/compatibility policy and single Sinhala EOD phrase source. The engine, grid/store refusal, builder and product-type prefix reuse it; no second product-type mapping or independent EOD selection state was added.
- The grid and direct store actions refuse late EOD selection and unsupported combinations without replacing existing selections. Selected draft options remain removable. Day selection and incompatible digital input also enforce their EOD locks in direct actions.
- Digital dose controls use an existing-layout fieldset for native disabled/faded behavior while an EOD interval is selected. Removing EOD releases only EOD-specific locks and preserves the interval's quantity; EOD cannot then be re-added after that interval.
- EOD remains in state when selecting a permitted Daily/Evening/interval schedule. BD/TDS/four-dose and individual digital rows retain their original quantities and product-type conditions.
- Type-free output gains the EOD phrase once; consolidated output retains the existing product-type prefix format. Invalid EOD drafts generate no printable instruction sentence until corrected.
- STAT → EOD through the existing follow-up selector now selects EOD without opening another quantity pad. STAT's initial quantity remains separate. Redundant English `then EOD` / `THEN EOD` print tags are omitted because the Sinhala EOD instruction is already present. Existing STAT quantity, panels and wording modes were not redesigned.
- DONE uses centralized engine validation. Review disables completed Save and Print with label-numbered errors. Both final callbacks independently validate current state before any API write.
- EOD-only saved payloads have no EOD frequency or frequency quantity. Raw `EOD` remains in instructions and `finalInstructionText` comes from the same builder as preview/print. Generic frequency behavior outside EOD was retained.
- Legacy EOD-only quantities are rejected rather than reinterpreted. Staff can remove/reselect EOD or choose a supported quantity-bearing schedule; stored historical records are not rewritten.

## PDF-grounded compatibility and ordering matrix

The same policy applies in both wording modes. Catalogue/dispensed-product details and cosmetic settings do not count as dosing selections.

| Selection/order | Result | PDF basis |
| --- | --- | --- |
| EOD only | Allowed; text-only, no assumed dose/USB/type/timing | Page 13 |
| EOD → 8H/6H/5H → USB/SAM | Allowed; one interval, original quantity and administration retained | Pages 17–21 |
| EOD → Digital Label, including BD/TDS/individual times | Allowed; existing digital quantities and output rules | Page 24 |
| EOD → confirmed Evening/four-dose digital pattern | Allowed; existing Evening/digital rules | Pages 24, 32–33 |
| EOD → Daily | Allowed; existing Daily quantity and administration | Pages 33–34 |
| EOD → USB/SAM | Allowed under the existing method's required inputs and order; EOD adds no extra administration step | Page 13 and completed SAM rules |
| STAT → EOD → supported follow-up | Allowed; initial STAT dose separate | Pages 13–14, 18–21 |
| New STAT after EOD | Refused; start STAT first; editing an existing STAT remains possible | Page 13's STAT-first procedure |
| Interval/digital dose/Daily/Evening/SAM/USB → EOD | Refused; select EOD before the dosing workflow | Page 13, reinforced on pages 17–20 |
| EOD + Weekly | Refused in both directions | Page 37 |
| EOD + Name of Days / selected weekdays | Refused in both directions | Page 27 |
| EOD + date-range controls | Refused; existing date-control aliases also locked | Page 28 |
| EOD + multiple intervals, or interval mixed with digital/Daily/Evening | Refused; choose one supported dosing mode | Pages 17–24 |
| EOD + 4H/Custom/SOS | Unsupported for this feature; refused rather than inventing a PDF combination | EOD interval specification names 8H/6H/5H; these alternatives are not defined there |
| Invalid restored order/combination or legacy EOD-only quantity | Correctable draft; completed Save and Print blocked | Same rules, applied at validation boundaries |

Daily/Evening pages list EOD as available subject to its existing rules. The explicit page 13 first-selection rule is retained: select EOD first, then Daily/Evening. General availability does not override that ordering requirement.

## Exact Sinhala output examples

EOD-only, both modes:

`දිනක් හැර දිනක්`

Interval examples with the existing Empty Stomach TAKE sentence, identical in both modes:

- `දිනක් හැර දිනක්, පෙති ½ බැගින් පැය 8කට වරක් හිස් බඩ ගන්න`
- `දිනක් හැර දිනක්, කරල් 1½ බැගින් පැය 6කට වරක් හිස් බඩ ගන්න`
- `දිනක් හැර දිනක්, පැකට් ½ බැගින් පැය 5කට වරක් හිස් බඩ ගන්න`

Other examples through existing formats:

- BD: `දිනක් හැර දිනක්, කරල් 1 බැගින් දිනකට 2 වරක් ගන්න කෑමට පසු` (spec).
- TDS: `දිනක් හැර දිනක්, කරල් 1 බැගින් දිනකට 3 වරක් ගන්න කෑමට පසු` (spec).
- With Food: `දිනක් හැර දිනක්, කරල් 1½ බැගින් පැය 6කට වරක් කෑමත් සමඟ ගන්න`.
- Dissolve: `දිනක් හැර දිනක්, කරල් 1½ බැගින් පැය 6කට වරක් දිය කර බොන්න දෙන්න කෑමට පෙර`.
- Keep in Mouth: `දිනක් හැර දිනක්, කරල් 1½ බැගින් පැය 6කට වරක් හිස් බඩ දිව මත තබන්න`.

The EOD phrase itself is identical in both modes. Existing ordinary administration word order remains `කෑමට පසු ගන්න` in current mode and `ගන්න කෑමට පසු` in spec mode. Standalone Chewing retains current `සපලා` versus spec `හපලා`. EOD does not alter these established phrases. Current mode retains the existing STAT pill; spec mode retains the approved `පළමුව පමණක් … ගන්න` phrase and `ඉන්පසු`. No wording-mode switch was introduced.

Type-free digital, Daily and Evening selections remain type-free unless their final pattern already qualifies under Feature 03. Individual dose rows and the separate STAT quantity remain in their existing print areas; the physical label was not redesigned.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/eod.ts` | Shared phrase, ordering, compatibility and restored-state policy |
| `apps/web/lib/instructionEngine.ts` | Remove EOD quantity requirement; DONE and shared final-action validation |
| `apps/web/store/labelStore.ts` | Text-only selection, shared refusal, retained modifier, EOD-specific day/digital/STAT follow-up checks |
| `apps/web/lib/labelBuilder.ts` | Text-only/type-free phrase, no EOD quantity, invalid-state suppression, redundant STAT follow-up tag removal |
| `apps/web/lib/productTypePrinting.ts` | Reuse shared EOD phrase/policy; retain existing product-type formats |
| `apps/web/components/label/InstructionGrid.tsx` | Native EOD/order/conflict locks |
| `apps/web/components/label/DosagePanel.tsx` | Native disabled/faded digital controls for an EOD interval |
| `apps/web/components/label/LabelActionPage.tsx` | Review and callback Save/Print guard |
| `apps/web/components/PrintableLabel.tsx` | Remove obsolete quantity-bearing EOD frequency phrase; dimensions unchanged |
| `apps/web/app/label/page.tsx` | Final Save/Print guard and EOD-only payload handling |
| `apps/web/components/label/Eod.test.tsx` | 90 new tests across both modes |
| `apps/web/app/label/page.test.tsx` | Nine new DONE/final-action/save-payload tests |
| `apps/web/lib/instructionEngine.test.ts` | Remove obsolete EOD quantity-bearing test case |
| `apps/web/components/PrintedInterval.test.tsx` | Remove obsolete EOD per-dose printing case |
| `apps/web/components/label/Workstation.test.tsx` | Remove obsolete EOD quantity-pad case |
| `apps/web/components/ProductTypePrinting.test.tsx` | Enforce EOD-first expectations and quantity-free EOD fixture |
| `PHARMACY_FEATURE_10_EOD_REPORT.md` | This report |

Earlier uncommitted work was preserved. This table describes this feature's edits, not ownership of complete working-tree diffs. No API source or database schema was changed.

## Verification

| Check | Result |
| --- | --- |
| Full web Vitest: `pnpm exec vitest run --maxWorkers=2 --minWorkers=1` | **37 files, 952 tests passed** |
| Relevant API Jest: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing unrelated failure: **1,064 errors, 63 warnings**, unchanged from Feature 09 |
| Web production build | Passed; generated 27 static pages |
| API production build | Passed |
| `git diff --check` | Passed; existing Windows line-ending notices only |

The 99 added tests replace three obsolete EOD quantity cases and cover text-only output, no assumed action/type/dose, all three intervals and product types with half/mixed quantities, USB/SAM integration, digital/BD/TDS/four-dose/Daily/Evening combinations, order, native locks, direct refusal, selected display, invalid/legacy drafts, correction, Back/reset, independent labels/restoration, STAT follow-up separation, ENT units and preview/print/save consistency. Features 01–09 and ENT regressions pass.

Final-action tests bypass disabled review controls and mutate labels after review. Reversed order, Weekly conflicts and EOD-only legacy quantities prevent prescription API calls. Valid Save tests capture exact EOD-only text and interval text, with no EOD frequency/quantity; their simulated failure responses prevent real writes. API tests use the existing in-memory harness and deliberately simulated failures.

Vitest and the web build ran outside the sandbox for worker spawning. Initial focused-test failures from calendar-key casing and accessible-name casing were corrected before the passing full runs. Full API lint was diagnostic only; no unrelated files were auto-fixed and no rules suppressed.

## Remaining limitations and safeguards

- Full API lint remains an unrelated repository-wide release blocker.
- Physical printer alignment, paper output and actual Sinhala font rendering still require device verification. Existing 70 × 50 mm dimensions and print-fit safeguards remain unchanged.
- Legacy snapshots contain an ordered instruction list but no historical tap timestamps for separate dose rows or STAT objects. Restoration validates represented instruction order and combinations; it cannot reconstruct an unrecorded historical click sequence. New UI/direct-store selections enforce ordering without adding an audit-state format.
- Existing broader Daily/Evening/Digital/STAT workflows were reused, not redesigned or claimed to complete their later feature specifications. Historical editing, browser-reload draft-storage and numeric precision limitations remain unchanged.
- No live database integration, schema changes, migrations, production-data modifications, deployment, commit or GitHub push were performed.

Implementation stops at Feature #12. Feature #13 requires separate approval.
