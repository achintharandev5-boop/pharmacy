import { readEnt } from './ent';
import type { DigitalState } from './digitalSchedule';

export const WEEKLY_TEXT = 'සතියකට වරක්';
export type WeeklyState = DigitalState & {
  weeklyDosage?: { qty: number; isFraction?: boolean; confirmed?: boolean } | null;
};
const CONFLICTS = ['8H', '6H', '5H', 'EOD', '4H', 'CUSTOM', 'SOS'];
const SUBSEQUENT = ['DIGITAL', 'DAILY', 'EVENING'];
const hasDigital = (label: WeeklyState) => Object.values(label.dosage ?? {}).some(dose => dose && dose.qty !== 0);
const ready = (label: WeeklyState) => Number.isFinite(label.weeklyDosage?.qty) && (label.weeklyDosage?.qty ?? 0) > 0 && label.weeklyDosage?.confirmed === true;

/** Document 5 pp35–38: Weekly quantity, then Done before a subsequent schedule. */
export function weeklySelectionRefusal(label: WeeklyState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || codes.includes(next)) return null;
  // EOD's existing policy supplies its established first-selection message.
  if (next === 'EOD') return null;
  if (codes.includes('WEEKLY') && CONFLICTS.includes(next)) return 'Remove Weekly before selecting an incompatible frequency.';
  if (codes.includes('WEEKLY') && SUBSEQUENT.includes(next) && !ready(label)) return 'Enter the Weekly quantity and select Done - Weekly before choosing another schedule.';
  if (next === 'WEEKLY' && (hasDigital(label) || codes.some(code => [...CONFLICTS, 'DAILY', 'EVENING'].includes(code)))) return 'Select Weekly before Digital Label, Daily or Evening; remove the existing schedule first.';
  return null;
}

export function weeklyProblem(label: WeeklyState): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || !codes.includes('WEEKLY')) return null;
  if (codes.filter(code => code === 'WEEKLY').length !== 1) return 'Remove the duplicate Weekly selection.';
  if (codes.some(code => CONFLICTS.includes(code))) return 'Weekly cannot be combined with EOD or an interval frequency.';
  if (!Number.isFinite(label.weeklyDosage?.qty) || !((label.weeklyDosage?.qty ?? 0) > 0)) return 'Enter a valid positive Weekly quantity.';
  const following = codes.filter(code => ['DAILY', 'EVENING'].includes(code));
  if (following.some(code => codes.indexOf(code) < codes.indexOf('WEEKLY'))) return 'Select Weekly before the subsequent schedule.';
  if ((hasDigital(label) || following.length) && !ready(label)) return 'Confirm the Weekly quantity with Done - Weekly before the subsequent schedule.';
  return null;
}
