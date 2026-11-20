/** Exact administrator-configured statements; no clinical interpretation or translation. */
export type ReasonState = {
  reasons?: string[];
  reason?: string | null;
  reasonsConfirmed?: boolean;
  reasonsEditPending?: boolean;
};
export function selectedReasonTexts(label: ReasonState): string[] {
  return Array.isArray(label.reasons) && label.reasons.length ? [...label.reasons] : label.reason ? [label.reason] : [];
}
export function reasonValuesProblem(reasons: string[]): string | null {
  if (!Array.isArray(reasons) || reasons.some(r => typeof r !== 'string' || !r.trim() || r.length > 200)) return 'Remove invalid reason values and select the configured statements again.';
  if (reasons.length > 20) return 'Select no more than 20 reason statements.';
  if (new Set(reasons).size !== reasons.length) return 'Remove duplicate reason statements.';
  return null;
}
export function reasonStateProblem(label: ReasonState): string | null {
  if (label.reasons != null && !Array.isArray(label.reasons)) return 'Remove invalid restored reason values.';
  if (label.reasonsEditPending) return 'Confirm at least one reason with Enter, or cancel Reasons.';
  const reasons = selectedReasonTexts(label);
  if (!reasons.length) return null;
  const problem = reasonValuesProblem(reasons);
  if (problem) return problem;
  return label.reasonsConfirmed === true ? null : 'Review the selected reasons and confirm with Enter.';
}
export function reasonsProblem(label: ReasonState, catalogue: readonly string[] | null | undefined): string | null {
  const problem = reasonStateProblem(label);
  if (problem) return problem;
  const reasons = selectedReasonTexts(label);
  if (!reasons.length) return null;
  if (!catalogue) return 'Load the configured reason catalogue before completing this label.';
  return reasons.some(r => !catalogue.includes(r)) ? 'Remove unavailable reasons and select the current configured statements.' : null;
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
