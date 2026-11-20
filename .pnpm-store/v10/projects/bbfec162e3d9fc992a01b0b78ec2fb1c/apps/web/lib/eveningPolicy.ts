import { readEnt } from './ent';
import type { DigitalState } from './digitalSchedule';

export const EVENING_TEXT = 'හවසට';
export type EveningState = DigitalState & { frequencyDosage?: { qty: number; confirmed?: boolean } | null };
const selectedDigital = (label: EveningState) => Object.values(label.dosage ?? {}).some(dose => dose && dose.qty !== 0);

/** PDF pp30–33. STAT/EOD ordering is still enforced by their existing policies. */
export function eveningSelectionRefusal(label: EveningState, next: string): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || codes.includes(next)) return null;
  if (codes.includes('EVENING') && ['8H', '6H', '5H', 'DAILY', '4H', 'CUSTOM', 'SOS'].includes(next)) return 'Remove Evening before choosing an incompatible dosing schedule.';
  if (next === 'EVENING' && (selectedDigital(label) || codes.some(code => ['8H', '6H', '5H', 'DAILY', '4H', 'CUSTOM', 'SOS'].includes(code)))) return 'Select Evening and confirm its quantity before adding Digital Label doses; remove the existing schedule first.';
  if (next === 'DIGITAL' && codes.includes('EVENING') && !label.frequencyDosage?.confirmed) return 'Click Evening Done before selecting Digital Label doses.';
  return null;
}

export function eveningProblem(label: EveningState): string | null {
  const codes = label.additionalInstructions ?? [];
  if (readEnt(codes) || !codes.includes('EVENING')) return null;
  if (!Number.isFinite(label.frequencyDosage?.qty) || !(label.frequencyDosage!.qty > 0)) return 'Enter a valid positive Evening quantity.';
  if (codes.filter(code => code === 'EVENING').length > 1 || codes.some(code => ['8H', '6H', '5H', 'DAILY', '4H', 'CUSTOM', 'SOS'].includes(code))) return 'Evening cannot be combined with an interval, Daily or another frequency.';
  if (selectedDigital(label) && !label.frequencyDosage?.confirmed) return 'Confirm the Evening quantity with Done before using Digital Label.';
  if (selectedDigital(label) && codes.includes('WEEKLY')) return 'Weekly with Evening and Digital Label has no approved combined frequency wording. Remove the conflicting schedule.';
  return null;
}
