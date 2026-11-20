# Label Workflow Test Report

Updated 2026-10-11 (P3 implementation) · Branch `feature/ui-ux-redesign` (uncommitted). The spec-wording switch (`NEXT_PUBLIC_LABEL_WORDING=spec`) was **not** enabled in the app's configuration; spec wording was tested only in a scratch copy. Nothing was pushed, deployed or sent to Supabase.

## Summary (final run, on the finished code)

| Check | How | Result |
|---|---|---|
| Web unit and component tests (Vitest, React Testing Library) | `cd apps/web && npx vitest run` | **332 / 332**, 18 files |
| TypeScript | `npx tsc --noEmit` in `apps/web` | Clean |
| ESLint, changed files | `npx eslint …` | No new findings. The three `any` parameters `PrintableLabel.tsx` already had remain |
| Printed label check: 14 prescriptions × 2 wordings, clipping, "…", sizes, STAT once, print copy, PDF | `e2e/print-check.e2e.mjs` on `/label/print-check` | **150 / 150** |
| Print guard in the real workstation | `e2e/print-guard.e2e.mjs`, default and spec | **6 / 6** each |
| Workstation, today's wording, desktop 1366×768 mouse + tablet 1024×768 touch | `e2e/workstation.e2e.mjs` | **106 / 106** |
| Workstation, spec wording, same sizes | `e2e/workstation.spec.e2e.mjs` | **48 / 48** (one earlier run gave 47/48: a tablet tap timing miss in the on-screen sentence preview, not the printed label; the immediate re-run and the final run passed) |
| Browser + **real API** + test database: save, print, multi-label, PDF, overflow batch, long brand | `e2e/save-and-print.e2e.mjs` | **18 / 18** |
| **Physical printer** | — | **Not tested** (B6) |

## Test environment

- **Your dev server (:3002)** was used only for read-only runs (label check page, default-wording workstation and print guard). Its `.env` points at a remote API, so nothing was saved or printed there.
- **Your API on :3001** (`apps/api/dist/main`) was running and was **not used or touched**.
- **Save-and-print and spec-wording runs** used a disposable local stack: PostgreSQL 18 in the scratchpad (port 54331, all migrations), the real NestJS API from its test harness on **:3041** (`LOCAL_API_PORT=3041 … test/db/serve-local.ts`), and scratch copies of the web app pointed at it (today's wording on :3014, spec wording on :3013, `next dev --webpack`).
- **Print capture:** `window.print()` is intercepted, the exact document sent to print is recorded, and Edge's print engine renders it to PDF.

## Verified

| Requirement | Result |
|---|---|
| No clipped text | Every one of 28 label/wording combinations either prints with nothing cut (checked on every text element of every row) or is blocked by the guard with a reason. None is clipped silently |
| No "…" | No text is shortened with "…" anywhere on the label |
| No missing clinical information | Dose row, Sinhala lines, reasons, days, weekdays, STAT and tags all inside the 30.5 mm area for every printable label; the guard blocks the rest |
| Correct size | Every label 70 × 50 mm on screen; instruction area 30.5 mm (115.3 px) on every label |
| No blank pages | 14 labels → 14 pages (both wordings); 3 labels via Print & Save → 3 pages |
| Print dimensions | 198 × 142.08 pt = 69.85 × 50.12 mm (Chromium rounds to whole points; unchanged from before) |
| Print copy fitted like the preview | The hidden print copy's names are fitted (none "unmeasured") and match the preview exactly; in the captured print document all names are fitted |
| No duplicate STAT | STAT quantity printed at most once on every label; spec STAT labels (S4–S6) use Option B with no pill; today's wording never uses Option B |
| Sinhala fonts | Gemunu Libre and Noto Sans Sinhala loaded before measuring. The review preview now uses Gemunu Libre on both the Turbopack (:3002) and webpack (:3014) servers; before this change the webpack build fell back to Noto Sans Sinhala on the preview only. Lines at 1.25 line height read at 3× zoom: no touching, vowel signs complete |
| Prescription saving | Save without printing: one prescription, two items, quantities, STAT 2 → 8H and the generated Sinhala stored; nothing printed. Print & Save: saved first, one print, events CREATED, PRINTED. Overflowing batch: Print & Save refused (a forced click saves and prints nothing), Save without printing still saves |
| Overflow protection | Instruction overflow, long medicine name, long brand name and long patient name each block Print & Save with the field named; removing instructions re-enables it |
| Desktop and tablet | Workstation 1366×768 and 1024×768 touch; review page screenshots at both (`workflow-audit/print-p3/review-*.png`) |

## Printed label results

Instruction area content / 115.3 px (limit 113.3). Full table and before values: `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §2.

| Label | Today's wording | Spec wording |
|---|---|---|
| Simple, M/L/N, + reason, interval, fractions (S1–S3, S8, S9) | 41–73, prints | 41–90, prints |
| STAT with doses (S4) / Morning + STAT (S5) / STAT alone (S6) | 59 / 59 / 35, prints | 91 / 73 / 35, prints (Option B) |
| Busy (S7) | **107, prints** (was blocked) | 124, blocked |
| Multiple instructions, long reasons (S10) | 102, prints (was blocked) | 102, prints |
| Long names + brand (S11) | Blocked: patient name too long (brand now in full) | same |
| Everything (S12) | 149, blocked | 163, blocked |
| 95-character medicine name (S13) | Blocked: medicine name too long | same |
| 51-character patient name (S14) | Prints, name on two lines | same |

## Tests added or changed in this pass

| File | Change |
|---|---|
| `lib/labelFit.test.ts` | +5: a fitting label passes; a name that does not fit is named; text past a row's side is detected; instruction overflow reported once; indexes |
| `lib/labelBuilder.test.ts` | +5: Option B data keeps the quantity, fraction and follow-up; never set with today's wording; not set for GIVE, TAKE + BEFORE, TAKE + AFTER |
| `components/label/ReviewPrintGuard.test.tsx` | Uses the reason report; the message names the field |
| `components/PrintedInterval.test.tsx` | Spec STAT label: quantity inside the phrase, once; no pill; follow-up kept; order unchanged |
| `e2e/print-check.e2e.mjs` | New (replaces the prototype script) |
| `e2e/print-guard.e2e.mjs` | Busy label now prints in today's wording; a five-reason, every-weekday label must be blocked with the reason named |
| `e2e/save-and-print.e2e.mjs` | Overflow batch uses a label that overflows P3; names in the printed document fitted; long brand blocked and named |

## Not verified

- **Physical printing.** Checklist: `PRINT_LAYOUT_AND_STAT_OPTIONS.md` §8.
- Production build (`next build`) was not run; the development-only page is excluded by `notFound()` in production.
