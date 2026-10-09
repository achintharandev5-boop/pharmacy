import { getInstruction, getNormalInstruction, InstructionCategory, AdminAction, MealTiming } from '../constants/oabInstructions';
import { HARDCODED_PRODUCTS } from '../constants/products';
import { useLabelStore } from '../store/labelStore';

export function formatDosageReadable(qty: number, isFraction: boolean): string | null {
  if (!isFraction) return qty > 0 ? qty.toString() : null;
  if (qty === 0 && !isFraction) return null;
  
  const whole = Math.floor(qty);
  const frac = qty - whole;
  let fracStr = '';
  if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
  else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
  else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
  else fracStr = frac > 0 ? ` ${frac.toFixed(2).replace('0.', '.')}` : '';

  if (whole === 0) return fracStr.trim() || null;
  return `${whole}${fracStr}`;
}

export function buildFinalInstruction(state: any) {
  const selectedReasons = (state.reasons && state.reasons.length > 0)
    ? state.reasons
    : (state.reason ? [state.reason] : []);

  // Customer Name: check state or global store
  const customer = state.customerName || useLabelStoreStateCustomer(state);

  const prodName = state.product?.name || state.productName || '';

  // Expiry date: check state or resolve from known products
  let expDate = state.expiryDate || state.expDate || null;
  if (!expDate && prodName) {
    const matched = HARDCODED_PRODUCTS.find(
      (p) => p.name.toLowerCase() === prodName.toLowerCase() || (state.product?.id && p.id === state.product.id)
    );
    if (matched?.expiry_date) {
      expDate = matched.expiry_date;
    }
  }

  const output: any = {
    id: state.id || '',
    showAddress: state.showAddress !== false,
    expiryDate: expDate,
    customerName: (customer && typeof customer === 'string') ? customer.trim() : '',
    productName: prodName,
    reason: selectedReasons.length > 0 ? selectedReasons.join(', ') : (state.reason || null),
    reasons: selectedReasons,
    selectedDaysOfWeek: state.selectedDaysOfWeek || [],
  };

  if (state.productQuantity) {
    output.productQuantity = state.productQuantity;
  }
  
  if (state.alternativeProductName?.trim()) {
    output.alternativeProductName = state.alternativeProductName.trim();
  }

  const dosageOut: any = {};
  if (state.dosage?.morning) {
    const morningStr = formatDosageReadable(state.dosage.morning.qty, state.dosage.morning.isFraction);
    if (morningStr) dosageOut.morning = morningStr;
  }
  
  if (state.dosage?.lunch) {
    const lunchStr = formatDosageReadable(state.dosage.lunch.qty, state.dosage.lunch.isFraction);
    if (lunchStr) dosageOut.lunch = lunchStr;
  }

  if (state.dosage?.night) {
    const nightStr = formatDosageReadable(state.dosage.night.qty, state.dosage.night.isFraction);
    if (nightStr) dosageOut.night = nightStr;
  }

  if (Object.keys(dosageOut).length > 0) {
    output.dosage = dosageOut;
  }

  const FREQUENCY_BTNS = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];
  const activeFreq = state.additionalInstructions?.find((i: string) => FREQUENCY_BTNS.includes(i));

  if (state.frequencyDosage && (state.frequencyDosage.qty > 0 || state.frequencyDosage.isFraction)) {
    const freqQtyStr = formatDosageReadable(state.frequencyDosage.qty, state.frequencyDosage.isFraction);
    if (freqQtyStr) {
      output.frequencyDosage = {
        qty: freqQtyStr,
        freqLabel: activeFreq || ''
      };
    }
  }

  if (state.stat && (state.stat.qty > 0 || state.stat.isFraction)) {
    const statQty = formatDosageReadable(state.stat.qty, state.stat.isFraction);
    if (statQty) {
      let statStr = `STAT ${statQty}`;
      if (state.stat.followUp) {
        statStr += `, then ${state.stat.followUp}`;
      }
      output.stat = statStr;
    }
  }

  if (state.days && state.days > 0) {
    output.days = state.days;
  }

  if (state.additionalInstructions && state.additionalInstructions.length > 0) {
    const rawList: string[] = [...state.additionalInstructions];
    
    const categoryMap: Record<string, InstructionCategory> = {
      'CHEWABLE': 'chewable',
      'DISSOLVE AND DRINK': 'dissolveAndDrink',
      'WITH FOOD': 'withFood',
      'EMPTY STOMACH': 'emptyStomach'
    };

    const actionMap: Record<string, AdminAction> = {
      'TAKE': 'take',
      'GIVE': 'give'
    };

    const timingMap: Record<string, MealTiming> = {
      'BEFORE': 'before',
      'AFTER': 'after'
    };

    const selectedCategoryTag = rawList.find(i => categoryMap[i]);
    const selectedActionTag = rawList.find(i => actionMap[i]);
    const selectedTimingTag = rawList.find(i => timingMap[i]);

    let finalSentence: string | null = null;
    if (selectedCategoryTag && selectedActionTag) {
      const categoryKey = categoryMap[selectedCategoryTag];
      const actionKey = actionMap[selectedActionTag];
      const timingKey = selectedTimingTag ? timingMap[selectedTimingTag] : undefined;
      
      finalSentence = getInstruction(categoryKey, actionKey, timingKey);
    } else if (selectedActionTag && selectedTimingTag) {
      const actionKey = actionMap[selectedActionTag];
      const timingKey = timingMap[selectedTimingTag];
      
      finalSentence = getNormalInstruction(actionKey, timingKey);
    } else if (selectedTimingTag) {
      finalSentence = selectedTimingTag === 'BEFORE' ? 'කෑමට පෙර ගන්න' : 'කෑමට පසු ගන්න';
    } else if (selectedCategoryTag) {
      if (selectedCategoryTag === 'WITH FOOD') finalSentence = 'කෑම සමඟ ගන්න';
      else if (selectedCategoryTag === 'EMPTY STOMACH') finalSentence = 'හිස්බඩ ගන්න';
      else if (selectedCategoryTag === 'CHEWABLE') finalSentence = 'හපා කන්න';
      else if (selectedCategoryTag === 'DISSOLVE AND DRINK') finalSentence = 'දියකර බොන්න';
    }

    const sinhalaPhrases: Record<string, string> = {
      'TILL TO DAY': 'අද දින දක්වා පමණි',
      'AND THIS DATE': 'නියමිත දිනට පමණි',
    };

    const controlTags = [
      'CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH',
      'TAKE', 'GIVE', 'BEFORE', 'AFTER', 'ADD EXP DATE', 'REASONS'
    ];
    
    const nonControlInstructions = rawList
      .filter(i => !controlTags.includes(i))
      .map(i => sinhalaPhrases[i] || i);

    const mergedInstructions = [...nonControlInstructions];
    if (finalSentence && !mergedInstructions.includes(finalSentence)) {
      mergedInstructions.push(finalSentence);
    }

    output.additionalInstructions = mergedInstructions;
  }

  // Format summary strings for UI review/preview
  let dosageTextParts: string[] = [];
  if (output.dosage) {
    if (output.dosage.morning) dosageTextParts.push(`Morning: ${output.dosage.morning}`);
    if (output.dosage.lunch) dosageTextParts.push(`Lunch: ${output.dosage.lunch}`);
    if (output.dosage.night) dosageTextParts.push(`Night: ${output.dosage.night}`);
  }
  if (output.frequencyDosage) {
    dosageTextParts.push(`${output.frequencyDosage.freqLabel || 'FREQ'}: ${output.frequencyDosage.qty}`);
  }
  if (output.stat) {
    dosageTextParts.push(output.stat);
  }
  output.dosageText = dosageTextParts.join('  |  ');

  const instructionParts: string[] = [];
  if (output.additionalInstructions && output.additionalInstructions.length > 0) {
    instructionParts.push(...output.additionalInstructions);
  }
  if (state.selectedDaysOfWeek && state.selectedDaysOfWeek.length > 0) {
    instructionParts.push(`Days: ${state.selectedDaysOfWeek.join(', ')}`);
  }
  output.instructionString = instructionParts.join(' • ');

  return output;
}

function useLabelStoreStateCustomer(state: any): string | null {
  if (state?.customerName && typeof state.customerName === 'string') {
    return state.customerName;
  }
  try {
    return useLabelStore.getState().customerName || null;
  } catch {
    return null;
  }
}
