import { reasonStateProblem } from './reasons';
export { reasonsProblem as reasonsPrintError } from './reasons';
import { daysProblem, hasWeekdayRange, type WeekdayRange } from './nameOfDays';
import { weeklyProblem, type WeeklyState } from './weeklyPolicy';
import { dailyProblem, type DailyState } from './dailyPolicy';
import { eveningProblem, type EveningState } from './eveningPolicy';
import { digitalProblem, type DigitalState } from './digitalSchedule';
import { INTERVAL_CODES, intervalProblem, type IntervalState } from './intervalPolicy';
import { statProblem, STAT_TAKE_TEXT, STAT_THEN_TEXT, type StatState } from './statPolicy';
import { eodProblem, type EodState } from './eod';
import { readEnt, validateEnt } from './ent';
import { productTypePrinting } from './productTypePrinting';
import { PRODUCT_TYPES } from './productType';
/**
 * The one place that turns the workstation's administration buttons into Sinhala label text,
 * and that says which step of the workflow a label is on.
 *
 * Two wordings exist side by side:
 *
 * - "current": the wording the workstation prints today (constants/oabInstructions.ts). This is
 *   the default; completed instruction wording is retained.
 * - "spec": the wording in the handwritten workflow specifications (NAB / OAB / Digital label /
 *   STAT / 8H-6H-5H / Evening-Daily sheets, and the "Software Logic" PDFs). The sheets say the
 *   printed sentence is the bracketed words, in the order the buttons are pressed. It is used
 *   only when NEXT_PUBLIC_LABEL_WORDING=spec, after pharmacist approval
 *   (docs/PHARMACIST_APPROVAL_REQUIRED.md). Every word below is copied from the sheets; nothing
 *   is translated or invented. docs/SINHALA_INSTRUCTION_MAPPING.md lists each word, its source
 *   and how legible it was.
 */
import { getInstruction, getNormalInstruction, type AdminAction, type InstructionCategory, type MealTiming } from '../constants/oabInstructions';

export type WordingMode = 'current' | 'spec';

/** Existing oral frequency wording, shared by the print row and STAT follow-up composition. */
export function frequencyInstruction(code: string): string {
  const words: Record<string, string> = {
    '8H': 'බැගින් පැය 8කට වරක්', '6H': 'බැගින් පැය 6කට වරක්', '5H': 'බැගින් පැය 5කට වරක්',
    DAILY: 'බැගින් දිනපතා', EVENING: 'බැගින් සවසට', SOS: 'බැගින් අවශ්‍ය විට පමණක්',
  };
  return words[code] ?? 'වරක්';
}

let modeOverride: WordingMode | null = null;

/** Which wording is printed. Default "current"; "spec" only when the environment says so. */
export function getWordingMode(): WordingMode {
  if (modeOverride) return modeOverride;
  return process.env.NEXT_PUBLIC_LABEL_WORDING === 'spec' ? 'spec' : 'current';
}

/** Tests only. */
export function setWordingModeForTests(mode: WordingMode | null) {
  modeOverride = mode;
}

// ---------------------------------------------------------------------------------------------
// Spec words ("[ ]" on the sheets)
// ---------------------------------------------------------------------------------------------

type FormSpec = {
  /** Word printed for the form button itself. */
  word: string;
  take: string;
  give: string;
  /** Whether BEFORE/AFTER follow ("[කෑමට] → [පසු]/[පෙර]"). False = timing locked by the sheet. */
  timing: boolean;
};

/** Form (OAB) buttons, keyed by the workstation's instruction code. */
export const SPEC_FORMS: Record<string, FormSpec> = {
  CHEWABLE: { word: 'හපලා', take: 'කන්න', give: 'කන්න දෙන්න', timing: true },
  'KEEP IN MOUTH': { word: 'දිව මත', take: 'තබා ගන්න', give: 'තබන්න', timing: true },
  'DISSOLVE AND DRINK': { word: 'දිය කර', take: 'බොන්න', give: 'බොන්න දෙන්න', timing: true },
  'EMPTY STOMACH': { word: 'හිස් බඩ', take: 'ගන්න', give: 'දෙන්න', timing: false },
  'WITH FOOD': { word: 'කෑමත් සමඟ', take: 'ගන්න', give: 'දෙන්න', timing: false },
};

/** Normal administration (NAB): TAKE / GIVE, then [කෑමට] and BEFORE / AFTER. */
export const SPEC_NAB = { take: 'ගන්න', give: 'දෙන්න' };
export const SPEC_MEAL = 'කෑමට';
export const SPEC_TIMING = { BEFORE: 'පෙර', AFTER: 'පසු' } as const;

/** With Food then Chewable: "කෑමත් සමඟ හපලා කන්න ( දෙන්න)", no timing. Only in that order. */
export const SPEC_WITH_FOOD_CHEWABLE = { word: 'කෑමත් සමඟ හපලා', take: 'කන්න', give: 'කන්න දෙන්න' };

