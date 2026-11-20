import { generatePrescriptionNumber, normalizeSriLankanPhone } from './prescription.rules';

describe('Prescription Rules Domain', () => {
  describe('generatePrescriptionNumber', () => {
    it('should generate a formatted RX number with sequence padding', () => {
      const rxNumber = generatePrescriptionNumber(1);
      expect(rxNumber).toMatch(/^RX-\d{8}-000001$/);
    });

    it('should pad higher sequence numbers accurately', () => {
      const rxNumber = generatePrescriptionNumber(1234);
      expect(rxNumber).toMatch(/^RX-\d{8}-001234$/);
    });
  });

  describe('normalizeSriLankanPhone', () => {
    it('should normalize leading 0 to 94 country code', () => {
      expect(normalizeSriLankanPhone('0771234567')).toBe('94771234567');
    });

    it('should prepend 94 if 9 digits supplied without country code', () => {
      expect(normalizeSriLankanPhone('771234567')).toBe('94771234567');
    });

    it('should retain clean 94 format', () => {
      expect(normalizeSriLankanPhone('94771234567')).toBe('94771234567');
    });

    it('should return null for null or empty input', () => {
      expect(normalizeSriLankanPhone(null)).toBeNull();
      expect(normalizeSriLankanPhone('')).toBeNull();
    });
  });
});
