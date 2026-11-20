import { formattedReasons } from './reasons';
import { formatDays, formatWeekdayRange, hasWeekdayRange } from './nameOfDays';
import { WEEKLY_TEXT } from './weeklyPolicy';
import { DAILY_TEXT } from './dailyPolicy';
import { EVENING_TEXT } from './eveningPolicy';
import { digitalSchedule } from './digitalSchedule';
import { statPrefix } from './statPolicy';
import { INTERVAL_CODES } from './intervalPolicy';
import { EOD_TEXT, eodProblem } from './eod';
import { dosageText } from './dosageQuantity';
import { productTypePrinting } from './productTypePrinting';
import { ENT_PREFIX, readEnt, entInstructions } from './ent';
import { EXPIRY_CODE, type ExpiryBatch } from './batchExpiry';
import { analyseAdministration, analyseDailySchedule, currentAdministrationText, getWordingMode, frequencyInstruction } from './instructionEngine';
import { useLabelStore } from '../store/labelStore';
import type { LabelData, SelectedProduct, StatEntry } from '../store/labelStore';
import type { EntSelection } from './ent';

type LabelBuildState = Omit<Partial<LabelData>, 'dosage' | 'stat'> & {
  customerName?: string | null;
  productName?: string;
  expDate?: string | null;
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', { qty: number; isFraction?: boolean }>>;
  stat?: (Partial<StatEntry> & Pick<StatEntry, 'qty'> & { administration?: string[] }) | null;
  product?: SelectedProduct | null;
};

export interface BuiltLabelData {
  id: string;
  showAddress: boolean;
  expiryDate: string | null;
  /** Batch the printed expiry came from; review display only. */
  expiryBatch?: ExpiryBatch | null;
  customerName: string;
  productName: string;
  /** Catalogue record used by the shared product-type printing rule. */
  product?: SelectedProduct | null;
  consolidatedDosage?: boolean;
  digitalRows?: ReturnType<typeof digitalSchedule>['printRows'];
  unequalDigital?: boolean;
  weeklyPrefix?: string;
  daysPrefix?: string;
  replacesFrequencyDosage?: boolean;
  productTypePrintingError?: string | null;
  reason: string | null;
  reasons: string[];
  selectedDaysOfWeek: string[];
  productQuantity?: number;
  alternativeProductName?: string;
  dosage?: Partial<Record<'morning' | 'lunch' | 'night', string>>;
  frequencyDosage?: { qty: string; freqLabel: string };
  stat?: string;
  statInPhrase?: { phrase: string; qty: string; followUp: string | null };
  days?: number;
  additionalInstructions?: string[];
  ent?: EntSelection;
  dosageText: string;
  instructionString: string;
  finalInstructionText?: string;
}

export function formatDosageReadable(qty: number, isFraction: boolean): string | null {
  return qty > 0 ? dosageText(qty, isFraction) : null;
}

