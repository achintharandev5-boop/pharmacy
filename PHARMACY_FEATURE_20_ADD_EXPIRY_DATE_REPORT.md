# Feature #22 (gap analysis), Add Expiry Date

Date: 29 October 2026.

**Status: code complete. Locally verified, including on a real local PostgreSQL. Database (staging) verification pending. Physical printer verification pending. Pharmacist/owner approval pending on three points (§15).**

No remote database was contacted. Nothing was deployed, committed or pushed. No migration was applied, and none is needed. Feature #21's pending migration and its staging status are unchanged. Feature #23 was not started. Earlier uncommitted work was preserved.

## 1. Existing implementation (audit, before any edit)

| # | Question | Finding |
|---|---|---|
| 1 | Already partly implemented? | Yes. There was an `ADD EXP DATE` tile, an expiry card in the bottom bar, an `EXP:` chip, an "EXP DATE" row on the label and an `expiryDate` sent to the API. It did not follow the PDF (see §3). |
| 2 | Where is the expiry stored? | GRN entry (`receive_stock`) writes `product_batches.expiry_date` (DATE). There is also a legacy `products.expiry_date` column, nullable since migration 20261010000100. Saved labels store `prescription_items.expiry_date` (DATE, unambiguous dates only) and `instructions_json.labelExpiryText`. |
| 3 | Medicine or batch? | Batch. `product_batches` has one expiry per (product, batch number). The workstation was reading the legacy medicine field instead. |
| 4 | How is the dispensing batch chosen? | **Legacy mode (default):** it isn't. Stock is deducted from the product total, and batches that are expired, quarantined or undated are just excluded from "available". **Transactional mode** (`create_prescription`, not enabled, waiting for pharmacist approval): earliest expiry first. |
| 5 | Can one label use several batches? | In transactional mode, yes: FEFO splits a quantity across batches. In legacy mode no batch is recorded at all. |
| 6 | How did the frontend get batch data? | It didn't. Only the product search returned `products.expiry_date`. No workstation endpoint returned batches. |
| 7 | Expiry in the label store? | `expiryDate: string \| null` plus the `ADD EXP DATE` code in `additionalInstructions`. No batch identity. |
| 8 | Saved record keeps the printed value? | Yes, as text (`labelExpiryText`), but with no link to a batch. |
| 9 | Field in PrintableLabel? | Yes. Row 4 (3.5 mm) held "DISPENSED BY: SISILA" and "EXP DATE". **With no date it printed `EXP DATE : ___________`.** |
| 10 | Fixed position in the PDF? | "The dedicated expiry-date area … as shown in Picture No. 11." Picture 11 is an image and its text was not available (see §2). The existing row 4 position was kept. |

## 2. Exact PDF requirements

`C:/Users/Achintha/Downloads/Document 5.pdf` and `FEATURE_GAP_AND_IMPLEMENTATION_PLAN.md` were not at the stated paths. Only a Windows "Recent" shortcut to the PDF remains. The gap plan was found in an earlier assistant session's folder, and that session's log held the PDF's extracted text for **pp. 41–43 (Add Expiry Date Button)** and **pp. 53–55 (Label Content Areas → 7. Expiry Date)**. The requirements below are taken word for word from that text:

- "The Expiry Date button is a text-printing option, not a function button." "Available by default … must not be automatically selected."
- On click, "automatically retrieve and print the expiry date already recorded for the relevant product batch during GRN entry." "The user must not need to enter the expiry date manually."
- Rule A: print it "in the dedicated expiry-date area … as shown in Picture No. 11". "The printed expiry date must match the date stored in the system."
- Rule B: when not selected, it "must not be printed", and "the space reserved for the expiry date must be available for printing another applicable instruction".
- "If multiple batches of the same product have different expiry dates, the system must use the expiry date associated with the relevant batch."
- p. 55: "If no expiry date is available for the relevant batch, the system must not print a fabricated or incorrect date." Unused space goes to the medicine instructions.

**What the PDF does not specify:** a date format, the separators, a 2- or 4-digit year, or a Sinhala heading. Picture 11 may show these, but I couldn't see it. The PDF also says the default label is **80 × 50 mm** (p. 52), while the project prints 70 × 50 mm. Your brief requires 70 × 50, so the size was not changed.

## 3. Confirmed gaps (all closed)

