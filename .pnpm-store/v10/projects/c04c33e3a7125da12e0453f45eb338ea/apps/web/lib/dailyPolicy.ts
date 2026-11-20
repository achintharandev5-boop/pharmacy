import { readEnt } from './ent';
import type { DigitalState } from './digitalSchedule';

export const DAILY_TEXT = 'දිනකට';
export type DailyState = DigitalState & { frequencyDosage?: { qty: number } | null };
const CONFLICTS = ['8H', '6H', '5H', 'EVENING', '4H', 'CUSTOM', 'SOS'];
const hasDigital = (label: DailyState) => Object.values(label.dosage ?? {}).some(dose => dose && dose.qty !== 0);

/** Document 5 pp33–34: Daily has its own quantity and excludes intervals/Digital/Evening. */
export function dailySelectionRefusal(label: DailyState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || codes.includes(next)) return null;
  if (codes.includes('DAILY') && [...CONFLICTS, 'DIGITAL'].includes(next)) return 'Remove Daily before choosing an incompatible dosing schedule.';
  if (next === 'DAILY' && (hasDigital(label) || codes.some(code => CONFLICTS.includes(code)))) return 'Remove the existing Digital, interval or Evening schedule before selecting Daily.';
  return null;
}

export function dailyProblem(label: DailyState): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || !codes.includes('DAILY')) return null;
  if (codes.filter(code => code === 'DAILY').length !== 1) return 'Remove the duplicate Daily selection.';
  if (hasDigital(label) || codes.some(code => CONFLICTS.includes(code))) return 'Daily cannot be combined with Digital Label, intervals, Evening or another frequency.';
  if (!Number.isFinite(label.frequencyDosage?.qty) || !(label.frequencyDosage!.qty > 0)) return 'Enter a valid positive Daily quantity.';
  return null;
}
