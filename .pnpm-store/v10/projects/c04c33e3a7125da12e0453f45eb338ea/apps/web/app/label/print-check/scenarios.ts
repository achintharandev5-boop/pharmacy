import { buildFinalInstruction } from '../../../lib/labelBuilder';
import { setWordingModeForTests, type WordingMode } from '../../../lib/instructionEngine';

/**
 * Sample labels for the printed-label check page. Every printed word comes from the real label
 * builder (lib/labelBuilder.ts) and the workstation's own option lists (reasons, weekdays,
 * instruction codes); nothing here is new wording.
 */
type Dose = { qty: number; isFraction: boolean };
const d = (qty: number): Dose => ({ qty, isFraction: qty % 1 !== 0 });
const none = d(0);

type ScenarioState = {
  dosage?: { morning: Dose; lunch: Dose; night: Dose };
  frequencyDosage?: Dose;
  stat?: { qty: number; isFraction: boolean; followUp: string | null; administration: string[] } | null;
  days?: number;
  additionalInstructions?: string[];
  reasons?: string[];
  selectedDaysOfWeek?: string[];
  productName?: string;
  productQuantity?: number;
  alternativeProductName?: string;
  customerName?: string;
  expiryDate?: string;
  showAddress?: boolean;
};

const MLN = { morning: d(1), lunch: d(1), night: d(1) };
const STAT_1_8H = { qty: 1, isFraction: false, followUp: '8H', administration: ['TAKE'] };

