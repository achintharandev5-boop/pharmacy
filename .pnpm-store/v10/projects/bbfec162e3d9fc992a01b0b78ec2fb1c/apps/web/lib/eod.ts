/** Document 5: text-only EOD (p13), interval order (p17–20), Digital (p24), conflicts (p27–28,37). */
export const EOD_TEXT = 'දිනක් හැර දිනක්';
type Dose = { qty: number };
export type EodState = {
  additionalInstructions?: string[];
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', Dose>> | null;
  frequencyDosage?: Dose | null;
  selectedDaysOfWeek?: string[];
  stat?: { qty: number } | null;
};
const COSMETIC = ['STAT', 'REMOVE ADDRESS', 'ADD EXP DATE', 'REASONS'];
const CONFLICTS = ['WEEKLY', 'TILL DATE', 'TILL TO DAY', 'AND THIS DATE', '4H', 'CUSTOM', 'SOS'];
const INTERVALS = ['8H', '6H', '5H'];
const QUANTITY_SCHEDULES = [...INTERVALS, 'DAILY', 'EVENING'];
const hasRows = (label: EodState) => Object.values(label.dosage ?? {}).some(d => d && d.qty > 0);

export function eodProblem(label: EodState): string | null {
  const codes = label.additionalInstructions ?? [];
  const index = codes.indexOf('EOD');
  if (index < 0) return null;
  if (label.stat && !(label.stat.qty > 0)) return 'Confirm the STAT quantity before the EOD follow-up.';
  if (codes.filter(i => i === 'EOD').length > 1) return 'Remove the duplicate EOD selection.';
  if (codes.slice(0, index).some(i => !COSMETIC.includes(i))) return 'Select EOD before the dosing schedule and administration method (STAT may come first).';
  if (codes.some(i => CONFLICTS.includes(i)) || label.selectedDaysOfWeek?.length) return 'EOD cannot be combined with Weekly, selected days, date ranges or unsupported frequency modes.';
  if (codes.filter(i => INTERVALS.includes(i)).length > 1) return 'Choose one interval after EOD.';
  if (codes.some(i => INTERVALS.includes(i)) && (hasRows(label) || codes.includes('DAILY') || codes.includes('EVENING'))) return 'Choose either an EOD interval or an EOD Digital/Daily/Evening schedule.';
  if ((label.frequencyDosage?.qty ?? 0) > 0 && !codes.some(i => QUANTITY_SCHEDULES.includes(i))) return 'EOD has no quantity. Clear the legacy EOD quantity or select a supported quantity-bearing schedule.';
  return null;
}

export function eodSelectionRefusal(label: EodState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (codes.includes(next)) return null; // Existing invalid draft selections remain removable.
  if (next === 'EOD') {
    if (label.selectedDaysOfWeek?.length || hasRows(label) || codes.some(i => !COSMETIC.includes(i))) return 'Select EOD first, before the dosing schedule and administration method. STAT may come first.';
    return null;
  }
  if (!codes.includes('EOD')) return null;
  if (CONFLICTS.includes(next) || next === 'NAME OF DAYS') return 'This option is locked while EOD is selected.';
  if (next === 'STAT' && !label.stat) return 'Select STAT before EOD to combine them.';
  const interval = codes.find(i => INTERVALS.includes(i));
  if (interval && (INTERVALS.includes(next) || ['DAILY', 'EVENING', 'DIGITAL'].includes(next))) return 'The EOD interval is selected; remove it before choosing another dosing mode.';
  if (INTERVALS.includes(next) && (hasRows(label) || codes.includes('DAILY') || codes.includes('EVENING'))) return 'EOD Digital/Daily/Evening cannot be combined with an interval.';
  return null;
}
