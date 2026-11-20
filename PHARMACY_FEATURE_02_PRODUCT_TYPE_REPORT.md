# Feature 02 — Automatic Product Type Selection

Date: 24 October 2026.

**Feature #4 is complete for automatic catalogue selection, per-label state, serialized-draft restoration and the existing label editing workflow. Feature #5 has not started.**

Requirements were checked against page 2 of `C:/Users/Achintha/Downloads/Document 5.pdf` and Feature #4 in `C:/Users/Achintha/Downloads/FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md`.

## Root cause and audit

- Database: `products.product_type` already exists as nullable `TEXT` in `20261010000100_schema_hardening.sql`. No schema change is necessary.
- Product reads: search, barcode and ID endpoints share `toSummary`. It substituted `dosage_form` when `product_type` was absent, masking missing product-type data. A dosage form is not the stored product type.
- Product writes: `ProductInput`, the API DTO/write whitelist and the catalogue form omitted `product_type`; a newly entered type could not pass through the supported create/update path.
- The gap plan's original selection-loss diagnosis is historical: at the start of this task, search and barcode selection already passed `product_type`, and `SelectedProduct` already declared it. `LabelData.product`, `setProduct`, `activeFields` and `selectLabel` already retained the product object. These existing fixes were preserved.
- `ProductSearchResult` did not declare the API's nullable type correctly. The selected-product display had no automatic Sinhala mapping or missing/unsupported-type validation.
- `labelBuilder.ts` retained the product name but discarded the product record from its built output. Catalogue metadata is now retained separately from printed content.
- `PrintableLabel.tsx` uses existing rendering conditions and includes a legacy hardcoded product-type word. It was inspected and left unchanged because replacing that output belongs to Feature #5.

## Implementation

The product record remains the source of truth: `label.product.product_type`. No independent selected-product-type state was added.

| Stored type | Automatic indicator |
| --- | --- |
| Pethi | පෙති |
| Karal | කරල් |
| Packet | පැකට් |

- A shared resolver derives the supported type and Sinhala indicator. It tolerates surrounding whitespace and letter case for display while retaining the original stored value.
- Search and barcode selection share one conversion that retains the stored type. The same conversion accepts product-by-ID responses when reloading a catalogue record.
- The existing product search subtitle displays the selected type automatically and updates as the product or active label changes. There are no product-type selection controls on the label screen.
- Missing, empty and unsupported values produce an explicit warning and no derived Sinhala type. Neither dosage form nor a default Pethi is used.
- The catalogue create/edit dialog now lets staff record the type once on the product. API DTO whitelisting and product writes preserve it. Existing unsupported values remain selectable during catalogue editing so editing another field does not erase them.
- `setProduct` copies the selected product into the active label. Existing label navigation continues to restore each label's own product record.
- `restoreLabel` restores a serialized `LabelData` draft, including its product record and dosage, detaches it from the saved object, and resets pending edit controls. Restoring a legacy draft with no type preserves the missing value and warning.
- Built labels retain a copy of product metadata. Print rendering does not consume this new metadata in this feature.

## Files changed

| File | Change |
| --- | --- |
| `apps/web/lib/productType.ts` | New shared mapping, validation and selected-product conversion |
| `apps/web/app/actions/products.ts` | Nullable result type and product-type input field |
| `apps/web/store/labelStore.ts` | Product ownership and serialized-draft restoration |
| `apps/web/components/ProductSearchInput.tsx` | Shared selection mapping and automatic indicator/warnings |
| `apps/web/components/products/ProductDialog.tsx` | Persist product type on catalogue create/edit |
| `apps/web/lib/labelBuilder.ts` | Preserve product metadata without changing printed content |
| `apps/web/components/ProductTypeSelection.test.tsx` | New selection, navigation, restoration and print-preservation tests |
| `apps/web/components/products/ProductDialog.test.tsx` | New catalogue persistence tests |
| `apps/api/src/products/products.service.ts` | Return stored product type without dosage-form inference |
| `apps/api/src/products/dto/product.dto.ts` | Accept and whitelist product type; local formatting cleanup |
| `apps/api/src/products/product-type.spec.ts` | New API lookup, missing-value and persistence tests |
| `PHARMACY_FEATURE_02_PRODUCT_TYPE_REPORT.md` | This report |

Several files contained existing uncommitted changes before this feature. Their earlier changes were retained; the list above describes this task's edits rather than ownership of the entire working-tree diff.

## Test results

| Verification | Result |
| --- | --- |
| Web `pnpm exec vitest run` | **28 files, 461 tests passed** |
| API product service and product-type Jest suites | **2 suites, 21 tests passed** |
| Web `pnpm exec tsc --noEmit` | Passed |
| API `pnpm exec tsc --noEmit` | Passed |
| Web `pnpm run lint` | Passed, no findings |
| API ESLint on product DTO and new test | Passed |
| Full API ESLint without `--fix` | Failed: **1,064 errors, 63 warnings** |
| Web production build | Passed; generated 27 static pages |
| API build | Passed |
| `git diff --check` | Passed; Windows line-ending notices only |

The touched product service has 36 lint errors. Linting the committed `HEAD` version independently also returns 36 errors; its existing formatting and unsafe-type findings were not remediated under this feature. No rules were suppressed. Full API lint remains a release gate, so this is not a claim of repository-wide lint readiness.

The 18 new web tests cover all three product types, actual search-result selection, barcode lookup, changing and clearing products, missing/unsupported values, label navigation and editing, serialized-draft restoration, legacy drafts, product metadata in built labels, unchanged rendered print text, and catalogue create/edit persistence. Eight new API tests cover all three lookup paths, missing/unsupported types without inference, DTO whitelisting, create/update persistence and preserving the type when editing another field.

The full web suite includes Feature 01 dosage tests, Sinhala wording, STAT, EOD, administration, ENT, Digital Label workflow and print guards. Vitest and the web build required execution outside the sandbox after worker spawning was blocked with `EPERM`.

## Remaining limitations and scope

- The existing prescription/label history screens are read-only. This feature preserves the current review-to-editor state and adds tested restoration of serialized label drafts; it does not introduce a historical-prescription editing screen or automatic browser-reload draft storage. Database history records are not claimed to be round-trippable `LabelData` drafts.
- Historical records with a missing product type remain missing. Staff can correct the catalogue record; no backfill or inferred value was applied.
- Validation is an on-screen warning. Existing save/print conditions and the legacy hardcoded printed product-type text remain unchanged pending explicit approval for Feature #5. The automatic selection indicator must not be treated as confirmation that product-type printing rules are implemented.
- API tests use the existing in-memory database harness. No live database integration, physical printer validation or production data changes were performed.
- No schema changes, migrations, deployment, commit or GitHub push were performed.

Feature #5 requires separate approval before implementation.
