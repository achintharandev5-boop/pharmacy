import { afterEach, describe, expect, it } from 'vitest';
import { analyseDailySchedule, analyseLabel, analyseStat, setWordingModeForTests } from './instructionEngine';
import { buildFinalInstruction } from './labelBuilder';

/**
 * The two phrases the owner specified on 2026-10-11, quoted exactly:
 *   STAT, quantity 1, TAKE                → පළමුව පමණක් ගන්න
 *   Morning 1, Lunch 1, Night 1           → දිනපතා 3 වරක් ගන්න
 * Every other dosage pattern has no approved wording yet and must produce none.
 */
const STAT_TAKE = 'පළමුව පමණක් ගන්න';
const DAILY_3 = 'දිනපතා 3 වරක් ගන්න';

const rows = (morning: number, lunch: number, night: number) => ({
  morning: { qty: morning, isFraction: false },
  lunch: { qty: lunch, isFraction: false },
  night: { qty: night, isFraction: false },
});

afterEach(() => setWordingModeForTests(null));

describe('Morning / Lunch / Night', () => {
  it('1, 1, 1 → දිනපතා 3 වරක් ගන්න', () => {
    expect(analyseDailySchedule(rows(1, 1, 1), [])).toEqual({ status: 'complete', id: 'DAILY_THREE_TIMES_TAKE', text: DAILY_3, message: null });
  });

  it('the same phrase with TAKE + AFTER (the administration sentence is separate)', () => {
    expect(analyseDailySchedule(rows(1, 1, 1), ['TAKE', 'AFTER']).text).toBe(DAILY_3);
  });

  it('½, ½, ½ (same fraction each time) → the same frequency phrase', () => {
    const half = { qty: 0.5, isFraction: true };
    expect(analyseDailySchedule({ morning: half, lunch: half, night: half }, []).text).toBe(DAILY_3);
  });

  it.each([
    ['Morning only', rows(1, 0, 0), 'Morning 1'],
    ['Lunch only', rows(0, 1, 0), 'Lunch 1'],
    ['Night only', rows(0, 0, 1), 'Night 1'],
    ['Morning + Night', rows(1, 0, 1), 'Morning 1, Night 1'],
    ['different quantities 2, 1, 1', rows(2, 1, 1), 'Morning 2, Lunch 1, Night 1 (different quantities)'],
  ])('%s → no wording invented; reported for the pharmacist', (_name, r, described) => {
    const a = analyseDailySchedule(r, []);
    expect(a.status).toBe('unapproved');
    expect(a.text).toBeNull();
    expect(a.message).toBe(`No approved Sinhala wording for ${described}. Awaiting pharmacist.`);
  });

  it('0, 0, 0 → nothing', () => {
    expect(analyseDailySchedule(rows(0, 0, 0), [])).toMatchObject({ status: 'none', text: null, message: null });
  });

  it('GIVE or a form instruction → no "ගන්න" phrase (it would contradict them)', () => {
    expect(analyseDailySchedule(rows(1, 1, 1), ['GIVE', 'AFTER']).status).toBe('unapproved');
    expect(analyseDailySchedule(rows(1, 1, 1), ['CHEWABLE', 'TAKE', 'AFTER']).status).toBe('unapproved');
  });
});

describe('STAT', () => {
  it('quantity 0 → incomplete', () => {
    expect(analyseStat({ qty: 0 })).toMatchObject({ status: 'incomplete', message: 'Enter the STAT quantity' });
  });

  it('quantity without administration → incomplete', () => {
    expect(analyseStat({ qty: 1 })).toMatchObject({ status: 'incomplete', message: 'Choose TAKE or GIVE for the STAT dose' });
  });

  it.each([1, 2, 1.5])('quantity %s + TAKE → පළමුව පමණක් ගන්න', (qty) => {
    expect(analyseStat({ qty, administration: ['TAKE'] })).toEqual({ status: 'complete', id: 'STAT_TAKE', text: STAT_TAKE, message: null });
  });

  it.each([[['GIVE']], [['TAKE', 'AFTER']], [['GIVE', 'BEFORE']]])('%j → no approved wording (nothing invented)', (administration) => {
    const a = analyseStat({ qty: 1, administration });
    expect(a.status).toBe('unapproved');
    expect(a.text).toBeNull();
  });
});