1. The expiry came from the legacy medicine record, not the GRN batch.
2. A free-text modal with "1 Month … 2 Years" presets **calculated dates from today**, which is a substitute for the batch expiry.
3. Selecting a medicine **automatically set the expiry** (ProductSearchInput, ProductInfoPopup), so it was effectively pre-selected.
4. With no date the label printed `EXP DATE : ___________`, and no space was reclaimed.
5. No batch identity was stored on the label or the saved record.
6. There was no expiry check at DONE, review, Save or Print, and no revalidation on the server.
7. In transactional mode, nothing stopped a label printing one batch's expiry while units were dispensed from another.

## 4. Files changed

**API**
- `src/inventory/inventory.service.ts`: `getDispensingBatches()`, plus the shared `isDispensableBatch()` (same eligibility as dispensing).
- `src/inventory/inventory.controller.ts`: `GET /inventory/dispensing-batches?productId=` (all roles, UUID-validated).
- `src/prescriptions/dto/create-prescription.dto.ts`: `expiryBatchId` (UUID).
- `src/prescriptions/prescriptions.service.ts`: batch requirement, save-time revalidation, `instructions_json.expiryBatch`, transactional FEFO guard.
- Tests: `src/inventory/inventory.service.spec.ts`, `src/prescriptions/prescriptions.service.spec.ts`, `test/db/workflow.db-spec.ts` (now uses a retrieved batch instead of a typed date). New: `test/db/expiry.db-spec.ts`, `test/db/expiry-transactional.db-spec.ts`.

**Web**
- New `lib/batchExpiry.ts`: types, calendar-date check, and `expiryPrintError()`, the single validation used at every stage.
- `store/labelStore.ts`: `expiryBatch` per label, `setExpiryBatch()`, `clearExpiry()`, and the toggle behaviour. Changing the medicine removes the expiry. Switching labels closes the lookup.
- `components/label/ExpDateModal.tsx`: rewritten as the GRN batch lookup. No date entry outside UI testing mode.
- `components/label/InstructionGrid.tsx`, `BottomActionBar.tsx`, `SelectedInstructionsPanel.tsx`: toggle, blue selected state, faded and locked during STAT, batch shown on the chip.
- `components/ProductSearchInput.tsx`, `components/ProductInfoPopup.tsx`: no more automatic expiry from the medicine record.
- `lib/labelBuilder.ts`: outputs the expiry only when selected. It is kept out of the instruction text.
- `components/PrintableLabel.tsx`: expiry row only when selected. Otherwise 34 mm of instructions.
- `app/label/page.tsx`: DONE, Save and Print checks, and `expiryBatchId` in the payload.
- `components/label/LabelActionPage.tsx`: review blocking, re-check on Save and Print, batch shown.
- `app/actions/inventory.ts`: `getDispensingBatches()`.
- `app/admin/prescriptions/[id]/page.tsx`: the saved batch number appears next to "Expiry on label".
- `app/label/print-check/scenarios.ts`: the dev layout-check page selects Add Expiry Date so its existing sample row still shows.
- Tests: new `lib/batchExpiry.test.ts`, `components/label/AddExpiryDate.test.tsx` and `app/label/expiryFinal.test.tsx`. Updated `store/labelStore.test.ts`, `store/labelStore.buttons.test.ts` and `components/label/Workstation.test.tsx` (the old manual-entry tests). In `Daily`, `DigitalLabel` and `Weekly` tests, the expected instruction height changed from 30.5 to 34 mm on labels without an expiry.

`lib/labelExpiry.ts` (the old free-text checker, uncommitted earlier work) is no longer used by the app. It was kept along with its tests.

## 5. Batch-expiry data flow

GRN (`receive_stock` → `product_batches.expiry_date`) → `GET /inventory/dispensing-batches` (authenticated, scoped to that medicine, dispensable batches only) → the pharmacist's batch (`setExpiryBatch`, refused if it belongs to another medicine) → label state `{expiryBatch, expiryDate}` → label builder (only when selected) → chip, review, 1:1 preview and printed label → `createPrescription {expiryDate, expiryBatchId}` → API re-reads the batch → `prescription_items.expiry_date`, `instructions_json.labelExpiryText` and `instructions_json.expiryBatch {id, batchNumber, expiryDate}`.

The saved record holds the value actually printed. It does not depend on looking up a batch later, and the batch can change after the label is saved without altering the record.

## 6. Batch selection and multiple batches