export const SCENARIOS: { id: string; name: string; group: string; state: ScenarioState }[] = [
  { id: 'S1', group: 'Simple', name: 'Morning 1 + TAKE AFTER', state: { dosage: { morning: d(1), lunch: none, night: none }, additionalInstructions: ['TAKE', 'AFTER'] } },
  { id: 'S2', group: 'Morning/Lunch/Night', name: '(A) M/L/N 1/1/1 + TAKE AFTER + 5 days', state: { dosage: MLN, additionalInstructions: ['TAKE', 'AFTER'], days: 5 } },
  { id: 'S3', group: 'Morning/Lunch/Night', name: '(B) S2 + one reason', state: { dosage: MLN, additionalInstructions: ['TAKE', 'AFTER', 'REASONS'], days: 5, reasons: ['කැස්සට'] } },
  { id: 'S4', group: 'STAT', name: '(C) S2 + STAT 1 → 8H', state: { dosage: MLN, additionalInstructions: ['TAKE', 'AFTER', 'STAT'], days: 5, stat: STAT_1_8H } },
  { id: 'S5', group: 'STAT', name: '(D) Morning 1 + TAKE AFTER + STAT 1 → 8H', state: { dosage: { morning: d(1), lunch: none, night: none }, additionalInstructions: ['TAKE', 'AFTER', 'STAT'], stat: STAT_1_8H } },
  { id: 'S6', group: 'STAT', name: 'STAT 2 only (no follow-up) + TAKE AFTER', state: { additionalInstructions: ['STAT', 'TAKE', 'AFTER'], stat: { qty: 2, isFraction: false, followUp: null, administration: ['TAKE'] } } },
  { id: 'S7', group: 'Busy', name: '(E) M/L/N + TAKE AFTER + Weekly, Till Date, And This Date, 2 reasons, Monday, STAT', state: { dosage: MLN, additionalInstructions: ['TAKE', 'AFTER', 'WEEKLY', 'TILL DATE', 'AND THIS DATE', 'REASONS', 'STAT'], reasons: ['කැස්සට', 'සෙමට'], selectedDaysOfWeek: ['MONDAY'], stat: STAT_1_8H } },
  { id: 'S8', group: 'Interval', name: '8H × 1 + TAKE AFTER + 5 days', state: { frequencyDosage: d(1), additionalInstructions: ['8H', 'TAKE', 'AFTER'], days: 5 } },
  { id: 'S9', group: 'Morning/Lunch/Night', name: 'Fractions ½/½/½ + GIVE BEFORE + 7 days', state: { dosage: { morning: d(0.5), lunch: d(0.5), night: d(0.5) }, additionalInstructions: ['GIVE', 'BEFORE'], days: 7 } },
  { id: 'S10', group: 'Multiple instructions', name: 'Morning 2 / Night 2 + Chewable TAKE AFTER + 3 long reasons + 14 days + 3 weekdays', state: { dosage: { morning: d(2), lunch: none, night: d(2) }, additionalInstructions: ['CHEWABLE', 'TAKE', 'AFTER', 'REASONS'], reasons: ['වේදනාව ඇති විට පමණක් ගන්න', 'නොනවත්වා බඩ යන විට', 'සෙම්ප්‍රතිශ්‍යාවට'], days: 14, selectedDaysOfWeek: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] } },
  { id: 'S11', group: 'Long text', name: 'Long names, brand, no address + M/L/N 1½/1/1½ + With Food GIVE + 30 days', state: { dosage: { morning: d(1.5), lunch: d(1), night: d(1.5) }, additionalInstructions: ['WITH FOOD', 'GIVE'], days: 30, productName: 'AMOXICILLIN AND CLAVULANATE POTASSIUM 625MG', productQuantity: 120, alternativeProductName: 'AUGMENTIN DUO FORTE', customerName: 'Wickramasinghe Arachchige Dona Kumarihami', showAddress: false } },
  { id: 'S12', group: 'Worst case', name: 'Everything: S7 with 1½ doses + Chewable + 3 long reasons + 7 weekdays + 30 days', state: { dosage: { morning: d(1.5), lunch: d(1.5), night: d(1.5) }, additionalInstructions: ['CHEWABLE', 'TAKE', 'AFTER', 'WEEKLY', 'TILL DATE', 'AND THIS DATE', 'REASONS', 'STAT'], reasons: ['වේදනාව ඇති විට පමණක් ගන්න', 'නොනවත්වා බඩ යන විට', 'සෙම්ප්‍රතිශ්‍යාවට'], selectedDaysOfWeek: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'], days: 30, stat: { qty: 2, isFraction: false, followUp: '8H', administration: ['TAKE'] } } },
  { id: 'S13', group: 'Long text', name: 'Very long medicine name (must print in full or be blocked)', state: { dosage: { morning: d(1), lunch: none, night: d(1) }, additionalInstructions: ['TAKE', 'AFTER'], productName: 'BECLOMETHASONE DIPROPIONATE AND FORMOTEROL FUMARATE DIHYDRATE PRESSURISED INHALATION 100/6 MICROGRAMS', productQuantity: 1 } },
  { id: 'S14', group: 'Long text', name: 'Long patient name without a brand', state: { dosage: { morning: d(1), lunch: none, night: d(1) }, additionalInstructions: ['TAKE', 'AFTER'], customerName: 'Wickramasinghe Arachchige Dona Kumarihami Senanayake' } },
];

/** The printed label data for each scenario, as the builder produces it under `mode`. */
export function buildScenarioLabels(mode: WordingMode) {
  setWordingModeForTests(mode);
  try {
    return SCENARIOS.map(({ id, state }) => buildFinalInstruction({
      id,
      productName: state.productName ?? 'PARACETAMOL 500MG',
      productQuantity: state.productQuantity ?? 15,
      alternativeProductName: state.alternativeProductName ?? '',
      customerName: state.customerName ?? 'Test Patient',
      expiryDate: state.expiryDate ?? '12/2027',
      showAddress: state.showAddress ?? true,
      dosage: state.dosage ?? { morning: none, lunch: none, night: none },
      frequencyDosage: state.frequencyDosage ?? none,
      stat: state.stat ?? null,
      days: state.days ?? null,
      // Layout check only: shows the expiry row with a sample date (never a real label).
      additionalInstructions: [...(state.additionalInstructions ?? []), 'ADD EXP DATE'],
      reasons: state.reasons ?? [],
      reason: null,
      selectedDaysOfWeek: state.selectedDaysOfWeek ?? [],
    }));
  } finally {
    setWordingModeForTests(null);
  }
}