/** Chewing locks these methods once selected; selected buttons may still be removed. */
const CHEWING_LOCKS = ['DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH', 'KEEP IN MOUTH'];
export function chewingSelectionRefusal(instructions: string[], next: string): string | null {
  if (!instructions.includes('CHEWABLE') || instructions.includes(next) || !CHEWING_LOCKS.includes(next)) return null;
  if (next === 'WITH FOOD' || next === 'EMPTY STOMACH') {
    const name = next === 'WITH FOOD' ? 'With Food' : 'Empty Stomach';
    return `Chewable then ${name} is not a supported order. Remove Chewable, select ${name}, then Chewable.`;
  }
  return `${next} is locked while Chewable is selected. Remove Chewable first.`;
}

/** Also reject incompatible/reversed selections restored from an older draft. */
function chewingProblem(instructions: string[]): string | null {
  const chewing = instructions.indexOf('CHEWABLE');
  if (chewing < 0) return null;
  for (const [code, name] of [['WITH FOOD', 'With Food'], ['EMPTY STOMACH', 'Empty Stomach']]) {
    const first = instructions.indexOf(code);
    if (first > chewing) return `Chewable then ${name} is not a supported order. Remove both, then tap ${name} first.`;
  }
  if (instructions.includes('WITH FOOD') && instructions.includes('EMPTY STOMACH')) return 'Choose either With Food or Empty Stomach before Chewable, not both.';
  if (instructions.includes('DISSOLVE AND DRINK') || instructions.includes('KEEP IN MOUTH')) return 'Chewable cannot be combined with Dissolve and Drink or Keep in Mouth.';
  return null;
}

function chewingCombinationText(instructions: string[]): string | null {
  const ch = instructions.indexOf('CHEWABLE');
  if (ch < 0 || chewingProblem(instructions)) return null;
  const action = instructions.includes('TAKE') ? 'take' : instructions.includes('GIVE') ? 'give' : null;
  if (!action) return null;
  if (instructions.indexOf('WITH FOOD') >= 0 && instructions.indexOf('WITH FOOD') < ch) {
    return `${SPEC_WITH_FOOD_CHEWABLE.word} ${SPEC_WITH_FOOD_CHEWABLE[action]}`;
  }
  if (instructions.indexOf('EMPTY STOMACH') >= 0 && instructions.indexOf('EMPTY STOMACH') < ch) {
    return `${SPEC_FORMS['EMPTY STOMACH'].word} ${SPEC_FORMS.CHEWABLE.word} ${SPEC_FORMS.CHEWABLE[action]}`;
  }
  return null;
}