- **One dispensable batch:** its date is applied as soon as the lookup returns. This is the PDF's "automatically retrieve".
- **Several batches:** a list shows batch number, expiry and quantity, and the pharmacist chooses. Nothing is picked for them, not even the earliest one. This also applies when two batches share a date (see §15).
- **None:** "No dispensable batch with a recorded expiry date (n are expired, quarantined or undated)…". Nothing is added.
- **Eligibility** is the same rule the dispensing paths use: units available, status not QUARANTINED or EXPIRED, expiry recorded and not passed (pharmacy time zone). No new clinical or inventory rule was added. A valid expiry is not treated as proof the medicine is safe to dispense. All existing dispensing safeguards are unchanged.
- **One label, several batches:** a label prints one batch's date. In transactional mode the save is **refused (409 `EXPIRY_BATCH_ALLOCATION_MISMATCH`) before anything is written** in three cases: the FEFO allocation would draw from a different batch, the selected batch would run out part-way, or an earlier label on the same prescription would use it up. In legacy mode stock is deducted per product, so the recorded batch is the pharmacist's declaration. No batch quantity is changed.

## 7. Button behaviour

Available by default and not selected (`aria-pressed=false`). Tap: the lookup opens and, with one batch, closes straight away with the date applied. Selected: solid blue (`bg-primary`) with a check mark, a chip reading `EXP: 2027-08-31 · Batch A-1`, and the bottom card showing the date. Tap again on the tile, the card, or the chip's ✕ removes it. During STAT the tile is replaced by the STAT panel and the card is faded (opacity 40) and inert. Keyboard (Enter) and touch both work. Loading, error with Retry, empty, and wrong-medicine responses each have their own message. Escape and Cancel close the dialog without changes.

## 8. Date format

Printed **exactly as recorded: `YYYY-MM-DD`** (e.g. `EXP DATE : 2027-08-31`). The PDF requires "must match the date stored in the system" and gives no other format. The value is handled as a calendar-date string. It is never turned into a `Date` instant, so no time zone can move it by a day; tests cover 23:30 local time and New Year. Values that are not real dates (e.g. `2027-02-30`, `12/2027`) are never offered or printed. "Has the date passed" uses the local calendar date, and the server checks again in pharmacy time. The heading stays the existing English "EXP DATE" because the PDF text gives no Sinhala heading.

## 9–10. Layout and reclaimed space

| Row (mm) | Expiry selected | Not selected |
|---|---|---|
| Product | 5.0 | 5.0 |
| Patient / brand | 4.5 | 4.5 |
| Instructions | 30.5 | **34.0** |
| Dispensed by / EXP DATE | 3.5 | **not printed** |
| Footer | 6.5 | 6.5 |
| Total | 50.0 | 50.0 |

The label stays 70 × 50 mm. When the row is omitted, its separator line moves onto the instruction box, which is border-box so its height doesn't change. A test checks that the row heights add up to 50 mm. The existing fit guard (`labelFit`) still measures every row and still blocks printing on overflow. Long text is never silently clipped.

## 11. Preview, save and print consistency

The chip, review card, 1:1 preview, print payload and saved record all come from the same label state through `buildFinalInstruction`. Tests confirm that adding the expiry leaves `finalInstructionText`, `instructionString` and the Sinhala lines byte-for-byte identical. That holds for plain, Reasons, weekday, STAT and EOD labels and unequal circled rows. Feature #21's exact saved wording (including trailing spaces) is still preserved; an API test and a PostgreSQL test cover it. Historical reprinting was not implemented.

## 12. Database-free UI testing

No API call is made (the backend stays disabled in this mode). The dialog says "UI testing mode: inventory batches are not loaded. No GRN expiry is available." The tester may type a date in a field labelled "Temporary local test expiry (not a GRN batch, never saved)". It must be YYYY-MM-DD and not in the past. It is marked `(UI test value, not GRN)` on the chip, `(temporary UI test value, not a GRN batch)` on review, and `(test)` on the card. No batch is generated. Print shows a layout preview with the existing "not saved" notice. Outside UI testing mode a test value is refused at every stage. UI test login and production authentication were not changed.

## 13. Authorization and validation

