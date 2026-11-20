/** Document 5, pages 17–20 and 27: remove an interval before choosing another schedule. */
import { readEnt } from './ent';
export const INTERVAL_CODES = ['8H', '6H', '5H'];
type Dose = { qty: number };
export type IntervalState = {
  additionalInstructions?: string[];
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', Dose>> | null;
  frequencyDosage?: Dose | null;
  selectedDaysOfWeek?: string[];
  stat?: Dose | null;
};
const OTHER_SCHEDULES = ['DAILY', 'EVENING', 'WEEKLY', '4H', 'CUSTOM', 'SOS'];
const DAY_CONTROLS = ['NAME OF DAYS', 'TILL DATE', 'TILL TO DAY', 'AND THIS DATE'];
const hasRows = (label: IntervalState) => Object.values(label.dosage ?? {}).some(d => d && d.qty !== 0);

export function intervalSelectionRefusal(label: IntervalState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes)) return null; // ENT retains its existing frequency editor and replacement behavior.
  if (codes.includes(next)) return null; // Invalid restored selections must remain removable.
  if (next === 'STAT' && label.stat) return null; // Editing a preceding confirmed initial dose remains valid.
  const interval = codes.find(i => INTERVAL_CODES.includes(i));
  if (interval && next === 'EOD') return 'Select EOD first, before the dosing schedule and administration method. STAT may come first.';
  if (interval && next === 'STAT') return 'Select STAT before the regular dosing workflow.';
  if (interval && [...INTERVAL_CODES, ...OTHER_SCHEDULES, ...DAY_CONTROLS, 'DIGITAL', 'STAT', 'EOD'].includes(next)) {
    return 'Remove the selected interval before choosing another dosing mode. STAT or EOD must be selected first.';
  }
  if (INTERVAL_CODES.includes(next) && (hasRows(label) || label.selectedDaysOfWeek?.length || codes.some(i => [...OTHER_SCHEDULES, ...DAY_CONTROLS].includes(i)))) {
    return 'An interval cannot be combined with Digital Label, Daily, Evening, Weekly or selected-day schedules. Remove the existing schedule first.';
  }
  return null;
}

export function intervalProblem(label: IntervalState): string | null {
  const codes = label.additionalInstructions ?? [];
  const intervals = codes.filter(i => INTERVAL_CODES.includes(i));
  if (!intervals.length) return null;
  if (intervals.length !== 1) return 'Choose exactly one dosing interval.';
  if (hasRows(label) || label.selectedDaysOfWeek?.length || codes.some(i => [...OTHER_SCHEDULES, ...DAY_CONTROLS].includes(i))) {
    return 'An interval cannot be combined with Digital Label, Daily, Evening, Weekly or selected-day schedules.';
  }
  const quantity = label.frequencyDosage?.qty;
  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return 'Enter a valid positive interval quantity.';
  return null;
}
