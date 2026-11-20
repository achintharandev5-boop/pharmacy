import { validateDosage, formatDosageReadable } from './dosage.rules';

describe('Dosage Rules Domain', () => {
  describe('validateDosage', () => {
    it('should validate non-negative dosage values', () => {
      const result = validateDosage({ morning: 1, lunch: 0.5, night: 1 });
      expect(result.valid).toBe(true);
    });

    it('should reject negative dosage values', () => {
      const result = validateDosage({ morning: -1, lunch: 0, night: 1 });
      expect(result.valid).toBe(false);
      expect(result.message).toContain('cannot be negative');
    });
  });

  describe('formatDosageReadable', () => {
    it('should format integer dosages', () => {
      expect(formatDosageReadable(2)).toBe('2');
    });

    it('should format fractional dosages into fraction symbols', () => {
      expect(formatDosageReadable(0.5)).toBe('½');
      expect(formatDosageReadable(0.25)).toBe('¼');
      expect(formatDosageReadable(0.75)).toBe('¾');
      expect(formatDosageReadable(1.5)).toBe('1½');
    });

    it('should return null for 0 quantity', () => {
      expect(formatDosageReadable(0)).toBeNull();
    });
  });
});
