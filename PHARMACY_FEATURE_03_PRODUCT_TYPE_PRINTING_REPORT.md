# Feature 03 — Product Type Printing Rules

Date: 24 October 2026.

**Feature #5 is complete. Feature #6 and later features have not started.**

Requirements were checked against Feature #5 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` and `Document 5.pdf`, pages 2–3 and 21–24. The referenced Weekly + BD/TDS rule was also checked on page 37; the four-dose comparison rule appears on pages 31–32.

## Root cause and audit

- `PrintableLabel.tsx` printed a literal `පෙති` for every non-ENT frequency quantity, regardless of the selected medicine or frequency. This incorrectly affected Karal/Packet products and type-free workflows such as Daily and Evening.
- The label builder exposed the selected product metadata after Feature 02 but did not use the resolver for printing. Its text preview and rendered frequency row were generated separately.
- Equal-dose BD/TDS patterns remained individual dose badges. Four equal daily quantities were not consolidated into the required product-type instruction.
- The previous validation system did not require a supported product type for product-type-dependent formats.
- The source audit also found `SPEC_UNITS`, an unused literal list of the three Sinhala units in `instructionEngine.ts`. It now derives from `PRODUCT_TYPES`; the existing Feature 02 map is the only production-code mapping of these names.

## Implementation and workflows

`productTypePrinting.ts` is the shared policy for pattern detection, quantity formatting, product-type resolution and product-type validation. It reads `label.product.product_type` through the Feature 02 resolver. There is no second mapping or independent product-type state.

| Workflow | Product-type rule |
| --- | --- |
| 8H, 6H, 5H | Print the selected Sinhala type once before the per-dose quantity and existing interval wording |
| BD | Equal positive Morning and Night quantities, with Lunch empty: one product-type/dose/twice-daily line |
| TDS | Equal positive Morning, Lunch and Night quantities: one product-type/dose/three-times-daily line |
| Four times daily | Equal positive Morning, Lunch, Night and confirmed Evening quantities: one product-type/dose/four-times-daily line |
| STAT + interval | The interval line carries the type; the existing STAT phrase/pill and its own dose remain separate |
| EOD + interval | Preserve EOD as a modifier, then print the interval's product-type line |
| Weekly + BD/TDS | Print type + common quantity + `සතියකට වරක්` + selected administration, as explicitly required by the PDF |
| Unequal scheduled/evening quantities | Preserve the individual quantities; do not invent a common product-type dose |
| STAT/EOD/Daily/Weekly/Evening alone; individual times; USB/SAM alone | Do not inject a product-type word |
| ENT | Preserve existing ENT instructions and units; bypass oral product-type injection and validation |

The explicit request to exclude Evening alone is followed. The broader Evening-alone wording on PDF page 32 was not introduced under this feature.

- The builder generates the product-type line once and includes it in `additionalInstructions`/`instructionString`. The selected-text preview, review, saved `finalInstructionText` and printed card consume that same generated instruction data.
- The print component no longer has a hardcoded tablet word. For consolidated formats it omits the redundant frequency row and, for equal digital schedules, the repeated individual dose badges. Original dose values remain in state and built metadata.
- Interval formatting preserves any independently selected digital dose rows rather than discarding quantities from an existing incompatible selection. Existing workflow validation remains responsible for those combinations.
- EOD is retained when selecting 8H/6H/5H, and vice versa. Interval selection takes precedence when deriving the primary frequency for the saved payload; EOD remains in the instruction list. Other EOD workflows were not redesigned.
- The instruction engine applies the shared product-type validation at DONE. Review shows a label-numbered error and disables Print & Save. The final print action independently rechecks current labels before saving or opening the print dialog.
- Missing/unsupported types produce no fallback Sinhala type. Type-free workflows and ENT are not blocked solely because a product type is missing. Correcting the selected catalogue product restores printing availability.
- Existing USB/SAM/STAT wording modes are retained. Only the dosing formats and placement covered by Feature #5 change. No physical label dimensions or section heights were changed.

## Exact Sinhala output examples

These examples use the existing **spec** administration wording with TAKE + AFTER. The feature does not switch wording mode. Under the existing default **current** wording, the unchanged administration suffix is `කෑමට පසු ගන්න` instead of `ගන්න කෑමට පසු`.

