from pathlib import Path
Path('PHARMACY_FEATURE_19_REASONS_REPORT.md').write_text('''# Feature 19 — Reasons (Feature #21)

Date: 25 October 2026.

## Audit before source changes

Checked Document 5.pdf pp38–41 and p54, Feature #21 of the supplied gap plan, and the existing reason panel, store, builder, grid/tile, administration, selected panel, review/final handlers, print component, admin routes and tests.

The PDF makes reasons optional, permits one or multiple statements, and requires exact wording loaded from Admin > Edit Reasons. It does not prescribe a fixed Sinhala catalogue or a joining phrase. Reasons have a designated print area that releases its space when omitted. While selecting reasons, Digital Label and USB/SAM stay locked until at least one reason is confirmed with Enter. Reason management belongs exclusively in Admin; no reasons may be added/edited/deleted in the label page. There are no additional clinical compatibility restrictions in this section. Existing 70 × 50 mm dimensions are preserved as explicitly requested, despite the later PDF's different default-size statement.

Confirmed gaps: ReasonsPanel hardcodes ten options; no Reasons admin page/catalogue API/storage exists in the repository despite the gap plan's claim. Back and Done both persist unconfirmed edits. Digital/USB/SAM can be changed during selection. No duplicate/unknown/restored-reason final validation exists. Printed reasons use separate comma/parenthesis formatting, while saved finalInstructionText omits them. Existing reason strings/arrays, per-label state, print area and fit checks can be reused.

The user declined a server-side JSON catalogue and selected another existing catalogue source, but has not yet identified that source. Catalogue integration/management remains dependent on the source name/path/API contract; no new schema, guessed translations or replacement persistent store will be introduced.
''',encoding='utf-8')
Path('apps/web/lib/reasons.ts').write_text('''/** Exact administrator-configured statements; no clinical interpretation or translation. */
export type ReasonState = {
  reasons?: string[];
  reason?: string | null;
  reasonsConfirmed?: boolean;
  reasonsEditPending?: boolean;
};
export function selectedReasonTexts(label: ReasonState): string[] {
  return label.reasons?.length ? [...label.reasons] : label.reason ? [label.reason] : [];
}
export function reasonValuesProblem(reasons: string[]): string | null {
  if (!Array.isArray(reasons) || reasons.some(r => typeof r !== 'string' || !r.trim() || r.length > 200)) return 'Remove invalid reason values and select the configured statements again.';
  if (reasons.length > 20) return 'Select no more than 20 reason statements.';
  if (new Set(reasons).size !== reasons.length) return 'Remove duplicate reason statements.';
  return null;
}
export function reasonsProblem(label: ReasonState, catalogue: readonly string[] | null | undefined): string | null {
  if (label.reasonsEditPending) return 'Confirm at least one reason with Enter, or cancel Reasons.';
  const reasons = selectedReasonTexts(label);
  if (!reasons.length) return null;
  const problem = reasonValuesProblem(reasons);
  if (problem) return problem;
  if (!catalogue) return 'Load the configured reason catalogue before completing this label.';
  if (reasons.some(r => !catalogue.includes(r))) return 'Remove unavailable reasons and select the current configured statements.';
  if (label.reasonsConfirmed !== true) return 'Review the selected reasons and confirm with Enter.';
  return null;
}
const ADMINISTRATION = ['TAKE', 'GIVE', 'BEFORE', 'AFTER', 'WITH FOOD', 'EMPTY STOMACH', 'CHEWABLE', 'DISSOLVE AND DRINK', 'KEEP IN MOUTH', 'ENT'];
export function reasonSelectionRefusal(label: ReasonState, next: string): string | null {
  return label.reasonsEditPending && (next === 'DIGITAL' || ADMINISTRATION.includes(next)) ? 'Confirm Reasons with Enter, or cancel, before changing Digital Label or administration.' : null;
}
/** Separate statements on separate lines: preserve wording without inventing conjunctions. */
export function formattedReasons(label: ReasonState): string[] {
  const values = selectedReasonTexts(label);
  return reasonValuesProblem(values) ? [] : values;
}
''',encoding='utf-8')
