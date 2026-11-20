export type InstructionCategory = 'chewable' | 'dissolveAndDrink' | 'withFood' | 'emptyStomach';
export type AdminAction = 'take' | 'give';
export type MealTiming = 'before' | 'after';

export interface InstructionParams {
  category: InstructionCategory;
  action: AdminAction;
  timing?: MealTiming;
}

type InstructionCategoryConfig =
  | { take: Record<MealTiming, string>; give: Record<MealTiming, string> }
  | { take: string; give: string };

export const INSTRUCTION_CONFIG: Record<InstructionCategory, InstructionCategoryConfig> = {
  chewable: {
    take: {
      before: 'සපලා කන්න කෑමට පෙර',
      after: 'සපලා කන්න කෑමට පසු'
    },
    give: {
      before: 'සපලා කන්න දෙන්න කෑමට පෙර',
      after: 'සපලා කන්න දෙන්න කෑමට පසු'
    }
  },
  dissolveAndDrink: {
    take: {
      before: 'දිය කර බොන්න කෑමට පෙර',
      after: 'දිය කර බොන්න කෑමට පසු'
    },
    give: {
      before: 'දිය කර බොන්න දෙන්න කෑමට පෙර',
      after: 'දිය කර බොන්න දෙන්න කෑමට පසු'
    }
  },
  withFood: {
    take: 'කෑමත් සමඟ ගන්න',
    give: 'කෑමත් සමඟ දෙන්න'
  },
  emptyStomach: {
    take: 'හිස් බඩ ගන්න',
    give: 'හිස් බඩ දෙන්න'
  }
};

export const NORMAL_ADMIN_INSTRUCTION_CONFIG: Record<AdminAction, Record<MealTiming, string>> = {
  give: {
    before: 'කෑමට පෙර දෙන්න',
    after: 'කෑමට පසු දෙන්න'
  },
  take: {
    before: 'කෑමට පෙර ගන්න',
    after: 'කෑමට පසු ගන්න'
  }
};

/**
 * Retrieves the predefined exact Sinhala medicine instruction based on category, action, and optional timing.
 * Returns null if the combination is invalid or incomplete.
 */
export function getInstruction(
  category: InstructionCategory | string,
  action?: AdminAction | string | null,
  timing?: MealTiming | string | null
): string | null {
  const categoryConfig = INSTRUCTION_CONFIG[category as InstructionCategory];
  if (!categoryConfig || !action) return null;

  if (category === 'withFood' || category === 'emptyStomach') {
    const instruction = categoryConfig[action as AdminAction];
    return typeof instruction === 'string' ? instruction : null;
  }

  if (!timing) return null;
  const instruction = categoryConfig[action as AdminAction];
  if (!instruction || typeof instruction === 'string') return null;
  return instruction[timing as MealTiming] || null;
}

/**
 * Retrieves the predefined exact Sinhala medicine instruction for normal administration + timing buttons (GIVE/TAKE + BEFORE/AFTER).
 * Returns null if either action or timing is missing.
 */
export function getNormalInstruction(
  action?: AdminAction | string | null,
  timing?: MealTiming | string | null
): string | null {
  if (!action || !timing) return null;
  const actionConfig = NORMAL_ADMIN_INSTRUCTION_CONFIG[action as AdminAction];
  if (!actionConfig) return null;
  return actionConfig[timing as MealTiming] || null;
}

/**
 * Validates selected additional instructions before printing.
 * Ensures every selected OAB category or normal admin option has valid required selections before printing.
 */
export function validateBeforePrint(instructions: string[]): { valid: boolean; message?: string } {
  const OAB_CATEGORIES = ['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH'];
  const selectedCategory = instructions.find(i => OAB_CATEGORIES.includes(i));

  if (selectedCategory) {
    const hasAction = instructions.includes('TAKE') || instructions.includes('GIVE');
    if (!hasAction) {
      return {
        valid: false,
        message: `Please select TAKE or GIVE for ${selectedCategory} before printing.`
      };
    }

    if (selectedCategory === 'CHEWABLE' || selectedCategory === 'DISSOLVE AND DRINK') {
      const hasTiming = instructions.includes('BEFORE') || instructions.includes('AFTER');
      if (!hasTiming) {
        return {
          valid: false,
          message: `Please select BEFORE or AFTER meal timing for ${selectedCategory} before printing.`
        };
      }
    }

    return { valid: true };
  }

  const hasAction = instructions.includes('TAKE') || instructions.includes('GIVE');
  const hasTiming = instructions.includes('BEFORE') || instructions.includes('AFTER');

  if (hasAction && !hasTiming) {
    return {
      valid: false,
      message: 'Please select BEFORE or AFTER meal timing before printing.'
    };
  }

  if (hasTiming && !hasAction) {
    return {
      valid: false,
      message: 'Please select TAKE or GIVE administration option before printing.'
    };
  }

  return { valid: true };
}