export function buildFinalInstruction(state: LabelBuildState): BuiltLabelData {
  const typePrinting = productTypePrinting(state);
  const ent = readEnt(state.additionalInstructions || []);
  const selectedReasons = formattedReasons(state);

  // Customer Name: check state or global store
  const customer = state.customerName || currentCustomerName(state);

  const prodName = state.product?.name || state.productName || '';

  // Expiry date: printed only when Add Expiry Date is selected, and only the GRN batch date
  // recorded on this label (Document 5 pp. 41–43). It is a separate field, never part of the
  // administration sentence or finalInstructionText.
  const expDate = state.additionalInstructions?.includes(EXPIRY_CODE) ? state.expiryDate || state.expDate || null : null;

  const output: BuiltLabelData = {
    id: state.id || '',
    showAddress: state.showAddress !== false,
    expiryDate: expDate,
    expiryBatch: expDate ? state.expiryBatch ?? null : null,
    customerName: (customer && typeof customer === 'string') ? customer.trim() : '',
    productName: prodName,
    product: state.product ? { ...state.product } : null,
    consolidatedDosage: !!typePrinting.prefix && !['8H', '6H', '5H'].includes(typePrinting.pattern ?? ''),
    replacesFrequencyDosage: !!typePrinting.prefix,
    productTypePrintingError: typePrinting.error,
    reason: selectedReasons.length ? selectedReasons.join('\n') : null,
    reasons: selectedReasons,
    selectedDaysOfWeek: state.selectedDaysOfWeek || [],
    dosageText: '',
    instructionString: '',
  };

  const dosageForInstruction = {
    morning: state.dosage?.morning ?? { qty: 0 },
    lunch: state.dosage?.lunch ?? { qty: 0 },
    night: state.dosage?.night ?? { qty: 0 },
  };

  if (state.productQuantity) {
    output.productQuantity = state.productQuantity;
  }
  
  if (state.alternativeProductName?.trim()) {
    output.alternativeProductName = state.alternativeProductName.trim();
  }

  const digital = digitalSchedule(state);
  const eveningDigital = !ent && state.additionalInstructions?.includes('EVENING') && digital.rows.length > 0;
  if (!ent && digital.rows.length) { output.digitalRows = eveningDigital ? digital.printRows : digital.rows; output.unequalDigital = Boolean(eveningDigital || digital.unequal || state.additionalInstructions?.includes('WEEKLY')); }
  const dosageOut: Partial<Record<'morning' | 'lunch' | 'night', string>> = {};
  if (state.dosage?.morning) {
    const morningStr = formatDosageReadable(state.dosage.morning.qty, state.dosage.morning.isFraction ?? false);
    if (morningStr) dosageOut.morning = morningStr;
  }
  
  if (state.dosage?.lunch) {
    const lunchStr = formatDosageReadable(state.dosage.lunch.qty, state.dosage.lunch.isFraction ?? false);
    if (lunchStr) dosageOut.lunch = lunchStr;
  }

  if (state.dosage?.night) {
    const nightStr = formatDosageReadable(state.dosage.night.qty, state.dosage.night.isFraction ?? false);
    if (nightStr) dosageOut.night = nightStr;
  }

  if (!ent && digital.rows.length) {
    for (const row of digital.rows) dosageOut[row.time] = row.formatted;
  }
  if (Object.keys(dosageOut).length > 0) {
    output.dosage = dosageOut;
  }

  const FREQUENCY_BTNS = ['4H', 'CUSTOM', 'SOS', '6H', '8H', '5H', 'DAILY', 'EVENING'];
  const activeFreq = state.additionalInstructions?.find(i => ['8H', '6H', '5H'].includes(i))
    ?? state.additionalInstructions?.find((i: string) => FREQUENCY_BTNS.includes(i));

  if ((activeFreq || !state.additionalInstructions?.some(code => ['EOD', 'WEEKLY'].includes(code))) && state.frequencyDosage && (state.frequencyDosage.qty > 0 || state.frequencyDosage.isFraction)) {
    const freqQtyStr = formatDosageReadable(state.frequencyDosage.qty, state.frequencyDosage.isFraction);
    if (freqQtyStr) {
      output.frequencyDosage = {
        qty: freqQtyStr,
        freqLabel: ent && activeFreq === 'CUSTOM' ? `Every ${ent.customHours} hours` : activeFreq || ''
      };
    }
  }

  if (state.days && state.days > 0) {
    output.days = state.days;
  }

  if (typePrinting.prefix || (state.additionalInstructions && state.additionalInstructions.length > 0)) {
    const rawList: string[] = (state.additionalInstructions ?? []).filter((i: string) => !i.startsWith(ENT_PREFIX));
    const mode = getWordingMode();

    // The administration sentence comes from the instruction engine. "current" wording keeps
    // today's output exactly (including the partial-selection phrases, which DONE never lets
    // through). "spec" wording gives a sentence only once the workflow is complete.
    const finalSentence: string | null = mode === 'spec'
      ? analyseAdministration(rawList, dosageForInstruction, 'spec').text
      : currentAdministrationText(rawList);

    const sinhalaPhrases: Record<string, string> = {

    };

    const controlTags = [
      'CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH',
      'TAKE', 'GIVE', 'BEFORE', 'AFTER', 'ADD EXP DATE', 'REASONS',
      // Keep in Mouth is generated by the shared administration engine in both modes.
      'KEEP IN MOUTH', 'EOD', 'STAT', 'TILL TO DAY', 'TILL DATE', 'AND THIS DATE',
    ];
    
    const nonControlInstructions = rawList
      .filter(i => !controlTags.includes(i) && !(ent && FREQUENCY_BTNS.includes(i)))
      .filter(i => !typePrinting.prefix || !['8H', '6H', '5H', 'EOD', 'WEEKLY', 'EVENING'].includes(i))
      .map(i => sinhalaPhrases[i] || i);

    const mergedInstructions = [...nonControlInstructions];
    if (typePrinting.prefix) {
      mergedInstructions.push([typePrinting.prefix, finalSentence].filter(Boolean).join(' '));
    } else if (!ent && finalSentence && !mergedInstructions.includes(finalSentence)) {
      mergedInstructions.push(finalSentence);
    }

    if (!ent && rawList.includes('DAILY') && !typePrinting.prefix) {
      output.replacesFrequencyDosage = true;
      output.additionalInstructions = [[rawList.includes('WEEKLY') ? 'සතියකට වරක්' : null, DAILY_TEXT, formatDosageReadable(state.frequencyDosage?.qty ?? 0, state.frequencyDosage?.isFraction ?? false), finalSentence].filter(Boolean).join(' ')];
    } else if (!ent && rawList.includes('EVENING') && !typePrinting.prefix) {
      output.replacesFrequencyDosage = true;
      const modifiers = rawList.includes('WEEKLY') ? '\u0dc3\u0dad\u0dd2\u0dba\u0d9a\u0da7 \u0dc0\u0dbb\u0d9a\u0dca ' : '';
      output.additionalInstructions = eveningDigital
        ? [modifiers.trim(), finalSentence].filter((line): line is string => Boolean(line))
        : [[modifiers + (formatDosageReadable(state.frequencyDosage?.qty ?? 0, state.frequencyDosage?.isFraction ?? false) ?? ''), EVENING_TEXT, finalSentence].filter(Boolean).join(' ')];
    } else if (!ent && rawList.includes('WEEKLY') && !typePrinting.prefix) {
      output.replacesFrequencyDosage = true;
      if (digital.rows.length) {
        output.weeklyPrefix = WEEKLY_TEXT;
        output.additionalInstructions = [WEEKLY_TEXT, finalSentence].filter((line): line is string => Boolean(line));
      } else {
        output.additionalInstructions = [[WEEKLY_TEXT, formatDosageReadable(state.weeklyDosage?.qty ?? 0, state.weeklyDosage?.isFraction ?? false), finalSentence].filter(Boolean).join(' ')];
      }
    } else if (state.stat && !typePrinting.prefix && activeFreq && state.frequencyDosage?.qty) {
      output.replacesFrequencyDosage = true;
      output.additionalInstructions = [`${formatDosageReadable(state.frequencyDosage.qty, state.frequencyDosage.isFraction)} ${frequencyInstruction(activeFreq)}${finalSentence ? ` ${finalSentence}` : ''}`];
    } else output.additionalInstructions = mergedInstructions;
  }

  if (state.additionalInstructions?.includes('EOD') && !eodProblem(state) && !typePrinting.prefix) {
    const lines = [...(output.additionalInstructions ?? [])];
    const firstSentence = lines.findIndex(line => /[\u0d80-\u0dff]/.test(line));
    if (firstSentence >= 0) lines[firstSentence] = `${EOD_TEXT}, ${lines[firstSentence]}`;
    else lines.unshift(EOD_TEXT);
    output.additionalInstructions = lines;
  }

  if (getWordingMode() === 'spec') {
    const dailyPhrase = ent || typePrinting.pattern || state.additionalInstructions?.some(code => ['EVENING', 'WEEKLY'].includes(code)) ? null : analyseDailySchedule(dosageForInstruction, state.additionalInstructions || []).text;
    if (dailyPhrase) output.additionalInstructions = [dailyPhrase, ...(output.additionalInstructions ?? [])];
  }

  if (ent) {
    output.ent = ent;
    output.additionalInstructions = [...(output.additionalInstructions ?? []), ...entInstructions(ent, dosageForInstruction, activeFreq ? { code: activeFreq, qty: state.frequencyDosage?.qty ?? 0 } : undefined)];
  }

  if (eodProblem(state)) output.additionalInstructions = [];

  const dayPhrase = hasWeekdayRange(state) ? formatWeekdayRange(state.weekdayRange) : formatDays(state.selectedDaysOfWeek ?? []);
  if (dayPhrase) output.daysPrefix = dayPhrase;

  const initialPrefix = eodProblem(state) ? null : statPrefix(state);
  if (initialPrefix && state.stat) {
    const statQty = formatDosageReadable(state.stat.qty, state.stat.isFraction ?? !Number.isInteger(state.stat.qty))!;
    output.stat = `STAT ${statQty}`; // Review metadata; the print pill is suppressed by statInPhrase.
    output.statInPhrase = { phrase: initialPrefix, qty: statQty, followUp: null };
    output.additionalInstructions = [initialPrefix, ...(output.additionalInstructions ?? [])];
  } else if (state.stat || state.additionalInstructions?.includes('STAT')) {
    output.additionalInstructions = [];
  }

  // Format summary strings for UI review/preview
  const dosageTextParts: string[] = [];
  if (output.dosage && !output.consolidatedDosage) {
    if (output.dosage.morning) dosageTextParts.push(`Morning: ${output.dosage.morning}`);
    if (output.dosage.lunch) dosageTextParts.push(`Lunch: ${output.dosage.lunch}`);
    if (output.dosage.night) dosageTextParts.push(`Night: ${output.dosage.night}`);
  }
  const sharedIntervalLine = output.replacesFrequencyDosage && state.additionalInstructions?.some(i => INTERVAL_CODES.includes(i));
  if (output.frequencyDosage && !sharedIntervalLine && !state.additionalInstructions?.some(code => ['EVENING', 'DAILY'].includes(code)) && !(initialPrefix && output.replacesFrequencyDosage)) {
    dosageTextParts.push(`${output.frequencyDosage.freqLabel || 'FREQ'}: ${output.frequencyDosage.qty}`);
  }
  if (!ent && digital.rows.length && !output.consolidatedDosage) {
    dosageTextParts.splice(0, digital.rows.length, ...(eveningDigital ? digital.printRows : digital.rows).map(row => `${row.text} ${row.formatted}`));
  }
  output.dosageText = dosageTextParts.join('  |  ');

  const instructionParts: string[] = [];
  if (output.additionalInstructions && output.additionalInstructions.length > 0) {
    instructionParts.push(...output.additionalInstructions);
  }

  output.instructionString = initialPrefix
    ? [initialPrefix, instructionParts.slice(1).join(' • ')].filter(Boolean).join(' ')
    : instructionParts.join(' • ');
  output.finalInstructionText = initialPrefix
    ? [initialPrefix, output.dosageText, output.instructionString.slice(initialPrefix.length).trim()].filter(Boolean).join(' ')
    : [output.dosageText, output.instructionString].filter(Boolean).join(' | ');

  if (output.weeklyPrefix) {
    output.finalInstructionText = [initialPrefix, output.weeklyPrefix, output.dosageText, ...(output.additionalInstructions ?? []).filter(line => line !== output.weeklyPrefix && line !== initialPrefix)].filter(Boolean).join(' ');
  }
  if (dayPhrase) {
    const remainder = (output.finalInstructionText ?? '').replace(initialPrefix ?? '', '').trim();
    output.finalInstructionText = [initialPrefix, dayPhrase, remainder].filter(Boolean).join(' ');
    output.instructionString = [initialPrefix, dayPhrase, instructionParts.filter(line => line !== initialPrefix).join(' • ')].filter(Boolean).join(' ');
  }
  if (hasWeekdayRange(state) && !dayPhrase) {
    output.additionalInstructions = []; output.instructionString = ''; output.finalInstructionText = '';
    output.dosage = undefined; output.digitalRows = undefined; output.frequencyDosage = undefined; output.dosageText = '';
  }
  if (selectedReasons.length) {
    const reasonText = selectedReasons.join('\n');
    output.instructionString = [output.instructionString, reasonText].filter(Boolean).join('\n');
    output.finalInstructionText = [output.finalInstructionText, reasonText].filter(Boolean).join('\n');
  }
  return output;
}

function currentCustomerName(state: LabelBuildState): string | null {
  if (state?.customerName && typeof state.customerName === 'string') {
    return state.customerName;
  }
  try {
    return useLabelStore.getState().customerName || null;
  } catch {
    return null;
  }
}
