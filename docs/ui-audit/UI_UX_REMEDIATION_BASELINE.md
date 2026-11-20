# UI/UX Remediation — Phase 0 Baseline

**Recorded:** 2026-10-29, before any remediation edit
**Source of truth:** `PHARMACY_LABEL_WORKSTATION_UI_UX_AUDIT.md` (ENT relocation + audit)
**Visual baseline:** `docs/ui-audit/label-workstation/*.png` (captured after the ENT move, before remediation)

## 1. Repository state

| Item | Value |
|---|---|
| Branch | `codex/phase1-safety-fixes` |
| HEAD | `e3c15e4` (docs: implementation status report…) |
| Working tree | 256 entries: 82 modified, 1 deleted (`apps/web/middleware.ts`), 173 untracked |
| Workstation files already modified before this work | `app/globals.css`, `app/label/{page,DaysOfWeekPanel,ReasonsPanel}.tsx`, `components/label/{BottomActionBar,DeleteLabelModal,DosagePanel,ExpDateModal,InstructionGrid,LabelActionPage,LabelActions,ProductToolbar,SelectedInstructionsPanel}.tsx`, `StatWorkstation.test.tsx` |
| Workstation files untracked (new on this branch) | `InstructionTile.tsx`, `ActionWorkspace.tsx`, `ActionQuantityPanel.tsx`, `CompactQuantityEditor.tsx`, `DaysPanel.tsx`, `EntPanel.tsx` and most `components/label/*.test.tsx` |

None of this work is reverted or overwritten. Remediation edits are made on top of it, so `git diff` on these files mixes earlier branch work with remediation. The remediation report lists the remediation edits explicitly.

## 2. Baseline verification

