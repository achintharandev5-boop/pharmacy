import { create } from 'zustand';
import { HARDCODED_PRODUCTS } from '../constants/products';

export type ActiveControl = 
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
  | "alternative_product"
  | "oab_workflow"
  | "days_of_week"
  | "frequency"
  | "frequency_fraction"
  | "expiry_date";

export type DosageEntry = { qty: number; isFraction: boolean };

export interface LabelData {
  id: string;
  product: { id: string; name: string } | null;
  productQuantity: number | null;
  alternativeProductName: string;
  dosage: {
    morning: DosageEntry;
    lunch: DosageEntry;
    night: DosageEntry;
  };
  frequencyDosage: DosageEntry;
  stat: { qty: number; isFraction: boolean; followUp: string | null } | null;
  days: number | null;
  additionalInstructions: string[];
  selectedDaysOfWeek: string[];
  reason: string | null;
  reasons: string[];
  expiryDate: string | null;
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
    frequencyDosage: { qty: 0, isFraction: false },
    stat: null,
    days: null,
    additionalInstructions: [],
    selectedDaysOfWeek: [],
    reason: null,
    reasons: [],
    expiryDate: null,
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

export type StoreState = {
  // Session & Multi-label State
  customerName: string;
  customerPhone: string;
  labels: LabelData[];
  activeLabelIndex: number;

  // Active Label Conveniences (synced with labels[activeLabelIndex])
  product: { id: string; name: string } | null;
  productQuantity: number | null;
  alternativeProductName: string;
  dosage: {
    morning: DosageEntry;
    lunch: DosageEntry;
    night: DosageEntry;
  };
  frequencyDosage: DosageEntry;
  stat: { qty: number; isFraction: boolean; followUp: string | null } | null;
  days: number | null;
  additionalInstructions: string[];
  selectedDaysOfWeek: string[];
  reason: string | null;
  reasons: string[];
  expiryDate: string | null;
  showAddress: boolean;

  // UI Panels & Modals State
  activeControl: ActiveControl;
  customerSearchVisible: boolean;
  productInfoPopupVisible: boolean;
  productInfoData: any | null;
  deleteLabelModalVisible: boolean;
  expDateModalVisible: boolean;
  numberPad: {
    visible: boolean;
    buffer: string;
    targetControl: ActiveControl | null;
  };

  // Mutators & Actions
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setProduct: (product: { id: string; name: string } | null) => void;
  setAlternativeProductName: (name: string) => void;
  setProductQuantity: (qty: number | null) => void;
  setReason: (reason: string | null) => void;
  setReasons: (reasons: string[]) => void;
  toggleReason: (reason: string) => void;
  clearReasons: () => void;
  setExpiryDate: (date: string | null) => void;
  toggleShowAddress: () => void;

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
  openProductInfoPopup: (data: any) => void;
  closeProductInfoPopup: () => void;
  openNumberPad: (targetControl: ActiveControl) => void;
  incrementDosage: (target: 'morning' | 'lunch' | 'night' | 'stat') => void;
  decrementDosage: (target: 'morning' | 'lunch' | 'night' | 'stat') => void;
  incrementFrequencyDosage: () => void;
  decrementFrequencyDosage: () => void;
  appendDigit: (digit: string) => void;
  appendFraction: (fraction: string) => void;
  setQuickFraction: (fractionStr: string) => void;
  backspace: () => void;
  confirmNumberPad: () => void;
  cancelNumberPad: () => void;
  toggleAdditionalInstruction: (instruction: string) => void;

  // Days of week
  openDaysOfWeekPanel: () => void;
  closeDaysOfWeekPanel: () => void;
  toggleDayOfWeek: (day: string) => void;

  // Stat Flow
  startStat: () => void;
  cancelStat: () => void;
  doneStat: () => void;
  setStatFollowUp: (followUp: string) => void;

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

const initialLabel = createDefaultLabel();

export const useLabelStore = create<StoreState>((set, get) => {
  // Helper to sync active label changes into labels array
  const updateActiveLabel = (updater: (label: LabelData) => Partial<LabelData>) => {
    set((state) => {
      const idx = state.activeLabelIndex;
      const current = state.labels[idx] || createDefaultLabel();
      const updatedLabel = { ...current, ...updater(current) };
      const updatedLabels = [...state.labels];
      updatedLabels[idx] = updatedLabel;

      return {
        labels: updatedLabels,
        product: updatedLabel.product,
        productQuantity: updatedLabel.productQuantity,
        alternativeProductName: updatedLabel.alternativeProductName,
        dosage: updatedLabel.dosage,
        frequencyDosage: updatedLabel.frequencyDosage,
        stat: updatedLabel.stat,
        days: updatedLabel.days,
        additionalInstructions: updatedLabel.additionalInstructions,
        selectedDaysOfWeek: updatedLabel.selectedDaysOfWeek,
        reason: updatedLabel.reason,
        reasons: updatedLabel.reasons || (updatedLabel.reason ? [updatedLabel.reason] : []),
        expiryDate: updatedLabel.expiryDate,
        showAddress: updatedLabel.showAddress,
      };
    });
  };

  return {
    customerName: '',
    customerPhone: '',
    labels: [initialLabel],
    activeLabelIndex: 0,

    product: initialLabel.product,
    productQuantity: initialLabel.productQuantity,
    alternativeProductName: initialLabel.alternativeProductName,
    dosage: initialLabel.dosage,
    frequencyDosage: initialLabel.frequencyDosage,
    stat: initialLabel.stat,
    days: initialLabel.days,
    additionalInstructions: initialLabel.additionalInstructions,
    selectedDaysOfWeek: initialLabel.selectedDaysOfWeek,
    reason: initialLabel.reason,
    reasons: initialLabel.reasons || [],
    expiryDate: initialLabel.expiryDate,
    showAddress: initialLabel.showAddress,

    activeControl: 'idle',
    customerSearchVisible: false,
    productInfoPopupVisible: false,
    productInfoData: null,
    deleteLabelModalVisible: false,
    expDateModalVisible: false,
    numberPad: {
      visible: false,
      buffer: '',
      targetControl: null,
    },

    setCustomerName: (name) => set({ customerName: name }),
    setCustomerPhone: (phone) => set({ customerPhone: phone }),

    setProduct: (product) => updateActiveLabel(() => ({ product })),
    setAlternativeProductName: (name) => updateActiveLabel(() => ({ alternativeProductName: name })),
    setProductQuantity: (qty) => updateActiveLabel(() => ({ productQuantity: qty })),
    setReason: (reason) => updateActiveLabel(() => ({
      reason,
      reasons: reason ? [reason] : [],
    })),
    setReasons: (reasons) => updateActiveLabel(() => ({
      reasons,
      reason: reasons.length > 0 ? reasons.join(', ') : null,
    })),
    toggleReason: (reason) => updateActiveLabel((label) => {
      const currentReasons = label.reasons || (label.reason ? [label.reason] : []);
      const exists = currentReasons.includes(reason);
      const updatedReasons = exists
        ? currentReasons.filter((r) => r !== reason)
        : [...currentReasons, reason];
      return {
        reasons: updatedReasons,
        reason: updatedReasons.length > 0 ? updatedReasons.join(', ') : null,
      };
    }),
    clearReasons: () => updateActiveLabel(() => ({
      reasons: [],
      reason: null,
    })),
    setExpiryDate: (date) => updateActiveLabel(() => ({ expiryDate: date })),

    toggleShowAddress: () => updateActiveLabel((l) => ({ showAddress: !l.showAddress })),

    addLabel: () => {
      const newLabel = createDefaultLabel();
      set((state) => {
        const nextLabels = [...state.labels, newLabel];
        const nextIdx = nextLabels.length - 1;
        return {
          labels: nextLabels,
          activeLabelIndex: nextIdx,
          product: newLabel.product,
          productQuantity: newLabel.productQuantity,
          alternativeProductName: newLabel.alternativeProductName,
          dosage: newLabel.dosage,
          frequencyDosage: newLabel.frequencyDosage,
          stat: newLabel.stat,
          days: newLabel.days,
          additionalInstructions: newLabel.additionalInstructions,
          selectedDaysOfWeek: newLabel.selectedDaysOfWeek,
          reason: newLabel.reason,
          reasons: newLabel.reasons || [],
          expiryDate: newLabel.expiryDate,
          showAddress: newLabel.showAddress,
          activeControl: 'idle',
          numberPad: { visible: false, buffer: '', targetControl: null },
        };
      });
    },

    selectLabel: (index) => {
      const { labels } = get();
      if (index < 0 || index >= labels.length) return;
      const targetLabel = labels[index];
      set({
        activeLabelIndex: index,
        product: targetLabel.product,
        productQuantity: targetLabel.productQuantity,
        alternativeProductName: targetLabel.alternativeProductName,
        dosage: targetLabel.dosage,
        frequencyDosage: targetLabel.frequencyDosage,
        stat: targetLabel.stat,
        days: targetLabel.days,
        additionalInstructions: targetLabel.additionalInstructions,
        selectedDaysOfWeek: targetLabel.selectedDaysOfWeek,
        reason: targetLabel.reason,
        reasons: targetLabel.reasons || (targetLabel.reason ? [targetLabel.reason] : []),
        expiryDate: targetLabel.expiryDate,
        showAddress: targetLabel.showAddress,
        activeControl: 'idle',
        numberPad: { visible: false, buffer: '', targetControl: null },
      });
    },

    openDeleteLabelModal: () => set({ deleteLabelModalVisible: true }),
    closeDeleteLabelModal: () => set({ deleteLabelModalVisible: false }),

    confirmDeleteActiveLabel: () => {
      set((state) => {
        const { labels, activeLabelIndex } = state;
        let updatedLabels = [...labels];

        if (updatedLabels.length <= 1) {
          // Reset single remaining label
          const resetLabel = createDefaultLabel();
          return {
            labels: [resetLabel],
            activeLabelIndex: 0,
            product: resetLabel.product,
            productQuantity: resetLabel.productQuantity,
            alternativeProductName: resetLabel.alternativeProductName,
            dosage: resetLabel.dosage,
            frequencyDosage: resetLabel.frequencyDosage,
            stat: resetLabel.stat,
            days: resetLabel.days,
            additionalInstructions: resetLabel.additionalInstructions,
            selectedDaysOfWeek: resetLabel.selectedDaysOfWeek,
            reason: resetLabel.reason,
            reasons: resetLabel.reasons || [],
            expiryDate: resetLabel.expiryDate,
            showAddress: resetLabel.showAddress,
            deleteLabelModalVisible: false,
            activeControl: 'idle',
          };
        }

        updatedLabels.splice(activeLabelIndex, 1);
        const nextIdx = Math.min(activeLabelIndex, updatedLabels.length - 1);
        const targetLabel = updatedLabels[nextIdx];

        return {
          labels: updatedLabels,
          activeLabelIndex: nextIdx,
          product: targetLabel.product,
          productQuantity: targetLabel.productQuantity,
          alternativeProductName: targetLabel.alternativeProductName,
          dosage: targetLabel.dosage,
          frequencyDosage: targetLabel.frequencyDosage,
          stat: targetLabel.stat,
          days: targetLabel.days,
          additionalInstructions: targetLabel.additionalInstructions,
          selectedDaysOfWeek: targetLabel.selectedDaysOfWeek,
          reason: targetLabel.reason,
          reasons: targetLabel.reasons || (targetLabel.reason ? [targetLabel.reason] : []),
          expiryDate: targetLabel.expiryDate,
          showAddress: targetLabel.showAddress,
          deleteLabelModalVisible: false,
          activeControl: 'idle',
        };
      });
    },

    openExpDateModal: () => set({ expDateModalVisible: true }),
    closeExpDateModal: () => set({ expDateModalVisible: false }),

    setActiveControl: (control) => set({ activeControl: control }),
    setCustomerSearchVisible: (visible) => set({ customerSearchVisible: visible }),
    openProductInfoPopup: (data) => set({ productInfoPopupVisible: true, productInfoData: data }),
    closeProductInfoPopup: () => set({ productInfoPopupVisible: false, productInfoData: null }),

    openNumberPad: (targetControl) => set({
      numberPad: { visible: true, buffer: '', targetControl },
      activeControl: targetControl,
    }),

    incrementDosage: (target) => updateActiveLabel((label) => {
      if (target === 'stat') {
        const current = label.stat || { qty: 0, isFraction: false, followUp: null };
        return { stat: { ...current, qty: Math.floor(current.qty) + 1, isFraction: false } };
      }
      const current = label.dosage[target];
      return {
        dosage: {
          ...label.dosage,
          [target]: { qty: Math.floor(current.qty) + 1, isFraction: false },
        },
      };
    }),

    decrementDosage: (target) => updateActiveLabel((label) => {
      if (target === 'stat') {
        const current = label.stat || { qty: 0, isFraction: false, followUp: null };
        return { stat: { ...current, qty: Math.max(0, Math.floor(current.qty) - 1), isFraction: false } };
      }
      const current = label.dosage[target];
      return {
        dosage: {
          ...label.dosage,
          [target]: { qty: Math.max(0, Math.floor(current.qty) - 1), isFraction: false },
        },
      };
    }),

    incrementFrequencyDosage: () => updateActiveLabel((label) => ({
      frequencyDosage: { qty: Math.floor(label.frequencyDosage.qty) + 1, isFraction: false },
    })),

    decrementFrequencyDosage: () => updateActiveLabel((label) => ({
      frequencyDosage: { qty: Math.max(0, Math.floor(label.frequencyDosage.qty) - 1), isFraction: false },
    })),

    appendDigit: (digit) => set((state) => ({
      numberPad: { ...state.numberPad, buffer: state.numberPad.buffer + digit },
    })),

    appendFraction: (fraction) => set((state) => ({
      numberPad: { ...state.numberPad, buffer: state.numberPad.buffer + fraction },
    })),

    setQuickFraction: (fractionStr) => {
      const { numberPad } = get();
      if (!numberPad.targetControl) return;
      const nextBuffer = fractionStr;
      const { qty, isFraction } = parseQty(nextBuffer);

      updateActiveLabel((label) => {
        const targetControl = numberPad.targetControl;
        if (!targetControl) return {};

        switch (targetControl) {
          case 'morning':
          case 'lunch':
          case 'night':
            return { dosage: { ...label.dosage, [targetControl]: { qty, isFraction } } };
          case 'morning_fraction':
          case 'lunch_fraction':
          case 'night_fraction': {
            const time = targetControl.replace('_fraction', '') as 'morning' | 'lunch' | 'night';
            const currentWhole = Math.floor(label.dosage[time].qty);
            return { dosage: { ...label.dosage, [time]: { qty: currentWhole + qty, isFraction: true } } };
          }
          case 'frequency':
            return { frequencyDosage: { qty, isFraction } };
          case 'frequency_fraction': {
            const currentWhole = Math.floor(label.frequencyDosage.qty);
            return { frequencyDosage: { qty: currentWhole + qty, isFraction: true } };
          }
          default:
            return {};
        }
      });

      set({
        numberPad: { visible: false, buffer: '', targetControl: null },
        activeControl: 'idle',
      });
    },

    backspace: () => set((state) => ({
      numberPad: {
        ...state.numberPad,
        buffer: state.numberPad.buffer.slice(0, -1),
      },
    })),

    cancelNumberPad: () => set({
      numberPad: { visible: false, buffer: '', targetControl: null },
      activeControl: 'idle',
    }),

    confirmNumberPad: () => {
      const { numberPad } = get();
      const { targetControl, buffer } = numberPad;

      if (!targetControl || buffer === '') {
        set({
          numberPad: { visible: false, buffer: '', targetControl: null },
          activeControl: 'idle',
        });
        return;
      }

      const { qty, isFraction } = parseQty(buffer);

      updateActiveLabel((label) => {
        switch (targetControl) {
          case 'morning':
          case 'lunch':
          case 'night':
            return { dosage: { ...label.dosage, [targetControl]: { qty, isFraction } } };
          case 'morning_fraction':
          case 'lunch_fraction':
          case 'night_fraction': {
            const time = targetControl.replace('_fraction', '') as 'morning' | 'lunch' | 'night';
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
            return { days: qty };
          case 'product_quantity':
            return { productQuantity: qty > 0 ? qty : null };
          case 'frequency':
            return { frequencyDosage: { qty, isFraction } };
          case 'frequency_fraction': {
            const currentWhole = Math.floor(label.frequencyDosage.qty);
            return { frequencyDosage: { qty: currentWhole + qty, isFraction: true } };
          }
          default:
            return {};
        }
      });

      set({
        numberPad: { visible: false, buffer: '', targetControl: null },
        activeControl: 'idle',
      });
    },

    toggleAdditionalInstruction: (instruction) => updateActiveLabel((label) => {
      let updated = [...label.additionalInstructions];
      let updatedExpiry = label.expiryDate;

      const SPECIAL_GROUP = ['CHEWABLE', 'DISSOLVE AND DRINK', 'REASONS', 'EMPTY STOMACH'];
      const FREQUENCY_BTNS = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];

      const isSpecialGroupItem = SPECIAL_GROUP.includes(instruction);
      const isFrequencyItem = FREQUENCY_BTNS.includes(instruction);

      // If ADD EXP DATE is tapped, toggle expiry date directly without popup
      if (instruction === 'ADD EXP DATE') {
        if (updated.includes('ADD EXP DATE') || updatedExpiry) {
          updated = updated.filter((i) => i !== 'ADD EXP DATE');
          updatedExpiry = null;
        } else {
          updated.push('ADD EXP DATE');
          if (label.product) {
            const matched = HARDCODED_PRODUCTS.find(
              (p) => p.id === label.product?.id || p.name.toLowerCase() === label.product?.name.toLowerCase()
            );
            updatedExpiry = matched?.expiry_date || null;
          }
          if (!updatedExpiry) {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            updatedExpiry = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
          }
        }
        return { additionalInstructions: updated, expiryDate: updatedExpiry };
      }

      // If timing is clicked while WITH FOOD or EMPTY STOMACH is active, ignore
      const hasLockedTiming = updated.includes('WITH FOOD') || updated.includes('EMPTY STOMACH');
      if ((instruction === 'BEFORE' || instruction === 'AFTER') && hasLockedTiming) {
        return { additionalInstructions: updated };
      }

      if (updated.includes(instruction)) {
        updated = updated.filter((i) => i !== instruction);
      } else {
        // Mutual Exclusivity Rules:
        if (isSpecialGroupItem) {
          // Deselect any previous item in Special Instruction Group
          updated = updated.filter((i) => !SPECIAL_GROUP.includes(i));
          // If selecting WITH FOOD or EMPTY STOMACH, clear timing options (BEFORE / AFTER)
          if (instruction === 'WITH FOOD' || instruction === 'EMPTY STOMACH') {
            updated = updated.filter((i) => i !== 'BEFORE' && i !== 'AFTER');
          }
        }

        if (isFrequencyItem) {
          // Deselect any previous frequency option
          updated = updated.filter((i) => !FREQUENCY_BTNS.includes(i));
        }

        if (instruction === 'BEFORE') updated = updated.filter((i) => i !== 'AFTER');
        if (instruction === 'AFTER') updated = updated.filter((i) => i !== 'BEFORE');
        if (instruction === 'GIVE') updated = updated.filter((i) => i !== 'TAKE');
        if (instruction === 'TAKE') updated = updated.filter((i) => i !== 'GIVE');

        updated.push(instruction);
      }

      return { additionalInstructions: updated, expiryDate: updatedExpiry };
    }),

    openDaysOfWeekPanel: () => set({ activeControl: 'days_of_week' }),
    closeDaysOfWeekPanel: () => set({ activeControl: 'idle' }),

    toggleDayOfWeek: (day) => updateActiveLabel((label) => {
      let updated = [...label.selectedDaysOfWeek];
      if (updated.includes(day)) {
        updated = updated.filter((d) => d !== day);
      } else {
        updated.push(day);
      }
      // Sort into natural calendar ordering
      updated.sort((a, b) => CALENDAR_DAYS.indexOf(a) - CALENDAR_DAYS.indexOf(b));
      return { selectedDaysOfWeek: updated };
    }),

    startStat: () => updateActiveLabel(() => ({
      stat: { qty: 0, isFraction: false, followUp: null },
    })),

    cancelStat: () => updateActiveLabel(() => ({
      stat: null,
    })),

    doneStat: () => set({ activeControl: 'stat_followup' }),

    setStatFollowUp: (followUp) => updateActiveLabel((label) => ({
      stat: label.stat ? { ...label.stat, followUp } : { qty: 0, isFraction: false, followUp },
    })),

    resetActiveLabel: () => updateActiveLabel(() => createDefaultLabel()),

    allClear: () => {
      const freshLabel = createDefaultLabel();
      set({
        customerName: '',
        customerPhone: '',
        labels: [freshLabel],
        activeLabelIndex: 0,
        product: freshLabel.product,
        productQuantity: freshLabel.productQuantity,
        alternativeProductName: freshLabel.alternativeProductName,
        dosage: freshLabel.dosage,
        frequencyDosage: freshLabel.frequencyDosage,
        stat: freshLabel.stat,
        days: freshLabel.days,
        additionalInstructions: freshLabel.additionalInstructions,
        selectedDaysOfWeek: freshLabel.selectedDaysOfWeek,
        reason: freshLabel.reason,
        reasons: freshLabel.reasons || [],
        expiryDate: freshLabel.expiryDate,
        showAddress: freshLabel.showAddress,
        activeControl: 'idle',
        deleteLabelModalVisible: false,
        expDateModalVisible: false,
        numberPad: { visible: false, buffer: '', targetControl: null },
      });
    },
  };
});
