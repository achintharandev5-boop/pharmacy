import { addDays, startOfZonedDay, zonedDate } from './time';

describe('pharmacy time zone helpers', () => {
  it('starts the Colombo day at 18:30 UTC on the previous date', () => {
    expect(startOfZonedDay('Asia/Colombo', '2026-10-10').toISOString()).toBe('2026-10-09T18:30:00.000Z');
  });

  it('reports the local date, not the UTC date', () => {
    // 20:00 UTC on 9 Oct is 01:30 on 10 Oct in Colombo.
    expect(zonedDate('Asia/Colombo', new Date('2026-10-09T20:00:00Z'))).toBe('2026-10-10');
    expect(zonedDate('UTC', new Date('2026-10-09T20:00:00Z'))).toBe('2026-10-09');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a DST zone', () => {
    // New York is UTC-4 in October.
    expect(startOfZonedDay('America/New_York', '2026-10-10').toISOString()).toBe('2026-10-10T04:00:00.000Z');
  });
});
