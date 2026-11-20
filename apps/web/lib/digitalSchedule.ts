import { dosageText } from './dosageQuantity';
import { readEnt } from './ent';

export const DIGITAL_TIMES = ['morning', 'lunch', 'night'] as const;
const TIME_TEXT = { morning: 'උදේට', lunch: 'දවල්', night: 'රාත්‍රියට' };
type Dose = { qty: number; isFraction?: boolean };
export type DigitalState = {
  dosage?: Partial<Record<typeof DIGITAL_TIMES[number], Dose>> | null;
  additionalInstructions?: string[];
  frequencyDosage?: (Dose & { confirmed?: boolean }) | null;
};

/** PDF pp22–25: zero is unselected; BD/TDS are derived from the selected time quantities. */
export function digitalSchedule(label: DigitalState) {
  const rows = DIGITAL_TIMES.flatMap(time => {
    const dose = label.dosage?.[time];
    return dose && Number.isFinite(dose.qty) && dose.qty > 0
      ? [{ time, text: TIME_TEXT[time], qty: dose.qty, formatted: dosageText(dose.qty, dose.isFraction || !Number.isInteger(dose.qty)) }]
      : [];
  });
  const equal = rows.length > 1 && rows.every(row => row.qty === rows[0].qty);
  const pattern = equal && rows.length === 3 ? 'TDS'
    : equal && rows.length === 2 && rows[0].time === 'morning' && rows[1].time === 'night' ? 'BD' : null;
  const evening = label.additionalInstructions?.includes('EVENING') ? label.frequencyDosage : null;
  const eveningRow = evening && Number.isFinite(evening.qty) && evening.qty > 0
    ? { time: 'evening' as const, text: '\u0dc4\u0dc0\u0dc3\u0da7', qty: evening.qty, formatted: dosageText(evening.qty, evening.isFraction || !Number.isInteger(evening.qty)) } : null;
  const printRows = [...rows.filter(row => row.time !== 'night'), ...(eveningRow ? [eveningRow] : []), ...rows.filter(row => row.time === 'night')];
  return { rows, printRows, pattern, unequal: rows.length > 1 && !equal };
}

export function digitalProblem(label: DigitalState): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes)) return null;
  const entries = DIGITAL_TIMES.map(time => label.dosage?.[time]);
  const selected = entries.some(dose => dose && dose.qty !== 0);
  if (codes.includes('BD') || codes.includes('TDS')) return 'Use Morning/Lunch/Night quantities to select BD or TDS; remove the legacy frequency selection.';
  if (label.dosage && entries.some(dose => !dose)) return 'Restore or enter all three dose slots explicitly; zero means an unselected time.';
  if (!selected) return null;
  if (entries.some(dose => !dose || !Number.isFinite(dose.qty) || dose.qty < 0)) return 'Enter valid non-negative quantities for Morning, Lunch and Night. Zero means that time is not selected.';
  if (codes.some(code => ['8H', '6H', '5H', 'DAILY'].includes(code))) return 'Digital Label cannot be combined with 8H, 6H, 5H or Daily.';
  return null;
}

export function digitalSelectionRefusal(label: DigitalState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || codes.includes(next)) return null;
  if (digitalSchedule(label).rows.length && ['8H', '6H', '5H', 'DAILY'].includes(next)) return '8H, 6H, 5H and Daily are locked while a Digital Label dose is selected.';
  if (next === 'DIGITAL' && codes.includes('DAILY')) return 'Remove Daily before selecting a Digital Label dose.';
  return null;
}
