import { describe, it, expect } from 'vitest';
import { getInstruction, getNormalInstruction, validateBeforePrint } from '../constants/oabInstructions';

describe('Software Logic For OAB - getInstruction', () => {
  describe('Chewable Logic', () => {
    it('returns correct instruction for Chewable -> Take -> Before Food', () => {
      expect(getInstruction('chewable', 'take', 'before')).toBe('සපලා කන්න කෑමට පෙර');
    });

    it('returns correct instruction for Chewable -> Give -> Before Food', () => {
      expect(getInstruction('chewable', 'give', 'before')).toBe('සපලා කන්න දෙන්න කෑමට පෙර');
    });

    it('returns correct instruction for Chewable -> Take -> After Food', () => {
      expect(getInstruction('chewable', 'take', 'after')).toBe('සපලා කන්න කෑමට පසු');
    });

    it('returns correct instruction for Chewable -> Give -> After Food', () => {
      expect(getInstruction('chewable', 'give', 'after')).toBe('සපලා කන්න දෙන්න කෑමට පසු');
    });
  });

  describe('Dissolve and Drink Logic', () => {
    it('returns correct instruction for Dissolve & Drink -> Take -> Before Food', () => {
      expect(getInstruction('dissolveAndDrink', 'take', 'before')).toBe('දිය කර බොන්න කෑමට පෙර');
    });

    it('returns correct instruction for Dissolve & Drink -> Give -> Before Food', () => {
      expect(getInstruction('dissolveAndDrink', 'give', 'before')).toBe('දිය කර බොන්න දෙන්න කෑමට පෙර');
    });

    it('returns correct instruction for Dissolve & Drink -> Take -> After Food', () => {
      expect(getInstruction('dissolveAndDrink', 'take', 'after')).toBe('දිය කර බොන්න කෑමට පසු');
    });

    it('returns correct instruction for Dissolve & Drink -> Give -> After Food', () => {
      expect(getInstruction('dissolveAndDrink', 'give', 'after')).toBe('දිය කර බොන්න දෙන්න කෑමට පසු');
    });
  });

  describe('With Food Logic', () => {
    it('returns correct instruction for With Food -> Take', () => {
      expect(getInstruction('withFood', 'take')).toBe('කෑමත් සමඟ ගන්න');
    });

    it('returns correct instruction for With Food -> Give', () => {
      expect(getInstruction('withFood', 'give')).toBe('කෑමත් සමඟ දෙන්න');
    });

    it('ignores timing parameter for With Food category', () => {
      expect(getInstruction('withFood', 'take', 'before')).toBe('කෑමත් සමඟ ගන්න');
      expect(getInstruction('withFood', 'give', 'after')).toBe('කෑමත් සමඟ දෙන්න');
    });
  });

  describe('Empty Stomach Logic', () => {
    it('returns correct instruction for Empty Stomach -> Take', () => {
      expect(getInstruction('emptyStomach', 'take')).toBe('හිස් බඩ ගන්න');
    });

    it('returns correct instruction for Empty Stomach -> Give', () => {
      expect(getInstruction('emptyStomach', 'give')).toBe('හිස් බඩ දෙන්න');
    });

    it('ignores timing parameter for Empty Stomach category', () => {
      expect(getInstruction('emptyStomach', 'take', 'before')).toBe('හිස් බඩ ගන්න');
      expect(getInstruction('emptyStomach', 'give', 'after')).toBe('හිස් බඩ දෙන්න');
    });
  });

  describe('Normal Admin Logic (GIVE/TAKE + BEFORE/AFTER)', () => {
    it('returns correct instruction for GIVE + BEFORE', () => {
      expect(getNormalInstruction('give', 'before')).toBe('කෑමට පෙර දෙන්න');
    });

    it('returns correct instruction for GIVE + AFTER', () => {
      expect(getNormalInstruction('give', 'after')).toBe('කෑමට පසු දෙන්න');
    });

    it('returns correct instruction for TAKE + BEFORE', () => {
      expect(getNormalInstruction('take', 'before')).toBe('කෑමට පෙර ගන්න');
    });

    it('returns correct instruction for TAKE + AFTER', () => {
      expect(getNormalInstruction('take', 'after')).toBe('කෑමට පසු ගන්න');
    });

    it('returns null if action or timing is missing', () => {
      expect(getNormalInstruction('give', null)).toBeNull();
      expect(getNormalInstruction(null, 'before')).toBeNull();
    });
  });

  describe('validateBeforePrint', () => {
    it('passes validation when no admin or timing option is selected', () => {
      expect(validateBeforePrint(['6H', 'DAILY'])).toEqual({ valid: true });
    });

    it('fails validation when CHEWABLE is selected without TAKE/GIVE', () => {
      const res = validateBeforePrint(['CHEWABLE']);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('select TAKE or GIVE');
    });

    it('fails validation when CHEWABLE is selected with TAKE but missing BEFORE/AFTER', () => {
      const res = validateBeforePrint(['CHEWABLE', 'TAKE']);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('select BEFORE or AFTER');
    });

    it('passes validation when CHEWABLE is selected with TAKE and BEFORE', () => {
      expect(validateBeforePrint(['CHEWABLE', 'TAKE', 'BEFORE'])).toEqual({ valid: true });
    });

    it('fails validation when WITH FOOD is selected without TAKE/GIVE', () => {
      const res = validateBeforePrint(['WITH FOOD']);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('select TAKE or GIVE');
    });

    it('passes validation when WITH FOOD is selected with GIVE (timing not required)', () => {
      expect(validateBeforePrint(['WITH FOOD', 'GIVE'])).toEqual({ valid: true });
    });

    it('fails validation when TAKE is selected without BEFORE or AFTER', () => {
      const res = validateBeforePrint(['TAKE']);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('BEFORE or AFTER');
    });

    it('fails validation when BEFORE is selected without TAKE or GIVE', () => {
      const res = validateBeforePrint(['BEFORE']);
      expect(res.valid).toBe(false);
      expect(res.message).toContain('TAKE or GIVE');
    });

    it('passes validation when TAKE and BEFORE are both selected', () => {
      expect(validateBeforePrint(['TAKE', 'BEFORE'])).toEqual({ valid: true });
    });

    it('passes validation when GIVE and AFTER are both selected', () => {
      expect(validateBeforePrint(['GIVE', 'AFTER'])).toEqual({ valid: true });
    });
  });
});