| Selection | Generated instruction |
| --- | --- |
| Pethi + 8H, quantity 1 | පෙති 1 බැගින් පැය 8කට වරක් ගන්න කෑමට පසු |
| Karal + 6H, quantity 1 | කරල් 1 බැගින් පැය 6කට වරක් ගන්න කෑමට පසු |
| Packet + 5H, quantity 1 | පැකට් 1 බැගින් පැය 5කට වරක් ගන්න කෑමට පසු |
| Pethi + BD, quantity 1 | පෙති 1 බැගින් දිනකට 2 වරක් ගන්න කෑමට පසු |
| Karal + TDS, quantity 1 | කරල් 1 බැගින් දිනකට 3 වරක් ගන්න කෑමට පසු |
| Packet + four times daily, quantity 1 | පැකට් 1 බැගින් දිනකට හතර වරක් ගන්න කෑමට පසු |
| Karal + Weekly + BD/TDS, quantity 1 | කරල් 1 සතියකට වරක් ගන්න කෑමට පසු |
| Karal + EOD + 6H, quantity 1 | දිනක් හැර දිනක්, කරල් 1 බැගින් පැය 6කට වරක් ගන්න කෑමට පසු |
| Karal + 6H + Chewable + TAKE + AFTER | කරල් 1 බැගින් පැය 6කට වරක් හපලා කන්න කෑමට පසු |
| Karal + BD, quantity 1½ | කරල් 1½ බැගින් දිනකට 2 වරක් ගන්න කෑමට පසු |

The interval spelling `8කට`/`6කට`/`5කට` preserves existing label wording. Half/quarter glyphs and other ratios, such as `1 1/3`, use the existing Feature 01 formatter.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/productTypePrinting.ts` | New shared printing policy |
| `apps/web/lib/productType.ts` | Document resolver's shared UI/printing role |
| `apps/web/lib/instructionEngine.ts` | Product-type validation, consolidated-pattern notices, units derived from existing map |
| `apps/web/lib/labelBuilder.ts` | Generate consolidated lines, preserve quantities and avoid duplicate schedule/administration lines |
| `apps/web/components/PrintableLabel.tsx` | Remove hardcoded unit; render shared lines without redundant dose rows |
| `apps/web/components/label/SelectedInstructionsPanel.tsx` | Show product-type print validation errors |
| `apps/web/components/label/LabelActionPage.tsx` | Review print guard and label-numbered errors |
| `apps/web/app/label/page.tsx` | Final print-action validation and interval/EOD payload precedence |
| `apps/web/store/labelStore.ts` | Preserve EOD with a permitted interval |
| `apps/web/components/ProductTypePrinting.test.tsx` | 49 new printing/validation tests |
| `apps/web/app/label/page.test.tsx` | 2 new real-page entry-point validation tests |
| `apps/web/components/PrintedInterval.test.tsx` | Update assertions for the required printing formats |
| `apps/web/components/ProductTypeSelection.test.tsx` | Replace Feature 02's temporary print-invariance assertion with dynamic-output checks |
| `apps/web/lib/ownerPhrases.test.ts` | Verify the related consolidated formats and preserve STAT assertions |
| `apps/web/components/label/WorkflowGuide.test.tsx` | Catalogue fixture and updated related TDS expectations |
| `PHARMACY_FEATURE_03_PRODUCT_TYPE_PRINTING_REPORT.md` | This report |

Existing uncommitted work, including Features 01 and 02, was preserved. Several listed files already had changes; this list does not claim ownership of their entire Git diff. No API source files were changed for Feature #5.

## Verification

| Check | Result |
| --- | --- |
| Web Vitest | **30 files, 512 tests passed** |
| Relevant API Jest suites: products service, product type, prescriptions service | **3 suites, 57 tests passed** |
| Web TypeScript | Passed |
| API TypeScript | Passed |
| Web ESLint | Passed, no findings |
| Full API ESLint without `--fix` | Existing failure: **1,064 errors and 63 warnings**, unchanged from Feature 02 |
| Web production build | Passed; generated 27 static pages |
| API build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

New tests cover all nine type/interval combinations, all three types across BD/TDS/four-dose patterns, STAT/EOD combinations, Weekly + BD/TDS, excluded workflows, unequal doses, fractional/mixed quantities including thirds, ENT preservation, missing/unsupported values, correction, multiple medicines, draft restoration, preview/print consistency, 70 × 50 mm dimensions, and DONE/final-action validation. The final-action test bypasses the review button's disabled state and confirms that invalidating a type after review prevents any prescription save.

The full suite retains Feature 01 dosage and Feature 02 selection/persistence regressions. Tests tied to the old printing format were updated to the explicitly requested format; unrelated Sinhala administration assertions remain intact. API failure-path tests deliberately log simulated database errors and still pass; no real database was accessed.

Vitest and the web build ran outside the sandbox after worker spawning was blocked with `EPERM`. The successful results above are the completed reruns.

## Remaining issues and boundaries

- Full API lint remains an unrelated release blocker; this feature does not remediate the API codebase.
- Physical printer alignment, actual Sinhala font rendering and paper output still need device verification. Automated tests check generated text, print-component content, fixed dimensions and application print guards.
- Existing historical-label editing/browser-reload draft-storage limits from Feature 02 remain. Tested draft restoration uses the existing serialized `LabelData` representation.
- Existing numeric storage precision limits from Feature 01 remain; this feature reuses its formatter and does not change the storage/API contract.
- No schema changes, migrations, production-data updates, deployment, commit or GitHub push were performed.

Implementation stops at Feature #5. Further features require separate approval.
