export enum AdminAction {
  TAKE = 'TAKE',
  GIVE = 'GIVE',
}

export enum MealTiming {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER',
}

export enum SpecialCategory {
  CHEWABLE = 'CHEWABLE',
  DISSOLVE_AND_DRINK = 'DISSOLVE AND DRINK',
  WITH_FOOD = 'WITH FOOD',
  EMPTY_STOMACH = 'EMPTY STOMACH',
}

export enum FrequencyEnum {
  DAILY = 'DAILY',
  EVERY_5_HOURS = '5H',
  EVERY_6_HOURS = '6H',
  EVERY_8_HOURS = '8H',
  EVERY_OTHER_DAY = 'EOD',
  WEEKLY = 'WEEKLY',
  EVENING = 'EVENING',
  SOS = 'SOS',
  STAT = 'STAT',
}

export function validateInstructionCombinations(instructions: string[]): { valid: boolean; message?: string } {
  const hasBefore = instructions.includes('BEFORE');
  const hasAfter = instructions.includes('AFTER');
  if (hasBefore && hasAfter) {
    return { valid: false, message: 'Incompatible instruction combination: BEFORE and AFTER meal timing cannot both be selected.' };
  }

  const hasTake = instructions.includes('TAKE');
  const hasGive = instructions.includes('GIVE');
  if (hasTake && hasGive) {
    return { valid: false, message: 'Incompatible instruction combination: TAKE and GIVE administration options cannot both be selected.' };
  }

  const hasWithFood = instructions.includes('WITH FOOD');
  const hasEmptyStomach = instructions.includes('EMPTY STOMACH');
  if (hasWithFood && hasEmptyStomach) {
    return { valid: false, message: 'Incompatible instruction combination: WITH FOOD and EMPTY STOMACH cannot both be selected.' };
  }

  if ((hasWithFood || hasEmptyStomach) && (hasBefore || hasAfter)) {
    return { valid: false, message: 'Incompatible instruction combination: WITH FOOD / EMPTY STOMACH overrides BEFORE / AFTER meal timing.' };
  }

  return { valid: true };
}
