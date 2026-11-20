import { reasonSelectionRefusal, reasonValuesProblem, selectedReasonTexts } from '../lib/reasons';
import { daySelectionRefusal, dayValuesProblem, DAY_NAMES, RANGE_CODE, LEGACY_RANGE_CODES, hasWeekdayRange, rangeSelectionRefusal, validWeekday, type WeekdayRange } from '../lib/nameOfDays';
import { weeklySelectionRefusal } from '../lib/weeklyPolicy';
import { dailySelectionRefusal } from '../lib/dailyPolicy';
import { eveningSelectionRefusal } from '../lib/eveningPolicy';
import { digitalSelectionRefusal } from '../lib/digitalSchedule';
import { intervalSelectionRefusal } from '../lib/intervalPolicy';
import { statSelectionRefusal } from '../lib/statPolicy';
import { eodSelectionRefusal } from '../lib/eod';
import { stepDosage } from '../lib/dosageQuantity';
import { EXPIRY_CODE, isCalendarDate, type ExpiryBatch } from '../lib/batchExpiry';
﻿import { ENT_PREFIX, readEnt, type EntSelection } from '../lib/ent';
import { create } from 'zustand';
import { DIGI_LABEL_LOCKS, chewingSelectionRefusal, dissolveSelectionRefusal, withFoodSelectionRefusal, keepInMouthSelectionRefusal, formInstructions, getWordingMode, QUANTITY_CODES, timingLockingInstructions } from '../lib/instructionEngine';

export type ActiveControl =
  | "ent"
  | "idle"
  | "phone_search"
  | "product_quantity"
  | "days"
  | "morning"
  | "lunch"
  | "night"
  | "morning_fraction"
  | "lunch_fraction"
  | "night_fraction"
  | "stat_fraction"
  | "stat"
  | "stat_followup"
  | "stat_admin"
  | "alternative_product"
  | "reasons"
  | "days_of_week"
  | "weekly"
  | "weekly_fraction"
  | "frequency"
  | "frequency_fraction"
  | "expiry_date";

export type DosageEntry = { qty: number; isFraction: boolean; confirmed?: boolean };

export type StatEntry = {
  qty: number;
  isFraction: boolean;
  followUp: string | null;
  /** The STAT dose's own TAKE/GIVE/BEFORE/AFTER (STAT sheet; spec wording only). Not sent to the API. */
  administration?: string[];
};

/** Product chosen for a label. `expiry_date` is only present when it came from the product's API record. */
export type SelectedProduct = {
  id: string;
  name: string;
  expiry_date?: string | null;
  unit_of_measure?: string;
  /** Original catalogue value; the UI derives its Sinhala indicator without assuming a default. */
  product_type?: string | null;
};

export interface StepDoseStage {
  id: string;
  dosageText: string;
  instructionText: string;
  days: number;
  quantity?: number;
  frequency?: string;
  dosage?: {
    morning?: number;
    lunch?: number;
    night?: number;
    evening?: number;
  };
  additionalInstructions?: string[];
}

export interface ProductInfoData {
  id: string;
  name: string;
  stock_quantity?: number | null;
  pack_size?: number | null;
  product_type?: string | null;
  expiry_date?: string | null;
}

export interface LabelData {
  id: string;
  product: SelectedProduct | null;
  productQuantity: number | null;
  alternativeProductName: string;
  dosage: {
    morning: DosageEntry;
    lunch: DosageEntry;
    night: DosageEntry;
  };
  weeklyDosage?: DosageEntry;
  frequencyDosage: DosageEntry;
  stat: StatEntry | null;
  days: number | null;
  additionalInstructions: string[];
  selectedDaysOfWeek: string[];
  daysConfirmed?: boolean;
  weekdayRange?: WeekdayRange | null;
  reason: string | null;
  reasons: string[];
  reasonsConfirmed?: boolean;
  reasonsEditPending?: boolean;
  expiryDate: string | null;
  /** GRN batch the printed expiry came from (Add Expiry Date). */
  expiryBatch?: ExpiryBatch | null;
  showAddress: boolean;
}

