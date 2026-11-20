import { isKnownExpired, parseLabelExpiry } from './expiry.rules';

describe('label expiry parsing', () => {
  it('interprets ISO dates', () => {
    expect(parseLabelExpiry('2028-01-31')).toEqual({
      text: '2028-01-31',
      isoDate: '2028-01-31',
      yearMonth: { year: 2028, month: 1 },
    });
  });

  it('rejects impossible ISO dates instead of rolling them over', () => {
    expect(parseLabelExpiry('2027-02-30')?.isoDate).toBeNull();
  });

  it('interprets month/year without inventing a day', () => {
    expect(parseLabelExpiry('12/2026')).toEqual({ text: '12/2026', isoDate: null, yearMonth: { year: 2026, month: 12 } });
  });

  it('keeps ambiguous day/month dates as text only', () => {
    expect(parseLabelExpiry('1/8/2028')).toEqual({ text: '1/8/2028', isoDate: null, yearMonth: null });
  });

  it('returns null for empty input', () => {
    expect(parseLabelExpiry('  ')).toBeNull();
    expect(parseLabelExpiry(undefined)).toBeNull();
  });

  it('detects expired dates in pharmacy time', () => {
    const today = '2026-10-10';
    expect(isKnownExpired(parseLabelExpiry('2026-10-09')!, today)).toBe(true);
    expect(isKnownExpired(parseLabelExpiry('2026-10-10')!, today)).toBe(false);
    expect(isKnownExpired(parseLabelExpiry('09/2026')!, today)).toBe(true);
    expect(isKnownExpired(parseLabelExpiry('10/2026')!, today)).toBe(false);
    expect(isKnownExpired(parseLabelExpiry('1/8/2020')!, today)).toBe(false);
  });
});
