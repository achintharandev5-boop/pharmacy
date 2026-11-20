# Feature 01 — Dosage Quantity Controls

Implemented 24 October 2026 against pages 1–2 of `C:/Users/Achintha/Downloads/Document 5.pdf`. Product-type selection and printing rules later on page 2 are outside this dosage-control feature.

## Changes

- Plus preserves the existing fraction; Minus subtracts one whole unit while preserving the remainder and clamps the result at zero. This replaces the earlier rule that discarded fractions.
- Scheduled, STAT and frequency dosage actions share integer-numerator stepping while retaining the existing numeric state/API contract.
- X/Y opens the existing Number Pad. Quick fractions now select a pending value, turn blue and wait for Enter. Scheduled dose and X/Y previews update while entering the fraction. Enter commits and restores the Function Pad; STAT returns to its existing STAT panel to preserve its administration safeguards. Back cancels pending input.
- One formatter serves scheduled dosage, STAT, selection chips and label building. Common fractions retain the existing glyphs (½, ¼, ¾); other fractions such as 1/3 display as ratios instead of rounded decimals.
- Selected step buttons and instruction tiles turn blue. Existing native disabled states and faded styling remain active.
- The existing selection panel now includes scheduled quantities alongside its existing instruction, administration, STAT and frequency selections.
- Existing Sinhala medical wording, API, database and print layout were preserved.

## Files changed by this feature

All paths below are relative to `apps/web/`:

- `store/labelStore.ts`
- `lib/dosageQuantity.ts` (new)
- `lib/labelBuilder.ts`
- `lib/dosageControls.test.ts`
- `components/NumberPad.tsx`
- `components/StatPanel.tsx`
- `components/DosageRow.test.tsx`
- `components/label/DosagePanel.tsx`
- `components/label/SelectedInstructionsPanel.tsx`
- `components/label/InstructionTile.tsx`
- `components/label/Workstation.test.tsx`
- `components/label/WorkflowGuide.test.tsx`
- `components/label/DosageQuantityControls.test.tsx` (new)

Many of these files already contained uncommitted work; this list describes this feature's edits, not ownership of their entire Git diff. This report is also new.

## Verification

- `pnpm exec vitest run`: **26 files, 443 tests passed**.
- New tests exercise repeated Plus/Minus clicks, disabled Minus at zero, fraction preview before Enter, confirmation and pad restoration, cancellation, selection display, mixed-quantity preview and rendered `LabelCard` output, repeated stepping with thirds, and STAT/frequency quantity preservation.
- Existing Sinhala wording, label switching, clinical workflow and print guard tests pass.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint`: passed with no findings.
- `pnpm run build`: passed; generated all 27 static pages.
- `git diff --check`: passed; existing Windows line-ending notices only.
- Vitest and the production build required running outside the sandbox because worker spawning was initially blocked with `EPERM`.

## Remaining verification and limits

- Printed component content was checked automatically; physical printer output, paper alignment and browser print dialogs still need manual verification.
- No live API/database integration or production data was used. No deployment, migration, commit or push was performed.
- The existing numeric storage/API representation is retained. Integer-numerator stepping and rational formatting prevent drift for the tested ordinary dosage fractions, including thirds, but do not provide arbitrary-precision storage for fractions beyond JavaScript number precision.
- Existing unrelated API lint remediation remains outside this feature.
