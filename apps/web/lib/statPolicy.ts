import { dosageText } from './dosageQuantity';
import { readEnt } from './ent';

/** Document 5, pages 13–16, 18–24, 27–28, 32–37. */
export const STAT_TAKE_TEXT = 'පළමුව පමණක් ගන්න';
export const STAT_THEN_TEXT = 'ඉන්පසු';
type Dose = { qty: number; isFraction?: boolean };
export type StatState = {
  additionalInstructions?: string[];
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', Dose>> | null;
  weeklyDosage?: Dose | null;
  frequencyDosage?: Dose | null;
  selectedDaysOfWeek?: string[];
  stat?: (Dose & { followUp?: string | null; administration?: string[] }) | null;
};
const COSMETIC = ['REMOVE ADDRESS', 'ADD EXP DATE', 'REASONS'];
const SCHEDULES = ['8H', '6H', '5H', 'EOD', 'DAILY', 'EVENING', 'WEEKLY'];
const UNSUPPORTED = ['TILL DATE', 'TILL TO DAY', 'AND THIS DATE', '4H', 'CUSTOM', 'SOS'];
const hasRows = (label: StatState) => Object.values(label.dosage ?? {}).some(d => d && d.qty > 0);

export function statSelectionRefusal(label: StatState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (codes.includes(next)) return null;
  if (next === 'STAT' && !label.stat && (hasRows(label) || label.selectedDaysOfWeek?.length || codes.some(i => !COSMETIC.includes(i)))) return 'Select STAT before the regular dosing workflow.';
  if (label.stat && UNSUPPORTED.includes(next) && !(readEnt(codes) && ['4H', 'CUSTOM', 'SOS'].includes(next))) return 'This follow-up is not supported with STAT.';
  if (label.stat) {
    const interval = codes.find(i => ['8H', '6H', '5H'].includes(i));
    if (interval && ['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY', 'DIGITAL'].includes(next)) return 'Remove the selected STAT interval before choosing another dosing mode.';
    if (['8H', '6H', '5H'].includes(next) && (hasRows(label) || codes.some(i => ['DAILY', 'EVENING', 'WEEKLY'].includes(i)))) return 'Choose one compatible follow-up dosing mode after STAT.';
  }
  return null;
}

export function statProblem(label: StatState): string | null {
  const codes = label.additionalInstructions ?? [];
  const stat = label.stat;
  if (!stat && !codes.includes('STAT')) return null;
  if (!stat || !Number.isFinite(stat.qty) || !(stat.qty > 0)) return 'Enter a valid positive STAT quantity.';
  const marker = codes.indexOf('STAT');
  if (marker >= 0 && codes.slice(0, marker).some(i => !COSMETIC.includes(i))) return 'Select STAT before the regular dosing workflow.';
  if (codes.filter(i => i === 'STAT').length > 1) return 'Remove the duplicate STAT selection.';
  if (stat.administration?.some(i => i !== 'TAKE')) return `No approved Sinhala wording for STAT with ${stat.administration.join(' + ')}. Confirm the STAT dose with its prescribed TAKE phrase.`;
  if (stat.followUp && ![...SCHEDULES, 'MORNING', 'LUNCH', 'NIGHT', 'DIGITAL', 'DIGI LABEL', 'BD', 'TDS', 'FOUR', 'MORNING & NIGHT'].includes(stat.followUp)
    && !(readEnt(codes) && ['4H', 'CUSTOM', 'SOS'].includes(stat.followUp))) return 'The saved STAT follow-up is unsupported. Select a permitted follow-up schedule.';
  if (codes.some(i => UNSUPPORTED.includes(i) && !(readEnt(codes) && ['4H', 'CUSTOM', 'SOS'].includes(i)))) return 'This follow-up is not supported with STAT.';
  if (!codes.some(i => SCHEDULES.includes(i)) && !hasRows(label) && !(readEnt(codes) && codes.some(i => ['4H', 'CUSTOM', 'SOS'].includes(i)))) return 'Select a follow-up schedule after STAT (or the text-only EOD follow-up).';
  const intervals = codes.filter(i => ['8H', '6H', '5H'].includes(i));
  if (intervals.length > 1 || (intervals.length && (hasRows(label) || codes.some(i => ['DAILY', 'EVENING', 'WEEKLY'].includes(i))))) return 'Choose one compatible follow-up dosing mode after STAT.';
  if (label.selectedDaysOfWeek?.length && intervals.length) return 'Selected days cannot be combined with a STAT interval.';
  const qtyCode = codes.find(i => ['8H', '6H', '5H', 'DAILY', 'EVENING'].includes(i)) ?? (codes.includes('WEEKLY') && !hasRows(label) ? 'WEEKLY' : null);
  const followUpDose = qtyCode === 'WEEKLY' ? label.weeklyDosage : label.frequencyDosage;
  if (qtyCode && (!Number.isFinite(followUpDose?.qty) || !((followUpDose?.qty ?? 0) > 0))) return `Enter the follow-up quantity for ${qtyCode}.`;
  return null;
}

/** One quantity-bearing prefix for selected preview, saved text and rendered label. */
export function statPrefix(label: StatState): string | null {
  if (!label.stat || statProblem(label)) return null;
  const qty = dosageText(label.stat.qty, label.stat.isFraction ?? !Number.isInteger(label.stat.qty));
  const words = STAT_TAKE_TEXT.split(' ');
  const verb = words.pop();
  return `${words.join(' ')} ${qty} ${verb} ${STAT_THEN_TEXT},`;
}