- The new route requires authentication like every other route; the route-protection suite covers missing and forged tokens automatically. It is open to all roles (`ALL_ROLES`) and validates the medicine UUID (400). An unknown medicine returns 404, and a database failure returns 503, never an empty list.
- **Pharmacy scope:** `product_batches` (like all inventory tables) has no pharmacy column. Scope is the same as every existing inventory endpoint. Checking "the batch belongs to the correct pharmacy" therefore cannot be done beyond authentication. No tenancy was added (see §15).
- Every Save/Print request is re-checked by the API before any write. It rejects a date without a batch, or a batch without a date or medicine (`EXPIRY_BATCH_REQUIRED`). It rejects an unknown batch, another medicine's batch, a batch that can no longer be dispensed, or a recorded date different from the printed one (`EXPIRY_BATCH_MISMATCH`, which names the label). Previously accepted free-text expiries are now refused by design.
- `expiryPrintError` runs at **DONE** (it selects the failing label), on the **review** page (Save and Print disabled, reason shown), and again in **final Save** and **final Print** on the latest store state. It refuses: selected but not retrieved; a date left without the selection; another medicine's batch; a batch without an id; a shown date that differs from the batch; an invalid date; a passed date; and a UI-test value outside test mode. A draft restored with a stale batch is caught the same way, and then by the server.

## 14. Test results

Baselines were captured on the unmodified tree first (web 1,763, API 236, matching the earlier report).

| Check | Result |
|---|---|
| Web Vitest (full) | **53 files, 1,834 passed** (baseline 1,763; +71) |
| API Jest (full, runInBand) | **27 suites, 253 passed** (baseline 236; +17) |
| API end-to-end | 2 passed |
| Real local PostgreSQL integration (fresh `initdb` on 127.0.0.1:55422, fresh-only mode, removed afterwards) | **5 suites, 60 passed** (prior 50; +10 new expiry tests, legacy and transactional) |
| Web and API TypeScript | Passed |
| Web ESLint (full) | Passed |
| API ESLint, changed files | Code I added is prettier-clean (ESLint's own fixes applied only inside Feature #22 blocks; existing code left alone). Remaining in Feature #22 code: one `no-unsafe-argument` on a touched line where the argument (`header`) was already `any`, and `no-unsafe-*` from `any`-typed response bodies in tests, the same pattern as the surrounding tests. |
| API ESLint, full (diagnostic, no --fix) | 1,032 errors, 65 warnings (earlier report: 1,036 / 63). Existing debt; not reported as clean. |
| Web and API production builds | Passed |
| `git diff --check` | Passed |

The 35 requested test areas are covered across the new and updated suites. They include: select and deselect; blue and faded states; retrieval; missing batch, missing date and invalid date; time-zone correctness; format; medicine and batch switching; multiple batches; scope and authentication; stale references; draft restore; multi-label independence; Reset, Clear All, number pad and label switching; enabled and disabled preview and reclaimed space; the exact saved value; instruction-text preservation; payload consistency; circled rows and Reasons; the DONE, review, Save and Print guards; changes after review; UI testing mode; and server-unavailable (no fake success). The full suites cover regressions for Features #1–#21 and ENT. In jsdom, the fit of long Sinhala text alongside the expiry is checked by the existing guard tests with mocked measurement. **Real font measurement at 34 vs 30.5 mm and physical printing are not verified.**

**Environment note.** At the start every app dependency link pointed at the old path `Documents/tharun/pharmacy-label`. To get tests running I briefly created a directory junction at that path. You then reinstalled dependencies (01:32), so I removed the junction; it no longer exists. Your `pnpm run dev` servers were running throughout, and Nest's watch mode reloaded these changes.

## 15. Remaining limitations and approvals needed

1. **Picture 11 not seen.** Please confirm the date format, the heading wording ("EXP DATE"), and whether a Sinhala heading is required.
2. **"DISPENSED BY: SISILA" disappears with the expiry row** when Add Expiry Date is off. The row is removed to meet Rule B, and the footer still prints "SISILA CHEMIST". Please approve, or say where it should go.
3. **Same expiry, several batches:** the pharmacist still chooses a batch. Auto-applying a shared date would need an approved rule.
4. Legacy mode does not deduct per batch, so the recorded batch is declared, not enforced. Transactional mode enforces it but still needs the pending pharmacist approval of FEFO.
5. Inventory has no pharmacy tenancy (unchanged).
6. The PDF's 80 × 50 mm default label size versus the project's 70 × 50 mm, unchanged as instructed.
7. The dev-only `/label/print-check` page keeps its existing sample value `12/2027`. It is a layout-check page, not a label.

## 16. Migration requirements

None. The batch reference is stored in the existing `instructions_json` (jsonb), and the existing `expiry_date` DATE column holds the printed date.

## 17. Feature #21

Still **staging verification pending**. Its migration was not applied, and no remote Supabase project was contacted.

## 18. Final status

**Feature #22, Add Expiry Date: code complete; locally verified (unit, component, HTTP and real local PostgreSQL); database (staging) verification pending; physical printer verification pending; pharmacist/owner approvals in §15 (items 1–3) pending.**