export function createDefaultLabel(id?: string): LabelData {
  return {
    id: id || `label_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    product: null,
    productQuantity: null,
    alternativeProductName: '',
    dosage: {
      morning: { qty: 0, isFraction: false },
      lunch: { qty: 0, isFraction: false },
      night: { qty: 0, isFraction: false },
    },
    weeklyDosage: { qty: 0, isFraction: false },
    frequencyDosage: { qty: 0, isFraction: false },
    stat: null,
    days: null,
    additionalInstructions: [],
    selectedDaysOfWeek: [],
    daysConfirmed: false,
    weekdayRange: null,
    reason: null,
    reasons: [],
    reasonsConfirmed: false,
    reasonsEditPending: false,
    expiryDate: null,
    expiryBatch: null,
    showAddress: true,
  };
}

export const CALENDAR_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

/** Frequency buttons, as recognised by the label builder. Only one is kept per label. */
export const FREQUENCY_CODES = ['4H', 'CUSTOM', 'SOS', '6H', '8H', '5H', 'DAILY', 'EVENING'];

/**
 * Medicine-form / meal instructions. The label builder turns exactly one of these into the
 * Sinhala sentence, so only one is kept per label (selecting another replaces it, visibly).
 */
export const FORM_INSTRUCTIONS = ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH'];

/** Form instructions whose approved Sinhala text has no BEFORE / AFTER variant. */
export const TIMING_LOCKING_INSTRUCTIONS = ['WITH FOOD', 'EMPTY STOMACH'];

/** Frequencies that contradict WEEKLY. Shown as a warning; never resolved automatically. */
const WEEKLY_CONFLICTS = ['4H', 'CUSTOM', '5H', '6H', '8H', 'EOD'];

/**
 * Contradictions the workstation can see but must not resolve on its own. The pharmacist
 * decides; these are shown next to the selected instructions.
 */
export function findInstructionConflicts(instructions: string[]): string[] {
  const conflicts: string[] = [];
  if (instructions.includes('WEEKLY')) {
    const clash = instructions.filter((i) => WEEKLY_CONFLICTS.includes(i));
    if (clash.length > 0) {
      conflicts.push(`WEEKLY and ${clash.join(', ')} are both selected. Check the frequency.`);
    }
  }
  return conflicts;
}

type NumberPadState = {
  visible: boolean;
  buffer: string;
  targetControl: ActiveControl | null;
  /** Why the last ENTER was refused. Cleared on the next key. */
  error?: string | null;
};

export type StoreState = {
  // Session & Multi-label State
  customerName: string;
  customerPhone: string;
  labels: LabelData[];
  activeLabelIndex: number;

  // Active Label Conveniences (synced with labels[activeLabelIndex])
  product: SelectedProduct | null;
  productQuantity: number | null;
  alternativeProductName: string;
  dosage: {
    morning: DosageEntry;
    lunch: DosageEntry;
    night: DosageEntry;
  };
  frequencyDosage: DosageEntry;
  stat: StatEntry | null;
  days: number | null;
  additionalInstructions: string[];
  selectedDaysOfWeek: string[];
  daysConfirmed?: boolean;
  weekdayRange?: WeekdayRange | null;
  reason: string | null;
  reasons: string[];
  expiryDate: string | null;
  expiryBatch: ExpiryBatch | null;
  showAddress: boolean;

  weeklyDosage: DosageEntry;
  // UI Panels & Modals State
  activeControl: ActiveControl;
  customerSearchVisible: boolean;
  productInfoPopupVisible: boolean;
  productInfoData: ProductInfoData | null;
  deleteLabelModalVisible: boolean;
  expDateModalVisible: boolean;
  numberPad: NumberPadState;
  /** The STAT dose as it was when the STAT panel opened; Cancel puts it back. */
  statBeforeEdit: StatEntry | null;
  /** The days of the week as they were when the panel opened; Cancel puts them back. */
  daysOfWeekBeforeEdit: string[] | null;
  daysConfirmedBeforeEdit?: boolean;
  rangeEndpoint?: 'start' | 'end';
  weekdayRangeBeforeEdit?: WeekdayRange | null;
  /** Why the last instruction tap was refused (spec workflow rules). Cleared on the next tap. */
  workflowNotice: string | null;

  // Mutators & Actions
  setEnt: (selection: EntSelection | null) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setProduct: (product: SelectedProduct | null) => void;
  /** Restore a serialized label draft for editing, including its product record. */
  restoreLabel: (label: LabelData) => void;
  setAlternativeProductName: (name: string) => void;
  setProductQuantity: (qty: number | null) => void;
  reasonCatalogue: string[] | null;
  setReasonCatalogue: (reasons: string[] | null) => void;
  reasonsBeforeEdit?: Pick<LabelData, 'reason' | 'reasons' | 'reasonsConfirmed' | 'reasonsEditPending'> | null;
  cancelReasonsPanel: () => void;
  setReason: (reason: string | null) => void;
  setReasons: (reasons: string[]) => void;
  toggleReason: (reason: string) => void;
  clearReasons: () => void;
  openReasonsPanel: () => void;
  closeReasonsPanel: () => void;
  /**
   * Prints this batch's GRN expiry on the active label (Add Expiry Date). Refused when the batch
   * is not of the label's medicine or its date is not a calendar date. Returns whether it was applied.
   */
  setExpiryBatch: (batch: ExpiryBatch) => boolean;
  /** Removes the expiry date and the Add Expiry Date selection from the active label. */
  clearExpiry: () => void;
  toggleShowAddress: () => void;
  incrementDays: () => void;
  decrementDays: () => void;

  // Multi-label Management
  addLabel: () => void;
  selectLabel: (index: number) => void;
  openDeleteLabelModal: () => void;
  closeDeleteLabelModal: () => void;
  confirmDeleteActiveLabel: () => void;
  openExpDateModal: () => void;
  closeExpDateModal: () => void;

  // UI Control Actions
  setActiveControl: (control: ActiveControl) => void;
  setCustomerSearchVisible: (visible: boolean) => void;
  openProductInfoPopup: (data: ProductInfoData) => void;
  closeProductInfoPopup: () => void;
  openNumberPad: (targetControl: ActiveControl) => void;
  clearDosage: (target: 'morning' | 'lunch' | 'night') => void;
  incrementDosage: (target: 'morning' | 'lunch' | 'night' | 'stat') => void;
  decrementDosage: (target: 'morning' | 'lunch' | 'night' | 'stat') => void;
  confirmWeekly: () => void;
  incrementWeeklyDosage: () => void;
  decrementWeeklyDosage: () => void;
  confirmDaily: () => void;
  confirmEvening: () => void;
  incrementFrequencyDosage: () => void;
  decrementFrequencyDosage: () => void;
  appendDigit: (digit: string) => void;
  appendFraction: (fraction: string) => void;
  setQuickFraction: (fractionStr: string) => void;
  backspace: () => void;
  clearNumberPadBuffer: () => void;
  confirmNumberPad: () => void;
  cancelNumberPad: () => void;
  toggleAdditionalInstruction: (instruction: string) => void;
  clearLabelInstructions: () => void;

  // Days of week
  openDaysOfWeekPanel: (endpoint?: 'start' | 'end') => void;
  toggleWeekdayRange: () => void;
  closeDaysOfWeekPanel: () => void;
  removeDaysOfWeek: () => void;
  cancelDaysOfWeekPanel: () => void;
  toggleDayOfWeek: (day: string) => void;
  setDaysOfWeek: (days: string[]) => void;

  // Stat Flow
  startStat: () => void;
  cancelStat: () => void;
  doneStat: () => void;
  setStatFollowUp: (followUp: string) => void;
  removeStat: () => void;
  toggleStatAdministration: (code: 'TAKE' | 'GIVE' | 'BEFORE' | 'AFTER') => void;
  confirmStatAdministration: () => void;
  backToStatQuantity: () => void;

  // Resets
  allClear: () => void;
  resetActiveLabel: () => void;
};

// Helper to parse number pad buffer into qty and isFraction
export function parseQty(buffer: string): { qty: number; isFraction: boolean } {
  const trimmed = buffer.trim();
  if (!trimmed) {
    return { qty: 0, isFraction: false };
  }

  if (trimmed.includes('/')) {
    const parts = trimmed.split(' ');
    let whole = 0;
    let fracStr = trimmed;

    if (parts.length === 2) {
      whole = parseInt(parts[0], 10) || 0;
      fracStr = parts[1];
    }

    const [num, den] = fracStr.split('/');
    const numerator = parseInt(num, 10) || 0;
    const denominator = parseInt(den, 10) || 1;
    const fraction = denominator !== 0 ? numerator / denominator : 0;

    return { qty: whole + fraction, isFraction: true };
  }

  return { qty: parseFloat(trimmed) || 0, isFraction: false };
}

const WHOLE_NUMBER = /^\d+$/;
const DECIMAL_NUMBER = /^\d+\.\d+$/;
const FRACTION_NUMBER = /^(\d+ )?\d+\/\d+$/;

export function isFractionTarget(target: ActiveControl | null): boolean {
  return Boolean(target && target.endsWith('_fraction'));
}

/**
 * Checks a number-pad entry before it is applied. Returns the message to show, or null when
 * the entry can be used. Nothing is rounded or reinterpreted: an entry that cannot be read
 * exactly as typed is refused.
 */
export function validateQtyEntry(buffer: string, target: ActiveControl | null): string | null {
  const text = buffer.trim();
  if (!text) return null;

  const isFraction = FRACTION_NUMBER.test(text);
  if (!WHOLE_NUMBER.test(text) && !DECIMAL_NUMBER.test(text) && !isFraction) {
    return 'Not a number. Enter a whole number or a fraction such as 1/2.';
  }

  if (isFraction) {
    const [num, den] = text.split(' ').pop()!.split('/').map(Number);
    if (den === 0) return 'The number below the line cannot be 0.';
    if (isFractionTarget(target) && (num === 0 || num >= den || text.includes(' '))) {
      return 'X/Y must be a fraction smaller than 1, such as 1/4, 1/2 or 3/4.';
    }
  } else if (isFractionTarget(target)) {
    return 'X/Y must be a fraction smaller than 1, such as 1/4, 1/2 or 3/4.';
  }

  if (target === 'days' && !WHOLE_NUMBER.test(text)) return 'Days must be a whole number.';
  return null;
}

/** The label fields the store mirrors at top level for the active label. */
function activeFields(label: LabelData) {
  return {
    product: label.product,
    productQuantity: label.productQuantity,
    alternativeProductName: label.alternativeProductName,
    dosage: label.dosage,
    weeklyDosage: label.weeklyDosage ?? { qty: 0, isFraction: false },
    frequencyDosage: label.frequencyDosage,
    stat: label.stat,
    days: label.days,
    additionalInstructions: label.additionalInstructions,
    selectedDaysOfWeek: label.selectedDaysOfWeek,
    weekdayRange: label.weekdayRange ?? null,
    reason: label.reason,
    reasons: label.reasons || (label.reason ? [label.reason] : []),
    expiryDate: label.expiryDate,
    expiryBatch: label.expiryBatch ?? null,
    showAddress: label.showAddress,
  };
}

const NO_EXPIRY = { expiryDate: null, expiryBatch: null };

function withoutExpiry(label: LabelData) {
  return { ...NO_EXPIRY, additionalInstructions: label.additionalInstructions.filter((i) => i !== EXPIRY_CODE) };
}

const CLOSED_PAD: NumberPadState = { visible: false, buffer: '', targetControl: null, error: null };

/** Panel state to use whenever the active label changes: every panel closed, no edit pending. */
const NO_EDIT_IN_PROGRESS = {
  activeControl: 'idle' as ActiveControl,
  numberPad: CLOSED_PAD,
  statBeforeEdit: null,
  daysOfWeekBeforeEdit: null,
  weekdayRangeBeforeEdit: null,
  reasonsBeforeEdit: null,
  rangeEndpoint: undefined,
  workflowNotice: null,
  // The batch picker and the delete confirmation belong to one label: switching labels closes them.
  expDateModalVisible: false,
  deleteLabelModalVisible: false,
};

/** Any step of the STAT flow (quantity, fraction pad, STAT administration, follow-up). */
export function isStatStep(control: ActiveControl): boolean {
  return control === 'stat' || control === 'stat_fraction' || control === 'stat_admin' || control === 'stat_followup';
}

/**
 * Leaving a label while the STAT or days-of-week panel is open counts as Cancel: the label
 * goes back to how it was when the panel opened, so no half-entered value is kept.
 */
function labelsWithEditsAbandoned(state: StoreState): LabelData[] {
  const idx = state.activeLabelIndex;
  const current = state.labels[idx];
  if (!current) return state.labels;
  let restored = current;
  if (isStatStep(state.activeControl)) {
    restored = { ...restored, stat: state.statBeforeEdit, additionalInstructions: state.statBeforeEdit ? restored.additionalInstructions : restored.additionalInstructions.filter(i => i !== 'STAT') };
  }
  if (state.activeControl === 'days_of_week' && state.daysOfWeekBeforeEdit) {
    restored = { ...restored, selectedDaysOfWeek: state.daysOfWeekBeforeEdit, daysConfirmed: state.daysConfirmedBeforeEdit, weekdayRange: state.weekdayRangeBeforeEdit };
  }
  if (state.reasonsBeforeEdit) restored = { ...restored, ...state.reasonsBeforeEdit };
  if (restored === current) return state.labels;
  const labels = [...state.labels];
  labels[idx] = restored;
  return labels;
}

/** Applies a number-pad value to the field it was opened for. */
function applyQty(label: LabelData, target: ActiveControl, qty: number, isFraction: boolean): Partial<LabelData> {
  switch (target) {
    case 'morning':
    case 'lunch':
    case 'night':
      return { dosage: { ...label.dosage, [target]: { qty, isFraction } } };
    case 'morning_fraction':
    case 'lunch_fraction':
    case 'night_fraction': {
      const time = target.replace('_fraction', '') as 'morning' | 'lunch' | 'night';
      const currentWhole = Math.floor(label.dosage[time].qty);
      return { dosage: { ...label.dosage, [time]: { qty: currentWhole + qty, isFraction: true } } };
    }
    case 'stat':
      return { stat: { ...(label.stat || { followUp: null, qty: 0, isFraction: false }), qty, isFraction } };
    case 'stat_fraction': {
      const currentWhole = label.stat ? Math.floor(label.stat.qty) : 0;
      return { stat: { ...(label.stat || { followUp: null }), qty: currentWhole + qty, isFraction: true } };
    }
    case 'days':
      return { days: qty > 0 ? qty : null };
    case 'product_quantity':
      return { productQuantity: qty > 0 ? qty : null };
    case 'weekly':
      return { weeklyDosage: { qty, isFraction } };
    case 'weekly_fraction':
      return { weeklyDosage: { qty: Math.floor(label.weeklyDosage?.qty ?? 0) + qty, isFraction: true } };
    case 'frequency':
      return { frequencyDosage: { qty, isFraction } };
    case 'frequency_fraction': {
      const currentWhole = Math.floor(label.frequencyDosage.qty);
      return { frequencyDosage: { qty: currentWhole + qty, isFraction: true } };
    }
    default:
      return {};
  }
}

/**
 * Spec workflow rules that refuse a tap (docs/LABEL_WORKFLOW_GAP_ANALYSIS.md). Only applied
 * under the spec wording. Returns the message to show, or null when the tap is allowed.
 */
function specRefusal(label: LabelData, instruction: string): string | null {
  // Digital label sheet: "when digi label work on it locked these button: 6H / 8H / 5H / Daily".
  const { morning, lunch, night } = label.dosage;
  if (!readEnt(label.additionalInstructions) && DIGI_LABEL_LOCKS.includes(instruction) && (morning.qty > 0 || lunch.qty > 0 || night.qty > 0)) {
    return '5H, 6H, 8H and Daily are locked while Morning, Lunch or Night has a dose.';
  }
  return null;
}

const initialLabel = createDefaultLabel();

/** Where the workstation goes after the number pad closes: back into the STAT flow if it came from there. */
function returnControlAfterPad(target: ActiveControl | null): ActiveControl {
  return target === 'stat' || target === 'stat_fraction' ? 'stat' : 'idle';
}

export const useLabelStore = create<StoreState>((set, get) => {
  // Helper to sync active label changes into labels array
  const updateActiveLabel = (updater: (label: LabelData) => Partial<LabelData>) => {
    set((state) => {
      const idx = state.activeLabelIndex;
      const current = state.labels[idx] || createDefaultLabel();
      const updatedLabel = { ...current, ...updater(current) };
      const updatedLabels = [...state.labels];
      updatedLabels[idx] = updatedLabel;

      return { labels: updatedLabels, ...activeFields(updatedLabel) };
    });
  };

  const activeLabel = () => {
    const state = get();
    return state.labels[state.activeLabelIndex];
  };

  return {
    reasonCatalogue: null,
    customerName: '',
    customerPhone: '',
    labels: [initialLabel],
    activeLabelIndex: 0,

    ...activeFields(initialLabel),

    activeControl: 'idle',
    customerSearchVisible: false,
    productInfoPopupVisible: false,
    productInfoData: null,
    deleteLabelModalVisible: false,
    expDateModalVisible: false,
    numberPad: CLOSED_PAD,
    statBeforeEdit: null,
    daysOfWeekBeforeEdit: null,
    workflowNotice: null,

    setEnt: (selection) => updateActiveLabel((label) => selection && (hasWeekdayRange(label) || reasonSelectionRefusal(label, 'ENT')) ? {} : ({
      ...(!selection && label.additionalInstructions.some(i => ['4H', 'CUSTOM'].includes(i)) ? { frequencyDosage: { qty: 0, isFraction: false } } : {}),
      additionalInstructions: [...label.additionalInstructions.filter(i => !i.startsWith(ENT_PREFIX) && (selection || !['4H', 'CUSTOM'].includes(i))), ...(selection ? [ENT_PREFIX + JSON.stringify(selection)] : [])],
    })),
    setCustomerName: (name) => set({ customerName: name }),
    setCustomerPhone: (phone) => set({ customerPhone: phone }),

    // A batch expiry belongs to one medicine: changing the medicine removes it.
    setProduct: (product) => updateActiveLabel((label) => ({
      product: product ? { ...product } : null,
      ...(label.product?.id !== product?.id && (label.expiryDate || label.expiryBatch || label.additionalInstructions.includes(EXPIRY_CODE)) ? withoutExpiry(label) : {}),
    })),

    restoreLabel: (label) => {
      // Detach the editable draft from the saved object and abandon pending pad/STAT edits.
      const restored: LabelData = structuredClone(label);
      // Missing legacy slots are invalid input, never an assumed dose or skipped time.
      restored.dosage = {
        morning: restored.dosage?.morning ?? { qty: NaN, isFraction: false },
        lunch: restored.dosage?.lunch ?? { qty: NaN, isFraction: false },
        night: restored.dosage?.night ?? { qty: NaN, isFraction: false },
      };
      set((state) => {
        const labels = [...labelsWithEditsAbandoned(state)];
        labels[state.activeLabelIndex] = restored;
        return { labels, ...activeFields(restored), ...NO_EDIT_IN_PROGRESS };
      });
    },
    setAlternativeProductName: (name) => updateActiveLabel(() => ({ alternativeProductName: name })),
    setProductQuantity: (qty) => updateActiveLabel(() => ({ productQuantity: qty })),
    setReasonCatalogue: (reasons) => set({ reasonCatalogue: reasons && reasons.every(r => typeof r === 'string' && r.trim() && r.length <= 200) && new Set(reasons).size === reasons.length ? [...reasons] : null }),
    setReason: (reason) => get().setReasons(reason ? [reason] : []),
    setReasons: (reasons) => {
      const label = activeLabel();
      if (!label || isStatStep(get().activeControl) || reasonValuesProblem(reasons)) return;
      const current = selectedReasonTexts(label);
      if (reasons.some(r => !current.includes(r) && (!label.reasonsEditPending || !get().reasonCatalogue?.includes(r)))) { set({ workflowNotice: 'Select only configured reasons in the Reasons panel.' }); return; }
      updateActiveLabel(() => ({ reasons: [...reasons], reason: reasons.length ? reasons.join(', ') : null, reasonsConfirmed: false }));
    },
    toggleReason: (reason) => {
      const label = activeLabel(); if (!label) return;
      const current = selectedReasonTexts(label);
      get().setReasons(current.includes(reason) ? current.filter(r => r !== reason) : [...current, reason]);
    },
    clearReasons: () => {
      if (isStatStep(get().activeControl)) return;
      updateActiveLabel(() => ({ reasons: [], reason: null, reasonsConfirmed: false, reasonsEditPending: false }));
      set({ reasonsBeforeEdit: null, ...(get().activeControl === 'reasons' ? { activeControl: 'idle' as ActiveControl } : {}) });
    },
    openReasonsPanel: () => {
      if (isStatStep(get().activeControl) || get().numberPad.visible || get().activeControl === 'days_of_week') { set({ workflowNotice: 'Finish or cancel the current entry before selecting Reasons.' }); return; }
      const label = activeLabel(); if (!label) return;
      if (!get().reasonsBeforeEdit) set({ reasonsBeforeEdit: { reasons: [...selectedReasonTexts(label)], reason: label.reason, reasonsConfirmed: label.reasonsConfirmed, reasonsEditPending: label.reasonsEditPending } });
      updateActiveLabel(() => ({ reasonsEditPending: true }));
      set({ activeControl: 'reasons', numberPad: CLOSED_PAD, workflowNotice: null });
    },
    closeReasonsPanel: () => {
      const label = activeLabel(); if (!label?.reasonsEditPending) return;
      const reasons = selectedReasonTexts(label);
      const problem = reasonValuesProblem(reasons);
      if (!reasons.length || problem || !get().reasonCatalogue || reasons.some(r => !get().reasonCatalogue!.includes(r))) { set({ workflowNotice: problem ?? 'Select at least one configured reason, then Enter; or omit/cancel Reasons.' }); return; }
      updateActiveLabel(() => ({ reasonsConfirmed: true, reasonsEditPending: false }));
      set({ activeControl: 'idle', reasonsBeforeEdit: null, workflowNotice: null });
    },
    cancelReasonsPanel: () => {
      const before = get().reasonsBeforeEdit;
      if (before) updateActiveLabel(() => before);
      set({ activeControl: 'idle', reasonsBeforeEdit: null, workflowNotice: null });
    },

    setExpiryBatch: (batch) => {
      const label = activeLabel();
      if (!label || isStatStep(get().activeControl) || !isCalendarDate(batch.expiryDate)) return false;
      if (batch.source === 'inventory' && (!batch.id || !batch.productId || batch.productId !== label.product?.id)) {
        set({ workflowNotice: 'That batch is not a batch of the medicine on this label. Select Add Expiry Date again.' });
        return false;
      }
      updateActiveLabel((l) => ({
        expiryBatch: { ...batch },
        expiryDate: batch.expiryDate,
        additionalInstructions: l.additionalInstructions.includes(EXPIRY_CODE) ? l.additionalInstructions : [...l.additionalInstructions, EXPIRY_CODE],
      }));
      set({ workflowNotice: null });
      return true;
    },

    clearExpiry: () => { if (!isStatStep(get().activeControl)) updateActiveLabel(withoutExpiry); },

    toggleShowAddress: () => updateActiveLabel((l) => ({ showAddress: !l.showAddress })),

    // Days start empty. The first + gives 1; nothing is assumed when no duration was entered.
    incrementDays: () => { if (!isStatStep(get().activeControl)) updateActiveLabel((label) => ({ days: (label.days ?? 0) + 1 })); },
    decrementDays: () => updateActiveLabel((label) => ({
      days: label.days == null ? null : Math.max(1, label.days - 1),
    })),

    addLabel: () => {
      const newLabel = createDefaultLabel();
      set((state) => {
        const nextLabels = [...labelsWithEditsAbandoned(state), newLabel];
        return {
          labels: nextLabels,
          activeLabelIndex: nextLabels.length - 1,
          ...activeFields(newLabel),
          ...NO_EDIT_IN_PROGRESS,
        };
      });
    },

    selectLabel: (index) => {
      set((state) => {
        if (index < 0 || index >= state.labels.length) return {};
        const labels = labelsWithEditsAbandoned(state);
        return {
          labels,
          activeLabelIndex: index,
          ...activeFields(labels[index]),
          ...NO_EDIT_IN_PROGRESS,
        };
      });
    },

    openDeleteLabelModal: () => set({ deleteLabelModalVisible: true }),
    closeDeleteLabelModal: () => set({ deleteLabelModalVisible: false }),

    confirmDeleteActiveLabel: () => {
      set((state) => {
        const { labels, activeLabelIndex } = state;

        if (labels.length <= 1) {
          // Reset single remaining label
          const resetLabel = createDefaultLabel();
          return {
            labels: [resetLabel],
            activeLabelIndex: 0,
            ...activeFields(resetLabel),
            ...NO_EDIT_IN_PROGRESS,
            deleteLabelModalVisible: false,
          };
        }

        const updatedLabels = [...labels];
        updatedLabels.splice(activeLabelIndex, 1);
        const nextIdx = Math.min(activeLabelIndex, updatedLabels.length - 1);

        return {
          labels: updatedLabels,
          activeLabelIndex: nextIdx,
          ...activeFields(updatedLabels[nextIdx]),
          ...NO_EDIT_IN_PROGRESS,
          deleteLabelModalVisible: false,
        };
      });
    },

    openExpDateModal: () => { if (!isStatStep(get().activeControl)) set({ expDateModalVisible: true }); },
    closeExpDateModal: () => set({ expDateModalVisible: false }),

    setActiveControl: (control) => {
      if (isStatStep(get().activeControl) && !isStatStep(control)) return;
      set({ activeControl: control });
    },
    setCustomerSearchVisible: (visible) => set({ customerSearchVisible: visible }),
    openProductInfoPopup: (data) => set({ productInfoPopupVisible: true, productInfoData: data }),
    closeProductInfoPopup: () => set({ productInfoPopupVisible: false, productInfoData: null }),

    openNumberPad: (targetControl) => {
      if (isStatStep(get().activeControl) && targetControl !== 'stat' && targetControl !== 'stat_fraction') return;
      if ((targetControl === 'stat' || targetControl === 'stat_fraction') && (statSelectionRefusal(activeLabel() ?? {}, 'STAT') ?? eodSelectionRefusal(activeLabel() ?? {}, 'STAT'))) return;
      if (['morning', 'lunch', 'night', 'morning_fraction', 'lunch_fraction', 'night_fraction'].includes(targetControl)) {
        const refusal = reasonSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? daySelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? weeklySelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? dailySelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? eveningSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? digitalSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? intervalSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? statSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? eodSelectionRefusal(activeLabel() ?? {}, 'DIGITAL');
        if (refusal) { set({ workflowNotice: refusal }); return; }
      }
      set({
        numberPad: { visible: true, buffer: '', targetControl, error: null },
        activeControl: targetControl,
      });
    },

    // Existing rule (SRS rule 20, DosageRow.test.tsx): + and âˆ’ work on whole units and drop a
    // fraction, so X/Y followed by + never produces a combined dose. Never below 0.
    clearDosage: (target) => updateActiveLabel((label) => reasonSelectionRefusal(label, 'DIGITAL') ? {} : ({
      dosage: { ...label.dosage, [target]: { qty: 0, isFraction: false } },
    })),

    incrementDosage: (target) => updateActiveLabel((label) => {
      if (isStatStep(get().activeControl) && target !== 'stat') return {};
      if (reasonSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? daySelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? weeklySelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? dailySelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? eveningSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? digitalSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? intervalSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? statSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL') ?? eodSelectionRefusal(label, target === 'stat' ? 'STAT' : 'DIGITAL')) return {};
      if (target === 'stat') {
        const current = label.stat || { qty: 0, isFraction: false, followUp: null };
        return { stat: { ...current, ...stepDosage(current.qty, 1) } };
      }
      const current = label.dosage[target];
      return {
        dosage: {
          ...label.dosage,
          [target]: { ...stepDosage(current.qty, 1) },
        },
      };
    }),

    decrementDosage: (target) => updateActiveLabel((label) => {
      if (target !== 'stat' && reasonSelectionRefusal(label, 'DIGITAL')) return {};
      if (isStatStep(get().activeControl) && target !== 'stat') return {};
      if (target === 'stat' && (statSelectionRefusal(label, 'STAT') ?? eodSelectionRefusal(label, 'STAT'))) return {};
      if (target === 'stat') {
        const current = label.stat || { qty: 0, isFraction: false, followUp: null };
        return { stat: { ...current, ...stepDosage(current.qty, -1) } };
      }
      const current = label.dosage[target];
      return {
        dosage: {
          ...label.dosage,
          [target]: { ...stepDosage(current.qty, -1) },
        },
      };
    }),

    confirmWeekly: () => {
      const label = activeLabel();
      if (isStatStep(get().activeControl) || !label?.additionalInstructions.includes('WEEKLY') || get().numberPad.visible || !Number.isFinite(label.weeklyDosage?.qty) || !((label.weeklyDosage?.qty ?? 0) > 0)) return;
      updateActiveLabel(l => ({ weeklyDosage: { ...l.weeklyDosage!, confirmed: true } }));
      set({ activeControl: 'idle', workflowNotice: null });
    },
    incrementWeeklyDosage: () => updateActiveLabel(label => label.additionalInstructions.includes('WEEKLY') && !isStatStep(get().activeControl) ? { weeklyDosage: stepDosage(label.weeklyDosage?.qty ?? 0, 1) } : {}),
    decrementWeeklyDosage: () => updateActiveLabel(label => label.additionalInstructions.includes('WEEKLY') && !isStatStep(get().activeControl) ? { weeklyDosage: stepDosage(label.weeklyDosage?.qty ?? 0, -1) } : {}),
    confirmDaily: () => {
      const label = activeLabel();
      if (isStatStep(get().activeControl) || !label?.additionalInstructions.includes('DAILY') || get().numberPad.visible || !Number.isFinite(label.frequencyDosage.qty) || label.frequencyDosage.qty <= 0) return;
      set({ activeControl: 'idle', workflowNotice: null });
    },
    confirmEvening: () => {
      const label = activeLabel();
      if (isStatStep(get().activeControl) || !label?.additionalInstructions.includes('EVENING') || get().numberPad.visible || !Number.isFinite(label.frequencyDosage.qty) || label.frequencyDosage.qty <= 0) return;
      updateActiveLabel(l => ({ frequencyDosage: { ...l.frequencyDosage, confirmed: true } }));
      set({ activeControl: 'idle', workflowNotice: null });
    },
    incrementFrequencyDosage: () => updateActiveLabel((label) => ({
      frequencyDosage: { ...stepDosage(label.frequencyDosage.qty, 1) },
    })),

    decrementFrequencyDosage: () => updateActiveLabel((label) => ({
      frequencyDosage: { ...stepDosage(label.frequencyDosage.qty, -1) },
    })),

    appendDigit: (digit) => set((state) => ({
      numberPad: { ...state.numberPad, buffer: state.numberPad.buffer + digit, error: null },
    })),

    appendFraction: (fraction) => set((state) => ({
      numberPad: { ...state.numberPad, buffer: state.numberPad.buffer + fraction, error: null },
    })),

    setQuickFraction: (fractionStr) => {
      const { numberPad } = get();
      const target = numberPad.targetControl;
      if (!target) return;
      if (['morning_fraction', 'lunch_fraction', 'night_fraction'].includes(target) && reasonSelectionRefusal(activeLabel() ?? {}, 'DIGITAL')) return;

      // 'clear' resets the fractional part while keeping the whole number.
      if (fractionStr === 'clear') {
        updateActiveLabel((label) => {
          switch (target) {
            case 'morning_fraction':
            case 'lunch_fraction':
            case 'night_fraction': {
              const time = target.replace('_fraction', '') as 'morning' | 'lunch' | 'night';
              const whole = Math.floor(label.dosage[time].qty);
              return { dosage: { ...label.dosage, [time]: { qty: whole, isFraction: false } } };
            }
            case 'stat_fraction': {
              const whole = label.stat ? Math.floor(label.stat.qty) : 0;
              return { stat: { ...(label.stat || { followUp: null }), qty: whole, isFraction: false } };
            }
            case 'weekly_fraction':
              return { weeklyDosage: { qty: Math.floor(label.weeklyDosage?.qty ?? 0), isFraction: false } };
            case 'frequency_fraction': {
              const whole = Math.floor(label.frequencyDosage.qty);
              return { frequencyDosage: { qty: whole, isFraction: false } };
            }
            default:
              return {};
          }
        });
        set({
          numberPad: CLOSED_PAD,
          activeControl: returnControlAfterPad(target),
        });
        return;
      }

      const { qty, isFraction } = parseQty(fractionStr);

      updateActiveLabel((label) => applyQty(label, target, qty, isFraction));

      set({
        numberPad: CLOSED_PAD,
        activeControl: returnControlAfterPad(target),
      });
    },

    backspace: () => set((state) => ({
      numberPad: {
        ...state.numberPad,
        buffer: state.numberPad.buffer.slice(0, -1),
        error: null,
      },
    })),

    // The pad's AC key: empties what has been typed. Labels and the patient are untouched.
    clearNumberPadBuffer: () => set((state) => ({
      numberPad: { ...state.numberPad, buffer: '', error: null },
    })),

    cancelNumberPad: () => set((state) => ({
      numberPad: CLOSED_PAD,
      activeControl: returnControlAfterPad(state.numberPad.targetControl),
    })),

    confirmNumberPad: () => {
      const { numberPad } = get();
      const { targetControl, buffer } = numberPad;

      if (!targetControl || buffer === '') {
        set({
          numberPad: CLOSED_PAD,
          activeControl: returnControlAfterPad(targetControl),
        });
        return;
      }

      const error = validateQtyEntry(buffer, targetControl);
      if (error) {
        set({ numberPad: { ...numberPad, error } });
        return;
      }

      if (['morning', 'lunch', 'night', 'morning_fraction', 'lunch_fraction', 'night_fraction'].includes(targetControl)) {
        const refusal = reasonSelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? daySelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? weeklySelectionRefusal(activeLabel() ?? {}, 'DIGITAL') ?? intervalSelectionRefusal(activeLabel() ?? {}, 'DIGITAL');
        if (refusal) { set({ workflowNotice: refusal, numberPad: { ...numberPad, error: refusal } }); return; }
      }
      const { qty, isFraction } = parseQty(buffer);
      updateActiveLabel((label) => applyQty(label, targetControl, qty, isFraction));

      set({
        numberPad: CLOSED_PAD,
        activeControl: returnControlAfterPad(targetControl),
      });
    },

    toggleAdditionalInstruction: (instruction) => {
      if (isStatStep(get().activeControl)) { set({ workflowNotice: 'Confirm or cancel the STAT quantity first.' }); return; }
      if (instruction === RANGE_CODE || LEGACY_RANGE_CODES.includes(instruction)) {
        if (instruction !== RANGE_CODE && !activeLabel()?.additionalInstructions.includes(instruction)) { set({ workflowNotice: 'Use Till to the Day with two weekday endpoints.' }); return; }
        get().toggleWeekdayRange(); return;
      }
      if (instruction === 'STAT') { get().startStat(); return; }
      // Add Expiry Date: tapping again removes it. Selecting it opens the batch lookup, which
      // retrieves the GRN batch expiry; a date is never typed, taken from the medicine or invented.
      if (instruction === EXPIRY_CODE) {
        const label = activeLabel();
        if (label && (label.additionalInstructions.includes(EXPIRY_CODE) || label.expiryDate || label.expiryBatch)) {
          updateActiveLabel(withoutExpiry);
          set({ workflowNotice: null, expDateModalVisible: false });
        } else {
          set({ workflowNotice: null, expDateModalVisible: true });
        }
        return;
      }

      const mode = getWordingMode();
      const before = activeLabel();
      if (!before) return;
      const chewingRefusal = reasonSelectionRefusal(before, instruction) ?? daySelectionRefusal(before, instruction) ?? weeklySelectionRefusal(before, instruction) ?? dailySelectionRefusal(before, instruction) ?? eveningSelectionRefusal(before, instruction) ?? digitalSelectionRefusal(before, instruction) ?? intervalSelectionRefusal(before, instruction) ?? statSelectionRefusal(before, instruction) ?? eodSelectionRefusal(before, instruction) ?? chewingSelectionRefusal(before.additionalInstructions, instruction) ?? dissolveSelectionRefusal(before.additionalInstructions, instruction) ?? withFoodSelectionRefusal(before.additionalInstructions, instruction) ?? keepInMouthSelectionRefusal(before.additionalInstructions, instruction);
      if (chewingRefusal) {
        set({ workflowNotice: chewingRefusal });
        return;
      }

      // Spec-only refusals. Nothing is changed; staff see why (workflowNotice).
      if (mode === 'spec' && !before.additionalInstructions.includes(instruction)) {
        const notice = specRefusal(before, instruction);
        if (notice) {
          set({ workflowNotice: notice });
          return;
        }
      }
      set({ workflowNotice: null });

      const forms = formInstructions(mode);
      const locking = timingLockingInstructions(mode);

      updateActiveLabel((label) => {
        let updated = [...label.additionalInstructions];

        // Deselecting is always allowed, including a timing that is now locked.
        if (updated.includes(instruction)) {
          const remaining = updated.filter((i) => i !== instruction);
          const followUp = remaining.find(i => ['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY', 'EOD'].includes(i)) ?? null;
          return { ...(instruction === 'WEEKLY' ? { weeklyDosage: { qty: 0, isFraction: false } } : {}), additionalInstructions: remaining, ...(label.stat ? { stat: { ...label.stat, followUp } } : {}) };
        }

        // WITH FOOD / EMPTY STOMACH have no BEFORE/AFTER form: timing cannot be added to them.
        const timingLocked = updated.some((i) => locking.includes(i));
        if ((instruction === 'BEFORE' || instruction === 'AFTER') && timingLocked) {
          return {};
        }

        // Mutual exclusivity: the new choice replaces the previous one in its group.
        if (forms.includes(instruction)) {
          // Retain the meal condition selected before Chewable or Dissolve and Drink.
          const mealCondition = (instruction === 'CHEWABLE' || instruction === 'DISSOLVE AND DRINK' || instruction === 'KEEP IN MOUTH') ? updated.find(i => i === 'WITH FOOD' || i === 'EMPTY STOMACH') : undefined;
          updated = updated.filter((i) => !forms.includes(i) || i === mealCondition);
          if (locking.includes(instruction) || mealCondition) {
            updated = updated.filter((i) => i !== 'BEFORE' && i !== 'AFTER');
          }
        }
        if (FREQUENCY_CODES.includes(instruction)) {
          // EOD is text, outside this mutually exclusive frequency group.
          updated = updated.filter((i) => !FREQUENCY_CODES.includes(i));
        }
        if (instruction === 'BEFORE') updated = updated.filter((i) => i !== 'AFTER');
        if (instruction === 'AFTER') updated = updated.filter((i) => i !== 'BEFORE');
        if (instruction === 'GIVE') updated = updated.filter((i) => i !== 'TAKE');
        if (instruction === 'TAKE') updated = updated.filter((i) => i !== 'GIVE');

        updated.push(instruction);
        const followUp = updated.find(i => ['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY', 'EOD'].includes(i)) ?? label.stat?.followUp ?? null;
        return { additionalInstructions: updated, ...(label.stat ? { stat: { ...label.stat, followUp } } : {}) };
      });

      // Interval and daily buttons: "button â†’ Select Qty". Selecting one asks for the quantity
      // per dose (kept when switching 6H â†’ 8H); removing the last one clears it, so no stale
      // quantity is printed against no interval.
      const after = activeLabel();
      if (!after) return;
      if (instruction === 'WEEKLY' && after.additionalInstructions.includes('WEEKLY')) { get().openNumberPad('weekly'); return; }
      const nowHasQuantityCode = after.additionalInstructions.some((i) => QUANTITY_CODES.includes(i));
      if (QUANTITY_CODES.includes(instruction) && after.additionalInstructions.includes(instruction)) {
        set({ numberPad: { visible: true, buffer: '', targetControl: 'frequency', error: null }, activeControl: 'frequency' });
      } else if (!nowHasQuantityCode && (instruction === 'DAILY' || after.frequencyDosage.qty > 0)) {
        updateActiveLabel(() => ({ frequencyDosage: { qty: 0, isFraction: false } }));
      }
    },

    // "Clear All" in Selected Instructions: instructions, reasons, STAT, expiry and days of the
    // week on this label. Product, quantities, dosage rows and duration are kept.
    clearLabelInstructions: () => { updateActiveLabel((label) => ({
      weeklyDosage: { qty: 0, isFraction: false },
      frequencyDosage: label.additionalInstructions.some(code => ['EVENING', 'DAILY'].includes(code)) ? { qty: 0, isFraction: false } : label.frequencyDosage,
      additionalInstructions: [],
      reasons: [],
      reasonsConfirmed: false,
      reasonsEditPending: false,
      reason: null,
      stat: null,
      ...NO_EXPIRY,
      selectedDaysOfWeek: [],
      weekdayRange: null,
    })); set({ ...NO_EDIT_IN_PROGRESS }); },

    toggleWeekdayRange: () => {
      if (isStatStep(get().activeControl) || get().activeControl === 'days_of_week' || get().numberPad.visible) return;
      const label = activeLabel();
      if (!label) return;
      if (hasWeekdayRange(label)) {
        const start = label.weekdayRange?.start;
        updateActiveLabel(() => ({ weekdayRange: null, selectedDaysOfWeek: validWeekday(start) ? [start] : [], daysConfirmed: validWeekday(start), additionalInstructions: label.additionalInstructions.filter(c => ![RANGE_CODE, ...LEGACY_RANGE_CODES].includes(c)) }));
        set({ workflowNotice: null });
        return;
      }
      const refusal = rangeSelectionRefusal(label, RANGE_CODE);
      if (refusal) { set({ workflowNotice: refusal }); return; }
      updateActiveLabel(() => ({ weekdayRange: { start: label.selectedDaysOfWeek[0], end: null, confirmed: false }, selectedDaysOfWeek: [], daysConfirmed: false, additionalInstructions: [...label.additionalInstructions, RANGE_CODE] }));
      set({ workflowNotice: 'Select Name of Days to choose the end day.' });
    },
    openDaysOfWeekPanel: (endpoint = 'end') => {
      if (isStatStep(get().activeControl) || get().activeControl === 'days_of_week') return;
      const refusal = daySelectionRefusal(activeLabel() ?? {}, 'NAME OF DAYS') ?? intervalSelectionRefusal(activeLabel() ?? {}, 'NAME OF DAYS') ?? eodSelectionRefusal(activeLabel() ?? {}, 'NAME OF DAYS');
      if (refusal) { set({ workflowNotice: refusal }); return; }
      set((state) => ({
      activeControl: 'days_of_week',
      numberPad: CLOSED_PAD,
      daysOfWeekBeforeEdit: [...state.selectedDaysOfWeek],
      daysConfirmedBeforeEdit: activeLabel()?.daysConfirmed,
      weekdayRangeBeforeEdit: structuredClone(activeLabel()?.weekdayRange ?? null),
      rangeEndpoint: endpoint,
      }));
    },
    removeDaysOfWeek: () => {
      if (hasWeekdayRange(activeLabel() ?? {})) return;
      updateActiveLabel(() => ({ selectedDaysOfWeek: [], daysConfirmed: false }));
      set({ activeControl: 'idle', daysOfWeekBeforeEdit: null });
    },
    closeDaysOfWeekPanel: () => {
      if (get().activeControl !== 'days_of_week') return;
      const current = activeLabel();
      if (current?.weekdayRange) {
        const endpoint = get().rangeEndpoint ?? 'end';
        if (!validWeekday(current.weekdayRange[endpoint])) { set({ workflowNotice: `Select a valid ${endpoint} weekday.` }); return; }
        updateActiveLabel(() => ({ weekdayRange: { ...current.weekdayRange!, confirmed: validWeekday(current.weekdayRange?.start) && validWeekday(current.weekdayRange?.end) } }));
        set({ activeControl: 'idle', daysOfWeekBeforeEdit: null, weekdayRangeBeforeEdit: null, workflowNotice: null });
        return;
      }
      const problem = dayValuesProblem(current?.selectedDaysOfWeek ?? []);
      if (problem) { set({ workflowNotice: problem }); return; }
      updateActiveLabel(() => ({ daysConfirmed: true }));
      set({ activeControl: 'idle', daysOfWeekBeforeEdit: null, workflowNotice: null });
    },
    cancelDaysOfWeekPanel: () => {
      const before = get().daysOfWeekBeforeEdit;
      if (before) updateActiveLabel(() => ({ selectedDaysOfWeek: before, daysConfirmed: get().daysConfirmedBeforeEdit, weekdayRange: get().weekdayRangeBeforeEdit }));
      set({ activeControl: 'idle', daysOfWeekBeforeEdit: null });
    },

    toggleDayOfWeek: (day) => updateActiveLabel((label) => {
      if (isStatStep(get().activeControl)) return {};
      if (label.weekdayRange) {
        if (get().activeControl !== 'days_of_week' || !validWeekday(day)) return {};
        const endpoint = get().rangeEndpoint ?? 'end';
        return { weekdayRange: { ...label.weekdayRange, [endpoint]: label.weekdayRange[endpoint] === day ? null : day, confirmed: false } };
      }
      if (!label.selectedDaysOfWeek.includes(day) && (get().activeControl !== 'days_of_week' || !Object.hasOwn(DAY_NAMES, day) || daySelectionRefusal(label, 'NAME OF DAYS'))) return {};
      let updated = [...label.selectedDaysOfWeek];
      if (updated.includes(day)) {
        updated = updated.filter((d) => d !== day);
      } else {
        updated.push(day);
      }

      return { selectedDaysOfWeek: updated, daysConfirmed: false };
    }),

    setDaysOfWeek: (days) => updateActiveLabel((label) => (isStatStep(get().activeControl) || hasWeekdayRange(label)) ? {} : ({
      daysConfirmed: false,
      selectedDaysOfWeek: daySelectionRefusal(label, 'NAME OF DAYS') ? label.selectedDaysOfWeek.filter(d => days.includes(d)) : [...new Set(days)].filter(d => Object.hasOwn(DAY_NAMES, d)),
    })),

    // STAT flow: STAT tile -> StatPanel (quantity) -> DONE -> StatFollowUpPanel -> back to the grid.
    // Each step must move `activeControl`, otherwise the panels never open or close.
    // Opening STAT on a label that already has one edits it; Cancel restores it unchanged.
    startStat: () => {
      if (isStatStep(get().activeControl)) return;
      const refusal = daySelectionRefusal(activeLabel() ?? {}, 'STAT') ?? intervalSelectionRefusal(activeLabel() ?? {}, 'STAT') ?? statSelectionRefusal(activeLabel() ?? {}, 'STAT') ?? eodSelectionRefusal(activeLabel() ?? {}, 'STAT');
      if (refusal) { set({ workflowNotice: refusal }); return; }
      const existing = activeLabel()?.stat ?? null;
      if (!existing) {
        updateActiveLabel((label) => ({ stat: { qty: 0, isFraction: false, followUp: null }, additionalInstructions: [...label.additionalInstructions.filter(i => i !== 'STAT'), 'STAT'] }));
      }
      set({ activeControl: 'stat', statBeforeEdit: existing, numberPad: CLOSED_PAD });
    },

    cancelStat: () => {
      if (!isStatStep(get().activeControl)) return;
      const before = get().statBeforeEdit;
      updateActiveLabel((label) => ({ stat: before, additionalInstructions: before ? label.additionalInstructions : label.additionalInstructions.filter(i => i !== 'STAT') }));
      set({ activeControl: 'idle', statBeforeEdit: null, numberPad: CLOSED_PAD });
    },

    // Confirm the independent initial quantity and return to the normal Function Pad.
    // The prescribed initial TAKE is intrinsic; USB/SAM choices belong to the follow-up.
    doneStat: () => {
      const stat = activeLabel()?.stat;
      if (!stat || !Number.isFinite(stat.qty) || stat.qty <= 0) return;
      updateActiveLabel((label) => ({ stat: label.stat ? { ...label.stat, administration: ['TAKE'] } : null }));
      set({ activeControl: 'idle', statBeforeEdit: null, numberPad: CLOSED_PAD });
    },

    toggleStatAdministration: (code) => {
      if (code !== 'TAKE') { set({ workflowNotice: 'The approved STAT initial phrase uses TAKE; choose administration for the follow-up separately.' }); return; }
      updateActiveLabel((label) => {
        if (!label.stat) return {};
        const admin = label.stat.administration ?? [];
        return { stat: { ...label.stat, administration: admin.includes('TAKE') ? [] : ['TAKE'] } };
      });
    },

    // "Enter" on the STAT administration step: needs TAKE or GIVE, then the follow-up.
    confirmStatAdministration: () => {
      const admin = activeLabel()?.stat?.administration ?? [];
      if (!admin.includes('TAKE') || admin.some(code => code !== 'TAKE')) return;
      set({ activeControl: 'idle', statBeforeEdit: null });
    },

    backToStatQuantity: () => set({ activeControl: 'stat' }),

    setStatFollowUp: (followUp) => {
      const label = activeLabel();
      if (!label?.stat || !(label.stat.qty > 0) || isStatStep(get().activeControl)) return;
      const allowed = ['8H', '6H', '5H', 'EOD', 'DAILY', 'EVENING', 'WEEKLY', 'MORNING', 'LUNCH', 'NIGHT', 'DIGITAL'];
      const refusal = statSelectionRefusal(label, followUp) ?? eodSelectionRefusal(label, followUp);
      if (!allowed.includes(followUp) || refusal) { set({ workflowNotice: refusal ?? 'This follow-up is not supported with STAT.' }); return; }
      updateActiveLabel((current) => ({ stat: current.stat ? { ...current.stat, followUp } : null }));
      if (['MORNING', 'LUNCH', 'NIGHT', 'DIGITAL'].includes(followUp)) get().openNumberPad(followUp === 'DIGITAL' ? 'morning' : followUp.toLowerCase() as 'morning' | 'lunch' | 'night');
      else if (!activeLabel()?.additionalInstructions.includes(followUp)) get().toggleAdditionalInstruction(followUp);
    },

    removeStat: () => updateActiveLabel((label) => ({
      stat: null,
      additionalInstructions: label.additionalInstructions.filter((i) => i !== 'STAT'),
    })),

    resetActiveLabel: () => {
      updateActiveLabel((label) => createDefaultLabel(label.id));
      set({ ...NO_EDIT_IN_PROGRESS });
    },

    allClear: () => {
      const freshLabel = createDefaultLabel();
      set({
        customerName: '',
        customerPhone: '',
        labels: [freshLabel],
        activeLabelIndex: 0,
        ...activeFields(freshLabel),
        ...NO_EDIT_IN_PROGRESS,
        deleteLabelModalVisible: false,
        expDateModalVisible: false,
      });
    },
  };
});