describe('printed and saved text (label builder)', () => {
  const label = (over: object) => ({
    product: { id: 'medicine', name: 'Medicine', product_type: 'Pethi' },
    additionalInstructions: [] as string[],
    dosage: rows(0, 0, 0),
    stat: null,
    ...over,
  });

  it('default wording: a missing type never generates a default product-type line', () => {
    const out = buildFinalInstruction(label({ product: null, dosage: rows(1, 1, 1), stat: { qty: 1, isFraction: false, followUp: null, administration: ['TAKE'] } }));
    expect(out.additionalInstructions).toEqual(['පළමුව පමණක් 1 ගන්න ඉන්පසු,']);
    expect(out.stat).toBe('STAT 1');
  });

  it('spec: Morning/Lunch/Night 1/1/1 prints the phrase once; the dose rows keep their quantities', () => {
    setWordingModeForTests('spec');
    const out = buildFinalInstruction(label({ dosage: rows(1, 1, 1) }));
    expect(out.additionalInstructions).toEqual(['පෙති 1 බැගින් දිනකට 3 වරක්']);
    expect(out.dosage).toEqual({ morning: '1', lunch: '1', night: '1' });
  });

  it('STAT-only has no approved follow-up and generates no dangling prefix', () => {
    setWordingModeForTests('spec');
    const out = buildFinalInstruction(label({ stat: { qty: 2, isFraction: false, followUp: null, administration: ['TAKE'] } }));
    expect(out.additionalInstructions).toEqual([]);
    expect(out.stat).toBeUndefined();
  });

  it('spec: STAT then the daily schedule, joined by ඉන්පසු, in the STAT sheet order', () => {
    setWordingModeForTests('spec');
    const out = buildFinalInstruction(
      label({
        dosage: rows(1, 1, 1),
        additionalInstructions: ['TAKE', 'AFTER'],
        stat: { qty: 1, isFraction: false, followUp: null, administration: ['TAKE'] },
      }),
    );
    expect(out.additionalInstructions).toEqual(['පළමුව පමණක් 1 ගන්න ඉන්පසු,', 'පෙති 1 බැගින් දිනකට 3 වරක් ගන්න කෑමට පසු']);
    // STAT quantity is never added to the daily rows
    expect(out.dosage).toEqual({ morning: '1', lunch: '1', night: '1' });
    expect(out.stat).toBe('STAT 1');
  });

  it('spec: STAT with GIVE prints no Sinhala STAT phrase and DONE is refused', () => {
    setWordingModeForTests('spec');
    const l = label({ stat: { qty: 1, isFraction: false, followUp: null, administration: ['GIVE'] } });
    expect(buildFinalInstruction(l).additionalInstructions).toEqual([]);
    expect(analyseLabel({ ...l, frequencyDosage: { qty: 0 } }).blocking).toContain('No approved Sinhala wording for STAT with GIVE');
  });

  it('spec: Morning only is reported, not blocked, and prints no frequency phrase', () => {
    setWordingModeForTests('spec');
    const l = label({ dosage: rows(1, 0, 0), additionalInstructions: ['TAKE', 'AFTER'] });
    const readiness = analyseLabel({ ...l, frequencyDosage: { qty: 0 } });
    expect(readiness.blocking).toBeNull();
    expect(readiness.notices).toEqual(['No approved Sinhala wording for Morning 1. Awaiting pharmacist.']);
    expect(buildFinalInstruction(l).additionalInstructions).toEqual(['ගන්න කෑමට පසු']);
  });
});
