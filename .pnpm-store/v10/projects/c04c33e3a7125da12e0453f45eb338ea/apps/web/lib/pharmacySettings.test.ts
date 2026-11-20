import { describe, expect, it } from 'vitest';
import { changedSettings, draftFrom, PRINTER_FIELDS, PROFILE_FIELDS, validateSettings, type PharmacySettings } from './pharmacySettings';

const saved: PharmacySettings = {
  pharmacy_name: 'Sample Pharmacy',
  address: null,
  phone: '0112345678',
  printer_name: null,
  timezone: 'Asia/Colombo',
  label_width_mm: null,
  label_height_mm: null,
  low_stock_alerts_enabled: true,
  expiry_alert_days: 30,
  updated_at: '2026-10-30T08:00:00+00:00',
  updated_by: null,
};

describe('pharmacy settings draft', () => {
  it('starts from the saved values, with empty text for unset ones', () => {
    expect(draftFrom(saved)).toEqual({ pharmacy_name: 'Sample Pharmacy', address: '', phone: '0112345678', printer_name: '' });
  });

  it('reports nothing changed for an untouched or whitespace-only edit', () => {
    expect(changedSettings(saved, draftFrom(saved), PROFILE_FIELDS)).toEqual({});
    expect(changedSettings(saved, { ...draftFrom(saved), pharmacy_name: ' Sample Pharmacy  ' }, PROFILE_FIELDS)).toEqual({});
  });

  it('returns only the changed fields of the given section, trimmed; empty clears', () => {
    const draft = { ...draftFrom(saved), phone: '', address: ' No. 1 ', printer_name: 'Counter' };
    expect(changedSettings(saved, draft, PROFILE_FIELDS)).toEqual({ phone: '', address: 'No. 1' });
    expect(changedSettings(saved, draft, PRINTER_FIELDS)).toEqual({ printer_name: 'Counter' });
  });

  it('keeps Sinhala wording exactly', () => {
    expect(changedSettings(saved, { ...draftFrom(saved), pharmacy_name: 'සුව ෆාමසි' }, PROFILE_FIELDS)).toEqual({ pharmacy_name: 'සුව ෆාමසි' });
  });
});

describe('pharmacy settings validation (same rules as the API)', () => {
  const draft = draftFrom(saved);
  it.each([
    [{ phone: '011 234 5678' }, {}],
    [{ phone: '+94 77-123-4567' }, {}],
    [{ phone: '' }, {}],
    [{ phone: 'call me' }, { phone: expect.stringMatching(/phone number/) }],
    [{ phone: '12' }, { phone: expect.stringMatching(/phone number/) }],
    [{ pharmacy_name: 'a\nb' }, { pharmacy_name: 'Keep this on one line.' }],
    [{ pharmacy_name: 'x'.repeat(121) }, { pharmacy_name: 'Use at most 120 characters.' }],
    [{ address: 'x'.repeat(301) }, { address: 'Use at most 300 characters.' }],
  ])('%j -> %j', (change, errors) => {
    expect(validateSettings({ ...draft, ...change }, PROFILE_FIELDS)).toEqual(errors);
  });

  it('checks the printer name length', () => {
    expect(validateSettings({ ...draft, printer_name: 'p'.repeat(101) }, PRINTER_FIELDS)).toEqual({ printer_name: 'Use at most 100 characters.' });
  });
});
