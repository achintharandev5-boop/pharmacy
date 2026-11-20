import { describe, expect, it } from 'vitest';
import { expiryPrintError, isCalendarDate, localDate, type ExpiryBatch } from './batchExpiry';
import { buildFinalInstruction } from './labelBuilder';

/** Add Expiry Date (Feature #22, Document 5 pp. 41–43 and 54–55). */
const NOW = new Date(2026, 9, 29, 23, 30); // 29 Oct 2026, 23:30 local: late in the day
const batch = (over: Partial<ExpiryBatch> = {}): ExpiryBatch => ({ id: 'b1', productId: 'p1', batchNumber: 'B1', expiryDate: '2027-08-31', source: 'inventory', ...over });
const label = (over: Record<string, unknown> = {}) => ({
  additionalInstructions: ['ADD EXP DATE'],
  expiryDate: '2027-08-31',
  expiryBatch: batch(),
  product: { id: 'p1' },
  ...over,
});

describe('calendar dates', () => {
  it.each(['2027-08-31', '2028-02-29', '2026-10-29'])('accepts %s', (d) => expect(isCalendarDate(d)).toBe(true));
  it.each(['2027-02-30', '2027-13-01', '31/08/2027', '08/2027', '2027-8-31', '', null, undefined, 20270831])('refuses %s', (d) => expect(isCalendarDate(d)).toBe(false));

  it('uses the local calendar day, never a UTC shift', () => {
    expect(localDate(NOW)).toBe('2026-10-29');
    expect(localDate(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
  });
});

describe('expiryPrintError (shared by DONE, review, Save and Print)', () => {
  it('passes a valid batch expiry and a label without Add Expiry Date', () => {
    expect(expiryPrintError(label(), { now: NOW })).toBeNull();
    expect(expiryPrintError({ additionalInstructions: [], expiryDate: null, expiryBatch: null }, { now: NOW })).toBeNull();
  });

  it('accepts a batch expiring today and refuses one that has passed', () => {
    expect(expiryPrintError(label({ expiryDate: '2026-10-29', expiryBatch: batch({ expiryDate: '2026-10-29' }) }), { now: NOW })).toBeNull();
    expect(expiryPrintError(label({ expiryDate: '2026-10-28', expiryBatch: batch({ expiryDate: '2026-10-28' }) }), { now: NOW })).toContain('has passed');
  });

  it.each([
    ['selected but nothing retrieved', label({ expiryDate: null, expiryBatch: null }), 'no batch expiry date has been retrieved'],
    ['missing batch reference', label({ expiryBatch: null }), 'no batch expiry date has been retrieved'],
    ['date without the selection (restored inconsistent draft)', label({ additionalInstructions: [] }), 'does not match the Add Expiry Date selection'],
    ['batch of another medicine (medicine changed)', label({ product: { id: 'p2' } }), 'different medicine or batch'],
    ['batch without an id', label({ expiryBatch: batch({ id: null }) }), 'different medicine or batch'],
    ['shown date differs from the batch (stale draft)', label({ expiryDate: '2027-09-30' }), 'does not match the selected batch'],
    ['invalid recorded date', label({ expiryDate: '2027-02-30', expiryBatch: batch({ expiryDate: '2027-02-30' }) }), 'not a valid date'],
    ['typed free text', label({ expiryDate: '12/2027', expiryBatch: batch({ expiryDate: '12/2027' }) }), 'not a valid date'],
  ])('refuses %s', (_name, l, message) => {
    expect(expiryPrintError(l, { now: NOW })).toContain(message);
  });

  it('accepts a temporary UI-testing value only in UI testing mode', () => {
    const test = label({ product: null, expiryBatch: batch({ id: null, productId: null, batchNumber: null, source: 'ui-test' }) });
    expect(expiryPrintError(test, { uiTest: true, now: NOW })).toBeNull();
    expect(expiryPrintError(test, { uiTest: false, now: NOW })).toContain('temporary UI-testing value');
  });
});

describe('label builder', () => {
  const base = { id: 'l1', product: { id: 'p1', name: 'Medicine' }, dosage: { morning: { qty: 1 }, lunch: { qty: 0 }, night: { qty: 1 } }, customerName: 'P' };

  it('outputs the exact stored date only when Add Expiry Date is selected', () => {
    const on = buildFinalInstruction({ ...base, additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'], expiryDate: '2027-08-31', expiryBatch: batch() });
    expect(on.expiryDate).toBe('2027-08-31');
    expect(on.expiryBatch?.batchNumber).toBe('B1');
    const off = buildFinalInstruction({ ...base, additionalInstructions: ['TAKE', 'AFTER'], expiryDate: '2027-08-31', expiryBatch: batch() });
    expect(off.expiryDate).toBeNull();
    expect(off.expiryBatch).toBeNull();
  });

  it('never adds the expiry to the instruction sentence or the saved instruction text', () => {
    const on = buildFinalInstruction({ ...base, additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'], expiryDate: '2027-08-31', expiryBatch: batch() });
    const off = buildFinalInstruction({ ...base, additionalInstructions: ['TAKE', 'AFTER'] });
    expect(on.finalInstructionText).toBe(off.finalInstructionText);
    expect(on.instructionString).toBe(off.instructionString);
    expect(on.additionalInstructions).toEqual(off.additionalInstructions);
    expect(on.finalInstructionText).not.toContain('2027');
  });

  it.each([
    ['reasons', { additionalInstructions: ['TAKE', 'AFTER', 'REASONS', 'ADD EXP DATE'], reasons: ['කැස්සට'] }],
    ['weekdays', { additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'], selectedDaysOfWeek: ['MONDAY', 'FRIDAY'] }],
    ['STAT', { additionalInstructions: ['STAT', '8H', 'TAKE', 'AFTER', 'ADD EXP DATE'], stat: { qty: 2, isFraction: false, followUp: '8H' }, frequencyDosage: { qty: 1, isFraction: false } }],
    ['EOD', { additionalInstructions: ['EOD', 'TAKE', 'AFTER', 'ADD EXP DATE'] }],
  ])('keeps the %s wording unchanged when the expiry is added', (_name, extra) => {
    const on = buildFinalInstruction({ ...base, ...extra, expiryDate: '2027-08-31', expiryBatch: batch() });
    const off = buildFinalInstruction({ ...base, ...extra, additionalInstructions: (extra.additionalInstructions as string[]).filter((c) => c !== 'ADD EXP DATE') });
    expect(on.finalInstructionText).toBe(off.finalInstructionText);
    expect(on.expiryDate).toBe('2027-08-31');
  });
});
