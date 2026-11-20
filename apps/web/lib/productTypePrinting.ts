import { digitalSchedule } from './digitalSchedule';
import { EOD_TEXT, eodProblem } from './eod';
import { readEnt } from './ent';
import { dosageText } from './dosageQuantity';
import { resolveProductType } from './productType';

type Dose = { qty: number; isFraction?: boolean };
export type ProductTypePrintState = {
  product?: { product_type?: string | null } | null;
  additionalInstructions?: string[];
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', Dose>> | null;
  frequencyDosage?: Dose | null;
};

/** PDF pages 2–3, 21–24; Weekly + BD/TDS is explicitly defined on page 37. */
export function productTypePrinting(label: ProductTypePrintState) {
  const instructions = label.additionalInstructions ?? [];
  if (readEnt(instructions)) return { pattern: null, prefix: null, error: null };
  const interval = ['8H', '6H', '5H'].find((code) => instructions.includes(code));
  const rows = label.dosage;
  const morning = rows?.morning?.qty ?? 0;
  const evening = instructions.includes('EVENING');
  const digital = digitalSchedule(label);
  const tds = digital.pattern === 'TDS';
  const bd = digital.pattern === 'BD';
  const four = evening && tds && label.frequencyDosage?.qty === morning;
  // An unmatched Evening dose must keep individual quantities, never imply a common dose.
  const pattern = interval ?? (four ? 'FOUR_TIMES_DAILY' : evening ? null : tds ? 'TDS' : bd ? 'BD' : null);
  if (!pattern) return { pattern: null, prefix: null, error: null };
  const type = resolveProductType(label.product?.product_type);
  if (!type.sinhala) return { pattern, prefix: null, error: `${type.message} Correct the product type before printing this ${pattern} label.` };
  const dose = interval ? label.frequencyDosage : rows?.morning;
  if (!dose || !Number.isFinite(dose.qty) || !(dose.qty > 0)) return { pattern, prefix: null, error: null };
  const qty = dosageText(dose.qty, dose.isFraction ?? !Number.isInteger(dose.qty));
  const weekly = !interval && instructions.includes('WEEKLY');
  const schedule = interval ? `බැගින් පැය ${interval[0]}කට වරක්`
    : weekly ? 'සතියකට වරක්'
      : pattern === 'FOUR_TIMES_DAILY' ? 'බැගින් දිනකට හතර වරක්'
        : pattern === 'TDS' ? 'බැගින් දිනකට 3 වරක්' : 'බැගින් දිනකට 2 වරක්';
  const eod = instructions.includes('EOD') && !eodProblem(label) ? `${EOD_TEXT}, ` : '';
  return { pattern, prefix: `${eod}${type.sinhala} ${qty} ${schedule}`, error: null };
}