| Check | Command (in `apps/web`) | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p .` | Pass (exit 0) |
| Lint | `npx eslint .` | Pass (exit 0, no warnings) |
| Tests, default 5 s timeout | `npx vitest run` | **57 failed / 1913 passed (11 files failed)**: 48 `Test timed out in 5000ms` plus their cascades. Run took 217 s (56 s in the previous session) |
| Tests, 30 s timeout | `npx vitest run --testTimeout=30000` | **Pass: 59 files, 1970 / 1970 tests** (160 s) |
| Known console noise | jsdom `Not implemented: navigation (except hash changes)` | Pre-existing; not a failure |

**Interpretation:** the default-timeout failures are environmental. The machine is under load (a `next dev` server and about 10 Node processes running), and every failure is a timeout in a long, user-event-driven workstation test. With a 30 s per-test timeout the suite is fully green. All remediation verification uses `--testTimeout=30000` and states so. No test file was changed to obtain this baseline.

Historical figures from the audit (1970 tests, 59 files, clean tsc/lint/build/diff-check) are confirmed, with the timeout caveat.

## 3. Audit finding → component mapping

| Audit # | Priority | Finding | Component(s) | Planned approach |
|---|---|---|---|---|
| 1 | P1 | Locked tiles explain themselves only via `title` | `components/label/InstructionTile.tsx` (`GridTile`, `ActionTile`), `InstructionGrid.tsx` (`decorate`, Days/Name of Days/EXP/STAT-flow rules), `LabelActions.tsx` (GIVE/TAKE/BEFORE/AFTER/ENT), `EntPanel.tsx` | `aria-disabled` (focusable, tappable) + guarded click that shows the existing refusal text in a `role="status"` line; `aria-describedby`; lock glyph. Eligibility functions unchanged |
| 2 | P1 | Dosage Schedule disabled silently | `DosagePanel.tsx` | Same refusal chain → visible reason in the header + `role="status"` |
| 3 | P1 | BEFORE 3.35, AFTER 3.15, tile detail 3.64 contrast | `LabelActions.tsx` `BUTTONS`, `InstructionTile.tsx` detail | Neutral/token text colours ≥ 4.5:1; measured |
| 4 | P1 | Expiry card: nested interactive controls, batch chooser `tabIndex=-1` | `BottomActionBar.tsx` | Two sibling `<button>`s with the existing names and behaviour |
| 5 | P1 | Label text preview truncated to one line | `SelectedInstructionsPanel.tsx` | 2-line clamp + Show full text toggle; Sinhala font + `lang` |
| 6 | P1 | No layout below 1024 px | `app/label/page.tsx`, `ProductToolbar.tsx`, `BottomActionBar.tsx`, `InstructionGrid.tsx`, `ActionWorkspace.tsx`, `DosagePanel.tsx` | Stacked, scrollable layout below `lg`; 4-column grid on phones; sticky DONE |
| 7 | P2 | Selected-state colours inconsistent; unused `SELECTED` variants | `InstructionTile.tsx`, `InstructionGrid.tsx`, `SelectedInstructionsPanel.tsx` | One shared category map (tile idle icon = selected tint = chip); check badge + 2 px border + `aria-pressed` |
| 8 | P2 | Duplicate controls (EXP; Evening/Weekly/Daily confirm) | `InstructionGrid.tsx`, `BottomActionBar.tsx`, `LabelActions.tsx` | Assess each; keep where it is the only recovery path; document |
| 9 | P2 | Admin idle hues meaningless (green AFTER) | `LabelActions.tsx` | Neutral idle style |
| 10 | P2 | Small type, no large-screen scaling | `InstructionTile.tsx`, headings in `SelectedInstructionsPanel`, `DosagePanel`, `LabelActions`, `EntPanel` | 13–14 px labels, 2xl scaling, equal 16 px peer headings |
| 11 | P2 | Delete Label as heavy as Add Label, adjacent | `InstructionGrid.tsx` / `ActionTile` | Outline danger style; **position unchanged** (5×4 preserved) |
| 12 | P2 | Sinhala preview not in print font; no `lang` | `SelectedInstructionsPanel.tsx`, `ReasonsPanel.tsx`, `DaysOfWeekPanel.tsx` | `.sinhala-text`, `lang="si"` |
| 13 | P2 | Whitespace at 1920 | `InstructionTile.tsx` | Larger icon/text at `2xl` |
| 14 | P2 | Chip colour by label substring | `SelectedInstructionsPanel.tsx` | Key by instruction code |
| 15 | P2 | ENT panel heading style differs | `EntPanel.tsx` | Align heading |
| 16 | P2 | No `aria-expanded` on panel-opening tiles | `InstructionGrid.tsx` | Set `expanded`/`controls` |
| 17 | P3 | Hard-coded hex colours | `InstructionGrid.tsx`, `LabelActions.tsx`, `SelectedInstructionsPanel.tsx` | Tokens in `globals.css` |
| 18 | P3 | Runtime Google Fonts | `globals.css`, `PrintableLabel.tsx` | **Not in scope:** would need network font downloads and touches print CSS; documented |
| 19 | P3 | UI-test banner adds 25 px overflow | `app/label/page.tsx` | Size `<main>` to the space under the banner |
| 20 | P3 | Dev indicator overlaps DONE | `next.config.ts` | Move indicator (dev only) |
| 21 | P3 | `select-none` blocks copying label text | `SelectedInstructionsPanel.tsx` | `select-text` on preview |
| 22 | P3 | Remove Address ↔ Address Hidden label swap | `InstructionGrid.tsx` | **Kept**: tests and existing user expectations rely on the state label; documented |

## 4. Implementation checklist

- [x] Phase 1: P1 #1–#5 (+ verification, a11y regression tests). Gate: 1979/1979
- [x] Phase 2: P2 #7, #9, #10, #12–#17 (selected/state system, tokens)
- [x] Phase 3: P2 #8 navigation decisions (kept, documented); ENT verification
- [~] Phase 4: P1 #6 responsive; seven-viewport capture. **Toolbar blocked** by a parallel session's edits
- [x] Phase 5: P3 #19, #21, typography polish (#18, #20 left open by decision)
- [x] Phase 6: full suite, build, diff-check (see remediation report §11)
- [x] Phase 7: re-score; audit updated; `PHARMACY_LABEL_WORKSTATION_UI_UX_REMEDIATION_REPORT.md`

## 5. Clinical safeguards (unchanged by design)

No edits to `lib/**` policy and wording modules, `store/labelStore.ts` actions, `instructionEngine.ts`, `PrintableLabel.tsx` print CSS, `LabelActionPage.tsx` print/save flows, the backend or the database. Every eligibility decision continues to come from the existing `*SelectionRefusal` functions; the UI only changes how their result is presented.
