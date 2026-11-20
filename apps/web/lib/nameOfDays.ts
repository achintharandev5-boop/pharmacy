import type { DigitalState } from './digitalSchedule';
import { readEnt } from './ent';

export const DAY_NAMES: Record<string, string> = {
  MONDAY: 'සඳුදා', TUESDAY: 'අඟහරුවාදා', WEDNESDAY: 'බදාදා',
  THURSDAY: 'බ්‍රහස්පතින්දා', FRIDAY: 'සිකුරාදා', SATURDAY: 'සෙනසුරාදා', SUNDAY: 'ඉරිදා',
};
export type WeekdayRange = { start: string | null; end: string | null; confirmed: boolean };
export type DayState = DigitalState & { selectedDaysOfWeek?: string[]; daysConfirmed?: boolean; weekdayRange?: WeekdayRange | null; stat?: { qty: number } | null };
const CONFLICTS = ['8H', '6H', '5H', 'EOD', 'WEEKLY', '4H', 'CUSTOM', 'SOS', 'BD', 'TDS', 'TILL TO DAY', 'AND THIS DATE'];
const hasSchedule = (label: DayState) => Object.values(label.dosage ?? {}).some(d => d && d.qty !== 0) || label.additionalInstructions?.some(c => ['DAILY', 'EVENING'].includes(c));
export function dayValuesProblem(days: string[]): string | null {
  if (!days.length) return 'Select at least one day, or cancel Name of Days.';
  if (days.some(day => !Object.hasOwn(DAY_NAMES, day))) return 'Remove unknown weekday values and select the required days again.';
  if (new Set(days).size !== days.length) return 'Remove duplicate weekday values and select the required days again.';
  return null;
}
export function formatDays(days: string[]): string {
  if (dayValuesProblem(days)) return '';
  const names = days.map(day => DAY_NAMES[day]);
  return names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' සහ ' + names[names.length - 1];
}
/** PDF pp25–27: days first, then Digital, Daily or Evening; STAT may precede days. */
export function daySelectionRefusal(label: DayState, next: string): string | null {
  const rangeRefusal = rangeSelectionRefusal(label, next);
  if (rangeRefusal || hasWeekdayRange(label) || next === RANGE_CODE) return rangeRefusal;
  const codes = label.additionalInstructions ?? [];
  const days = label.selectedDaysOfWeek ?? [];
  if (codes.includes(next)) return null;
  if (next === 'NAME OF DAYS') {
    if (readEnt(codes) || codes.some(c => CONFLICTS.includes(c))) return 'Remove the incompatible schedule before selecting Name of Days.';
    if (!days.length && hasSchedule(label)) return 'Select Name of Days before Digital Label, Daily or Evening.';
  }
  if (days.length && CONFLICTS.includes(next)) return 'Remove selected days before choosing an incompatible schedule.';
  if (days.length && ['DIGITAL', 'DAILY', 'EVENING'].includes(next) && !label.daysConfirmed) return 'Confirm selected days with Done before choosing the dosing schedule.';
  return null;
}
export function daysProblem(label: DayState): string | null {
  if (hasWeekdayRange(label)) return rangeProblem(label);
  const days = label.selectedDaysOfWeek ?? [];
  if (!days.length) return null;
  const invalid = dayValuesProblem(days);
  if (invalid) return invalid;
  if (readEnt(label.additionalInstructions ?? []) || label.additionalInstructions?.some(c => CONFLICTS.includes(c))) return 'Selected days require Digital Label, Daily or Evening; remove the incompatible schedule.';
  if (!label.daysConfirmed) return 'Confirm selected days with Done before completing the label.';
  if (!hasSchedule(label)) return 'Choose Digital Label, Daily or Evening and enter the required quantity.';
  return null;
}


export const RANGE_CODE = 'TILL TO DAY';
export const LEGACY_RANGE_CODES = ['TILL DATE', 'AND THIS DATE'];
const RANGE_CONFLICTS = ['STAT', 'EOD', '8H', '6H', '5H', 'WEEKLY', '4H', 'CUSTOM', 'SOS', 'BD', 'TDS'];
export const hasWeekdayRange = (label: DayState) => label.weekdayRange != null || (label.additionalInstructions ?? []).some(c => [RANGE_CODE, ...LEGACY_RANGE_CODES].includes(c));
export const validWeekday = (day: unknown): day is string => typeof day === 'string' && Object.hasOwn(DAY_NAMES, day);

/** Endpoints are kept as chosen, including same-day and week-boundary ranges; no duration is inferred. */
export function rangeEndpointsProblem(range: WeekdayRange | null | undefined): string | null {
  if (!range || typeof range !== 'object' || !validWeekday(range.start)) return 'Select a valid start weekday for Till to the Day.';
  if (!validWeekday(range.end)) return 'Select a valid end weekday for Till to the Day.';
  if (range.confirmed !== true) return 'Confirm the range endpoint with Done.';
  return null;
}
export function formatWeekdayRange(range: WeekdayRange | null | undefined): string {
  return rangeEndpointsProblem(range) ? '' : `${DAY_NAMES[range!.start!]} සිට ${DAY_NAMES[range!.end!]} දක්වා`;
}
export function rangeSelectionRefusal(label: DayState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  const active = hasWeekdayRange(label);
  // Correcting restored conflicting selections must always remain possible.
  if (codes.includes(next) && next !== RANGE_CODE) return null;
  if (next === RANGE_CODE) {
    if (active) return null; // Deselecting/removing an existing range.
    if (readEnt(codes) || label.stat || codes.some(c => RANGE_CONFLICTS.includes(c)) || hasSchedule(label)) return 'Select and confirm the first weekday before Till to the Day and before the dosing schedule; remove incompatible selections first.';
    if (label.selectedDaysOfWeek?.length !== 1 || !validWeekday(label.selectedDaysOfWeek[0]) || !label.daysConfirmed) return 'Select exactly one start day in Name of Days and confirm Done before Till to the Day.';
  }
  if (!active) return null;
  if (RANGE_CONFLICTS.includes(next) || next === 'ENT' || LEGACY_RANGE_CODES.includes(next)) return 'Remove Till to the Day before choosing an incompatible workflow.';
  if (['DIGITAL', 'DAILY', 'EVENING'].includes(next) && rangeEndpointsProblem(label.weekdayRange)) return 'Select and confirm the end day in Name of Days before the dosing schedule.';
  return null;
}
export function rangeProblem(label: DayState): string | null {
  const codes = label.additionalInstructions ?? [];
  if (!hasWeekdayRange(label)) return null;
  if (codes.some(c => LEGACY_RANGE_CODES.includes(c))) return 'Remove the legacy date selection and use Name of Days → Done → Till to the Day.';
  if (codes.filter(c => c === RANGE_CODE).length !== 1) return 'Correct the Till to the Day selection and its weekday endpoints.';
  const problem = rangeEndpointsProblem(label.weekdayRange);
  if (problem) return problem;
  if (label.selectedDaysOfWeek?.length) return 'Remove individual selected days before completing a weekday range.';
  if (readEnt(codes) || label.stat || codes.some(c => RANGE_CONFLICTS.includes(c))) return 'Till to the Day cannot be combined with STAT, EOD, intervals, Weekly or ENT.';
  if (codes.some((code, index) => ['DAILY', 'EVENING'].includes(code) && index < codes.indexOf(RANGE_CODE))) return 'Select Till to the Day before the dosing schedule.';
  if (!hasSchedule(label)) return 'Choose Digital Label, Daily or Evening and enter the required quantity for the weekday range.';
  return null;
}