/** Ordered Keep in Mouth policy shared by UI, store and restored-draft validation. */
export function keepInMouthSelectionRefusal(instructions: string[], next: string): string | null {
  if (instructions.includes(next)) return null;
  if (instructions.includes('EMPTY STOMACH') && next === 'WITH FOOD') return 'With Food is locked while Empty Stomach is selected.';
  if (next === 'KEEP IN MOUTH' && instructions.some(i => ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD'].includes(i))) return 'Remove the incompatible method before selecting Keep in Mouth.';
  if (instructions.includes('KEEP IN MOUTH') && ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH'].includes(next)) return 'Keep in Mouth locks this method. Select Empty Stomach before Keep in Mouth to combine them.';
  return null;
}

function keepInMouthProblem(instructions: string[]): string | null {
  const index = instructions.indexOf('KEEP IN MOUTH');
  if (index < 0) return null;
  if (instructions.indexOf('EMPTY STOMACH') > index) return 'Keep in Mouth then Empty Stomach is not supported. Select Empty Stomach first.';
  if (instructions.some(i => ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD'].includes(i))) return 'Keep in Mouth cannot be combined with Chewing, Dissolve and Drink or With Food.';
  return null;
}

function keepInMouthText(instructions: string[]): string | null {
  if (keepInMouthProblem(instructions)) return null;
  const action = instructions.includes('TAKE') ? 'take' : instructions.includes('GIVE') ? 'give' : null;
  if (!action) return null;
  const form = SPEC_FORMS['KEEP IN MOUTH'];
  if (instructions.includes('EMPTY STOMACH')) return `${SPEC_FORMS['EMPTY STOMACH'].word} ${form.word} ${form[action]}`;
  const timing = instructions.includes('BEFORE') ? 'BEFORE' : instructions.includes('AFTER') ? 'AFTER' : null;
  return timing ? `${form.word} ${form[action]} ${SPEC_MEAL} ${SPEC_TIMING[timing]}` : null;
}

const DISSOLVE_LOCKS = ['CHEWABLE', 'WITH FOOD', 'EMPTY STOMACH', 'KEEP IN MOUTH'];
export function withFoodSelectionRefusal(instructions: string[], next: string): string | null {
  if (next === 'WITH FOOD' && !instructions.includes(next) && instructions.includes('KEEP IN MOUTH')) return 'Remove Keep in Mouth before selecting With Food; these methods cannot be combined.';
  if (!instructions.includes('WITH FOOD') || instructions.includes(next)) return null;
  return next === 'EMPTY STOMACH' || next === 'KEEP IN MOUTH'
    ? `${next} is locked while With Food is selected. Remove With Food first.` : null;
}

function withFoodProblem(instructions: string[]): string | null {
  return instructions.includes('WITH FOOD') && (instructions.includes('EMPTY STOMACH') || instructions.includes('KEEP IN MOUTH'))
    ? 'With Food cannot be combined with Empty Stomach or Keep in Mouth.' : null;
}

export function dissolveSelectionRefusal(instructions: string[], next: string): string | null {
  if (next === 'DISSOLVE AND DRINK' && !instructions.includes(next) && instructions.includes('KEEP IN MOUTH')) {
    return 'Remove Keep in Mouth before selecting Dissolve and Drink; these methods cannot be combined.';
  }
  if (!instructions.includes('DISSOLVE AND DRINK') || instructions.includes(next) || !DISSOLVE_LOCKS.includes(next)) return null;
  return `${next} is locked while Dissolve and Drink is selected. Remove Dissolve and Drink first; select the meal condition before Dissolve and Drink to combine them.`;
}

function dissolveProblem(instructions: string[]): string | null {
  const index = instructions.indexOf('DISSOLVE AND DRINK');
  if (index < 0) return null;
  for (const code of ['WITH FOOD', 'EMPTY STOMACH']) {
    const name = code === 'WITH FOOD' ? 'With Food' : 'Empty Stomach';
    if (instructions.indexOf(code) > index) return `Dissolve and Drink then ${name} is not a supported order. Select the meal condition first.`;
  }
  if (instructions.includes('WITH FOOD') && instructions.includes('EMPTY STOMACH')) return 'Choose either With Food or Empty Stomach before Dissolve and Drink, not both.';
  if (instructions.includes('CHEWABLE') || instructions.includes('KEEP IN MOUTH')) return 'Dissolve and Drink cannot be combined with Chewable or Keep in Mouth.';
  return null;
}

function dissolveText(instructions: string[]): string | null {
  if (!instructions.includes('DISSOLVE AND DRINK') || dissolveProblem(instructions)) return null;
  const action = instructions.includes('TAKE') ? 'take' : instructions.includes('GIVE') ? 'give' : null;
  if (!action) return null;
  const form = SPEC_FORMS['DISSOLVE AND DRINK'];
  const meal = instructions.find(code => code === 'WITH FOOD' || code === 'EMPTY STOMACH');
  if (meal) return `${SPEC_FORMS[meal].word} ${form.word} ${form[action]}`;
  const timing = instructions.includes('BEFORE') ? 'BEFORE' : instructions.includes('AFTER') ? 'AFTER' : null;
  return timing ? `${form.word} ${form[action]} ${SPEC_MEAL} ${SPEC_TIMING[timing]}` : null;
}

/**
 * Schedule words from the sheets. Recorded for the mapping and the approval request; the sheets
 * give no complete sentence for Morning/Lunch/Night/Evening/Daily, so none is composed from them.
 */
export const SPEC_SCHEDULE_WORDS = {
  MORNING: 'උදේට',
  LUNCH: 'දවල්ට',
  NIGHT: null, // handwriting unclear (රැයට / රෑට?): not used until confirmed
  EVENING: 'හවසට',
  DAILY: 'දිනකට',
  '8H': 'පැය 8කට වරක්',
  '6H': 'පැය 6කට වරක්',
  '5H': 'පැය 5කට වරක්',
  STAT: 'පළමුව පමණක්', // confirmed by the owner (2026-10-11): full phrase පළමුව පමණක් ගන්න
  THEN: 'ඉන්පසු',
} as const;

/** Units on the interval sheet, derived from the catalogue resolver's single mapping. */
export const SPEC_UNITS = Object.values(PRODUCT_TYPES);

/** Interval buttons the Digital label sheet locks while Morning/Lunch/Night has a dose. */
export const DIGI_LABEL_LOCKS = ['6H', '8H', '5H', 'DAILY'];

// ---------------------------------------------------------------------------------------------
// Current wording (moved here unchanged from lib/labelBuilder.ts)
// ---------------------------------------------------------------------------------------------

const CATEGORY_MAP: Record<string, InstructionCategory> = {
  CHEWABLE: 'chewable',
  'DISSOLVE AND DRINK': 'dissolveAndDrink',
  'WITH FOOD': 'withFood',
  'EMPTY STOMACH': 'emptyStomach',
};
const ACTION_MAP: Record<string, AdminAction> = { TAKE: 'take', GIVE: 'give' };
const TIMING_MAP: Record<string, MealTiming> = { BEFORE: 'before', AFTER: 'after' };

function usbActionProblem(instructions: string[]): string | null {
  return instructions.includes('TAKE') && instructions.includes('GIVE')
    ? 'Choose either TAKE or GIVE, not both. Remove one action.' : null;
}

/** The administration sentence the workstation prints today. */
export function currentAdministrationText(instructions: string[]): string | null {
  if (usbActionProblem(instructions)) return null;
  if (instructions.includes('KEEP IN MOUTH')) return keepInMouthText(instructions);
  if (withFoodProblem(instructions)) return null;
  if (chewingProblem(instructions)) return null;
  if (instructions.includes('DISSOLVE AND DRINK')) return dissolveText(instructions);
  const combined = chewingCombinationText(instructions);
  if (combined) return combined;
  if (instructions.includes('CHEWABLE') && (instructions.includes('WITH FOOD') || instructions.includes('EMPTY STOMACH'))) return null;
  const category = instructions.find((i) => CATEGORY_MAP[i]);
  const action = instructions.find((i) => ACTION_MAP[i]);
  const timing = instructions.find((i) => TIMING_MAP[i]);

  if (category && action) {
    return getInstruction(CATEGORY_MAP[category], ACTION_MAP[action], timing ? TIMING_MAP[timing] : undefined);
  }
  if (category === 'EMPTY STOMACH') return null;
  if (action && timing) {
    return getNormalInstruction(ACTION_MAP[action], TIMING_MAP[timing]);
  }
  if (category === 'WITH FOOD') return null;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Workflow analysis
// ---------------------------------------------------------------------------------------------

export type Workflow =
  | 'NONE'
  | 'NAB'
  | 'CHEWABLE'
  | 'KEEP IN MOUTH'
  | 'EMPTY STOMACH + KEEP IN MOUTH'
  | 'DISSOLVE AND DRINK'
  | 'EMPTY STOMACH'
  | 'WITH FOOD'
  | 'WITH FOOD + CHEWABLE'
  | 'EMPTY STOMACH + CHEWABLE'
  | 'WITH FOOD + DISSOLVE AND DRINK'
  | 'EMPTY STOMACH + DISSOLVE AND DRINK';

export type MissingInput = 'TAKE_OR_GIVE' | 'BEFORE_OR_AFTER' | 'QUANTITY';

/** Interval and daily buttons that need a quantity per dose (8H/6H/5H and Evening/Daily sheets). */
export const QUANTITY_CODES = ['4H', 'CUSTOM', '5H', '6H', '8H', 'DAILY', 'EVENING'];

export type AdministrationAnalysis = {
  workflow: Workflow;
  /** empty: nothing chosen · incomplete: a required step is missing · complete · invalid: a rule is broken. */
  status: 'empty' | 'incomplete' | 'complete' | 'invalid';
  missing: MissingInput[];
  /** Plain-English next action for staff, or null when nothing is required. */
  nextStep: string | null;
  /** Rule problems that must be fixed before DONE. */
  problems: string[];
  /** Sentence printed under the active wording; null until the workflow is complete. */
  text: string | null;
  /** Both wordings, for review screens and documents. */
  currentText: string | null;
  specText: string | null;
};

type DoseRows = { morning: { qty: number }; lunch: { qty: number }; night: { qty: number } };

function workflowOf(instructions: string[]): Workflow {
  if (instructions.includes('KEEP IN MOUTH') && instructions.indexOf('EMPTY STOMACH') >= 0 && instructions.indexOf('EMPTY STOMACH') < instructions.indexOf('KEEP IN MOUTH')) return 'EMPTY STOMACH + KEEP IN MOUTH';
  const forms = instructions.filter((i) => i in SPEC_FORMS);
  const wf = instructions.indexOf('WITH FOOD');
  const ch = instructions.indexOf('CHEWABLE');
  if (wf >= 0 && ch > wf) return 'WITH FOOD + CHEWABLE';
  const es = instructions.indexOf('EMPTY STOMACH');
  if (es >= 0 && ch > es) return 'EMPTY STOMACH + CHEWABLE';
  const dissolve = instructions.indexOf('DISSOLVE AND DRINK');
  if (wf >= 0 && dissolve > wf) return 'WITH FOOD + DISSOLVE AND DRINK';
  if (es >= 0 && dissolve > es) return 'EMPTY STOMACH + DISSOLVE AND DRINK';
  if (forms.length > 0) return forms[0] as Workflow;
  if (instructions.some((i) => i === 'TAKE' || i === 'GIVE' || i === 'BEFORE' || i === 'AFTER')) return 'NAB';
  return 'NONE';
}

/** The administration sentence in the spec's wording, or null while a step is missing. */
export function specAdministrationText(instructions: string[]): string | null {
  if (usbActionProblem(instructions)) return null;
  if (instructions.includes('KEEP IN MOUTH')) return keepInMouthText(instructions);
  if (withFoodProblem(instructions)) return null;
  if (chewingProblem(instructions)) return null;
  if (instructions.includes('DISSOLVE AND DRINK')) return dissolveText(instructions);
  const action = instructions.includes('TAKE') ? 'take' : instructions.includes('GIVE') ? 'give' : null;
  const timing = instructions.includes('BEFORE') ? 'BEFORE' : instructions.includes('AFTER') ? 'AFTER' : null;
  const workflow = workflowOf(instructions);
  if (!action || workflow === 'NONE') return null;

  if (workflow === 'WITH FOOD + CHEWABLE' || workflow === 'EMPTY STOMACH + CHEWABLE') {
    return chewingCombinationText(instructions);
  }
  if (workflow === 'NAB') {
    return timing ? `${SPEC_NAB[action]} ${SPEC_MEAL} ${SPEC_TIMING[timing]}` : null;
  }
  const form = SPEC_FORMS[workflow];
  if (!form.timing) return `${form.word} ${form[action]}`;
  return timing ? `${form.word} ${form[action]} ${SPEC_MEAL} ${SPEC_TIMING[timing]}` : null;
}

function timingRequired(workflow: Workflow, mode: WordingMode): boolean {
  if (workflow === 'WITH FOOD + DISSOLVE AND DRINK' || workflow === 'EMPTY STOMACH + DISSOLVE AND DRINK') return false;
  if (workflow === 'EMPTY STOMACH + KEEP IN MOUTH') return false;
  if (workflow === 'KEEP IN MOUTH' || workflow === 'NAB') return true;
  if (workflow === 'WITH FOOD + CHEWABLE' || workflow === 'EMPTY STOMACH + CHEWABLE' || workflow === 'NONE') return false;
  if (mode === 'current') return workflow === 'CHEWABLE' || workflow === 'DISSOLVE AND DRINK';
  return SPEC_FORMS[workflow].timing;
}

/**
 * Where a label's administration instruction stands: which workflow, what is missing, what is
 * wrong, and the sentence to print. The workstation, DONE validation and the label builder all
 * read this, so they cannot disagree.
 */
export function analyseAdministration(
  instructions: string[],
  dosage?: DoseRows | null,
  mode: WordingMode = getWordingMode(),
  /** Quantity per dose for an interval/daily button. Omit when not known (no quantity check). */
  frequencyQty?: number,
): AdministrationAnalysis {
  const workflow = workflowOf(instructions);
  const hasAction = instructions.includes('TAKE') || instructions.includes('GIVE');
  const hasTiming = instructions.includes('BEFORE') || instructions.includes('AFTER');

  const missing: MissingInput[] = [];
  const problems: string[] = [];
  const eodError = eodProblem({ additionalInstructions: instructions, dosage, frequencyDosage: frequencyQty === undefined ? undefined : { qty: frequencyQty } });
  if (eodError) problems.push(eodError);
  const intervalError = intervalProblem({ additionalInstructions: instructions, dosage, frequencyDosage: frequencyQty === undefined ? undefined : { qty: frequencyQty } });
  // Omitted quantity means analysis only; actual labels always supply it.
  if (intervalError && !intervalError.includes('quantity')) problems.push(intervalError);
  const actionError = usbActionProblem(instructions);
  if (actionError) problems.push(actionError);
  const withFoodError = withFoodProblem(instructions);
  if (withFoodError) problems.push(withFoodError);
  const mouthError = keepInMouthProblem(instructions);
  if (mouthError) problems.push(mouthError);
  const chewingError = chewingProblem(instructions);
  if (chewingError) problems.push(chewingError);
  const dissolveError = dissolveProblem(instructions);
  if (dissolveError) problems.push(dissolveError);

  const quantityCode = instructions.find((i) => QUANTITY_CODES.includes(i));
  const hasDose = Boolean(dosage && (dosage.morning.qty > 0 || dosage.lunch.qty > 0 || dosage.night.qty > 0));
  // Oral doses and supported interval/daily schedules require the existing NAB/OAB workflow.
  // Text-only labels, ENT and the separate STAT workflow keep their existing requirements.
  const oralSchedule = !readEnt(instructions) && (hasDose || instructions.some(i => ['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY'].includes(i)));
  const scheduleNeedsAdministration = oralSchedule || (mode === 'spec' && (hasDose || Boolean(quantityCode)));

  if (workflow !== 'NONE' || scheduleNeedsAdministration) {
    if (!hasAction) missing.push('TAKE_OR_GIVE');
    if ((timingRequired(workflow, mode) || (oralSchedule && workflow === 'NONE')) && !hasTiming) missing.push('BEFORE_OR_AFTER');
  }
  // An interval or daily button prints only with a quantity per dose ("Select Qty").
  if (quantityCode && frequencyQty !== undefined && (!Number.isFinite(frequencyQty) || !(frequencyQty > 0))) {
    missing.unshift('QUANTITY');
  }

  if (mode === 'spec') {
    const locked = instructions.filter((i) => DIGI_LABEL_LOCKS.includes(i));
    if (hasDose && locked.length > 0) {
      problems.push(`${locked.join(', ')} cannot be used with a Morning/Lunch/Night dose.`);
    }
  }

  const currentText = currentAdministrationText(instructions);
  const specText = specAdministrationText(instructions);

  let status: AdministrationAnalysis['status'];
  if (problems.length > 0) status = 'invalid';
  else if (missing.length > 0) status = 'incomplete';
  else if (workflow === 'NONE') status = 'empty';
  else status = 'complete';

  let nextStep: string | null = null;
  if (status === 'invalid') nextStep = problems[0];
  else if (missing.includes('QUANTITY')) nextStep = `Enter the quantity for ${quantityCode}`;
  else if (missing.includes('TAKE_OR_GIVE')) nextStep = 'Choose TAKE or GIVE';
  else if (missing.includes('BEFORE_OR_AFTER')) nextStep = 'Choose BEFORE or AFTER';

  return {
    workflow,
    status,
    missing,
    nextStep,
    problems,
    // Never a sentence for an unfinished or invalid instruction.
    text: status === 'complete' ? (mode === 'spec' ? specText : currentText) : null,
    currentText,
    specText,
  };
}

/** Form buttons that hold their own timing under the active wording (BEFORE/AFTER locked). */
export function timingLockingInstructions(mode: WordingMode = getWordingMode()): string[] {
  return mode === 'spec'
    ? Object.entries(SPEC_FORMS).filter(([, f]) => !f.timing).map(([k]) => k)
    : ['WITH FOOD', 'EMPTY STOMACH'];
}

/** STAT uses the existing administration checks for its actual follow-up, never metadata alone. */
export function statPrintError(label: StatState, pending = false): string | null {
  if (pending) return 'Confirm or cancel the STAT quantity first.';
  if (!label.stat && !label.additionalInstructions?.includes('STAT')) return null;
  const problem = statProblem(label);
  if (problem) return problem;
  const codes = label.additionalInstructions ?? [];
  const eodError = eodPrintError(label);
  if (eodError) return eodError;
  if (readEnt(codes)) return null;
  const rows = label.dosage;
  const dosage = rows ? { morning: rows.morning ?? { qty: 0 }, lunch: rows.lunch ?? { qty: 0 }, night: rows.night ?? { qty: 0 } } : undefined;
  const analysis = analyseAdministration(codes, dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** EOD-only is complete text; combined schedules reuse the administration engine. */
export function eodPrintError(label: EodState): string | null {
  if (!label.additionalInstructions?.includes('EOD')) return null;
  const problem = eodProblem(label);
  if (problem || readEnt(label.additionalInstructions)) return problem;
  const rows = label.dosage;
  const dosage = rows ? { morning: rows.morning ?? { qty: 0 }, lunch: rows.lunch ?? { qty: 0 }, night: rows.night ?? { qty: 0 } } : undefined;
  const analysis = analyseAdministration(label.additionalInstructions, dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** USB checks reuse the same administration analysis as DONE and the preview. */
export function usbPrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  // ENT has its own units/actions. Text-only and STAT-only labels keep their separate workflows.
  if (readEnt(label.additionalInstructions)) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  const oralSchedule = Boolean(label.dosage && Object.values(label.dosage).some(d => d.qty > 0))
    || label.additionalInstructions.some(i => ['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY'].includes(i));
  if (analysis.workflow === 'NONE' && !oralSchedule) return null;
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Reuse the same Chewing validation at review and at the final print action. */
export function chewingPrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  if (!label.additionalInstructions.includes('CHEWABLE')) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Dissolve uses the existing workflow analysis at both Save and Print entry points. */
export function dissolvePrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  if (!label.additionalInstructions.includes('DISSOLVE AND DRINK')) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Reuse administration analysis at completed Save and Print boundaries. */
export function keepInMouthPrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  if (!label.additionalInstructions.includes('KEEP IN MOUTH')) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Reuse administration analysis for Empty Stomach at completed Save and Print boundaries. */
export function emptyStomachPrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  if (!label.additionalInstructions.includes('EMPTY STOMACH')) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Reuse administration analysis for With Food at completed Save and Print entry points. */
export function withFoodPrintError(label: { additionalInstructions: string[]; dosage?: DoseRows | null; frequencyDosage?: { qty: number } | null }): string | null {
  if (!label.additionalInstructions.includes('WITH FOOD')) return null;
  const analysis = analyseAdministration(label.additionalInstructions, label.dosage, undefined, label.frequencyDosage?.qty);
  return analysis.status === 'invalid' || analysis.status === 'incomplete' ? analysis.nextStep : null;
}

/** Form buttons that replace one another under the active wording. */
export function formInstructions(mode: WordingMode = getWordingMode()): string[] {
  return mode === 'spec'
    ? Object.keys(SPEC_FORMS)
    : ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH', 'KEEP IN MOUTH'];
}

// ---------------------------------------------------------------------------------------------
// Owner-approved phrases (2026-10-11). Exact text; nothing is built around them that the owner
// did not give. The pharmacist still verifies their clinical use before live dispensing.
// ---------------------------------------------------------------------------------------------

export const OWNER_APPROVED = {
  /** STAT dose, TAKE. */
  STAT_TAKE: STAT_TAKE_TEXT,
  /** Morning, Lunch and Night all given (owner's example: 1, 1, 1). */
  DAILY_THREE_TIMES_TAKE: 'දිනපතා 3 වරක් ගන්න',
  /** Sheet 6: printed after the STAT instruction, before what follows it. */
  THEN: STAT_THEN_TEXT,
} as const;

/** Stable identifiers for generated instructions (for tests, documents and records). */
export type InstructionId = 'STAT_TAKE' | 'DAILY_THREE_TIMES_TAKE';

export type PhraseAnalysis = {
  /** none: nothing to say · complete: approved text · incomplete: a step is missing ·
   *  unapproved: the selection is valid but no approved wording exists yet. */
  status: 'none' | 'complete' | 'incomplete' | 'unapproved';
  id: InstructionId | null;
  text: string | null;
  /** What staff should do next, or why there is no text. */
  message: string | null;
};

type Rows = { morning: { qty: number }; lunch: { qty: number }; night: { qty: number } };

const PERIOD_NAMES = { morning: 'Morning', lunch: 'Lunch', night: 'Night' } as const;

/**
 * Morning / Lunch / Night frequency sentence. Only the owner-approved case is generated: all
 * three periods given, with the same quantity each time, and no GIVE or form instruction (the
 * approved phrase says ගන්න). The quantities themselves stay on the label's dose rows; this
 * sentence is about frequency only and never totals tablets.
 */
export function analyseDailySchedule(rows: Rows | null | undefined, instructions: string[]): PhraseAnalysis {
  if (!rows) return { status: 'none', id: null, text: null, message: null };
  const active = (Object.keys(PERIOD_NAMES) as (keyof Rows)[]).filter((k) => rows[k].qty > 0);
  if (active.length === 0) return { status: 'none', id: null, text: null, message: null };

  const describe = active.map((k) => `${PERIOD_NAMES[k]} ${rows[k].qty}`).join(', ');
  const unapproved = (why: string): PhraseAnalysis => ({
    status: 'unapproved',
    id: null,
    text: null,
    message: `No approved Sinhala wording for ${describe}${why}. Awaiting pharmacist.`,
  });

  if (active.length < 3) return unapproved('');
  const quantities = new Set(active.map((k) => rows[k].qty));
  if (quantities.size > 1) return unapproved(' (different quantities)');
  if (instructions.includes('GIVE')) return unapproved(' with GIVE');
  const form = instructions.find((i) => i in SPEC_FORMS);
  if (form) return unapproved(` with ${form.toLowerCase()}`);

  return { status: 'complete', id: 'DAILY_THREE_TIMES_TAKE', text: OWNER_APPROVED.DAILY_THREE_TIMES_TAKE, message: null };
}

/**
 * The STAT dose's own administration (STAT sheet: STAT → Qty → NAB/OAB → Enter). Approved:
 * TAKE alone → පළමුව පමණක් ගන්න. GIVE, BEFORE/AFTER and forms are valid choices with no
 * approved wording yet.
 */
export function analyseStat(stat: { qty: number; administration?: string[] } | null | undefined): PhraseAnalysis {
  if (!stat) return { status: 'none', id: null, text: null, message: null };
  if (!(stat.qty > 0)) {
    return { status: 'incomplete', id: null, text: null, message: 'Enter the STAT quantity' };
  }
  const admin = stat.administration ?? [];
  if (!admin.includes('TAKE') && !admin.includes('GIVE')) {
    return { status: 'incomplete', id: null, text: null, message: 'Choose TAKE or GIVE for the STAT dose' };
  }
  if (admin.length === 1 && admin[0] === 'TAKE') {
    return { status: 'complete', id: 'STAT_TAKE', text: OWNER_APPROVED.STAT_TAKE, message: null };
  }
  return {
    status: 'unapproved',
    id: null,
    text: null,
    message: `No approved Sinhala wording for STAT with ${admin.join(' + ')}. Awaiting pharmacist.`,
  };
}

export type LabelReadiness = {
  administration: AdministrationAnalysis;
  daily: PhraseAnalysis;
  stat: PhraseAnalysis;
  /** Why DONE must refuse this label, or null. */
  blocking: string | null;
  /** Shown to staff but not blocking (e.g. no approved daily wording yet). */
  notices: string[];
};

/**
 * Everything DONE and the workstation need to know about one label. Under the default wording
 * this adds nothing to today's checks except the interval quantity. Under the spec wording a
 * STAT dose must also have its own approved administration.
 */
export function analyseLabel(
  label: {
    reasons?: string[];
    reason?: string | null;
    reasonsConfirmed?: boolean;
    reasonsEditPending?: boolean;
    selectedDaysOfWeek?: string[];
    daysConfirmed?: boolean;
    weekdayRange?: WeekdayRange | null;
    product?: { product_type?: string | null } | null;
    additionalInstructions: string[];
    dosage?: Rows | null;
    weeklyDosage?: WeeklyState['weeklyDosage'];
    frequencyDosage?: { qty: number } | null;
    stat?: { qty: number; administration?: string[] } | null;
  },
  mode: WordingMode = getWordingMode(),
): LabelReadiness {
  const administration = analyseAdministration(label.additionalInstructions, label.dosage, mode, label.frequencyDosage?.qty);
  const daily = analyseDailySchedule(label.dosage, label.additionalInstructions);
  const stat = analyseStat(label.stat);

  let blocking: string | null = null;
  if (administration.status === 'incomplete' || administration.status === 'invalid') blocking = administration.nextStep;
  else if (statProblem(label)) blocking = statProblem(label);

  const ent = readEnt(label.additionalInstructions);
  if (ent) {
    const frequency = label.additionalInstructions.find(i => QUANTITY_CODES.includes(i));
    const hasDaily = Object.values(label.dosage || {}).some(d => d.qty > 0);
    blocking = validateEnt(ent);
    if (!blocking && frequency === 'CUSTOM' && !ent.customHours) blocking = 'Set custom ENT hours.';
    if (!blocking && frequency && hasDaily) blocking = 'Choose either Morning/Lunch/Night or a frequency for ENT.';
    if (!blocking && frequency && !(label.frequencyDosage && label.frequencyDosage.qty > 0)) blocking = 'Enter the ENT quantity per dose.';
    if (!blocking && !frequency && !hasDaily) blocking = 'Enter a Morning, Lunch or Night quantity for ENT.';
    if (!blocking) blocking = statProblem(label);
  }
  const typePrinting = productTypePrinting(label);
  const notices = !ent && !typePrinting.prefix && mode === 'spec' && daily.status === 'unapproved' && daily.message ? [daily.message] : [];
  blocking = reasonStateProblem(label) ?? daysProblem(label) ?? blocking ?? weeklyProblem(label) ?? dailyProblem(label) ?? eveningProblem(label) ?? digitalProblem(label) ?? intervalProblem(label) ?? eodProblem(label) ?? typePrinting.error;
  return { administration, daily, stat, blocking, notices };
}

/** Interval completion uses the same readiness analysis as DONE, including ENT and product type. */
export function intervalPrintError(label: Omit<IntervalState, 'dosage'> & { dosage?: Rows | null; additionalInstructions: string[]; product?: { product_type?: string | null } | null }): string | null {
  if (!label.additionalInstructions.some(i => INTERVAL_CODES.includes(i))) return null;
  return analyseLabel(label).blocking;
}

/** Digital completion shares DONE readiness, including product type and all existing SAM rules. */
export function digitalPrintError(label: DigitalState & { dosage?: Rows | null; additionalInstructions: string[]; product?: { product_type?: string | null } | null }): string | null {
  const problem = digitalProblem(label);
  if (problem) return problem;
  if (readEnt(label.additionalInstructions) || !Object.values(label.dosage ?? {}).some(dose => dose.qty !== 0)) return null;
  return analyseLabel(label).blocking;
}

export function eveningPrintError(label: EveningState & { dosage?: Rows | null; additionalInstructions: string[]; product?: { product_type?: string | null } | null }): string | null {
  if (readEnt(label.additionalInstructions) || !label.additionalInstructions.includes('EVENING')) return null;
  return eveningProblem(label) ?? analyseLabel(label).blocking;
}

export function dailyPrintError(label: DailyState & { dosage?: Rows | null; additionalInstructions: string[]; product?: { product_type?: string | null } | null }): string | null {
  if (readEnt(label.additionalInstructions) || !label.additionalInstructions.includes('DAILY')) return null;
  return dailyProblem(label) ?? analyseLabel(label).blocking;
}

export function weeklyPrintError(label: WeeklyState & { dosage?: Rows | null; additionalInstructions: string[]; product?: { product_type?: string | null } | null }, editing = false): string | null {
  if (readEnt(label.additionalInstructions) || !label.additionalInstructions.includes('WEEKLY')) return null;
  if (editing) return 'Confirm or cancel the Weekly quantity edit first.';
  return eodProblem(label) ?? weeklyProblem(label) ?? analyseLabel(label).blocking;
}

export function daysPrintError(label: Parameters<typeof analyseLabel>[0], editing = false): string | null {
  if (editing) return 'Confirm or cancel Name of Days first.';
  if (!label.selectedDaysOfWeek?.length && !hasWeekdayRange(label)) return null;
  return daysProblem(label) ?? analyseLabel(label).blocking;
}
