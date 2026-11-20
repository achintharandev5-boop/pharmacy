import { beforeEach, describe, expect, it } from 'vitest';
import { findInstructionConflicts, useLabelStore, validateQtyEntry } from './labelStore';
import { checkLabelExpiry } from '../lib/labelExpiry';

/**
 * Store-level behaviour behind every workstation button (docs/BUTTON_LOGIC_AUDIT.md).
 * Each block names the defect it guards against.
 */
const s = () => useLabelStore.getState();

beforeEach(() => {
  s().allClear();
});

describe('number pad AC (defect B1: AC wiped the whole session)', () => {
  it('clears only the typed entry; labels, patient and pad stay', () => {
    s().setCustomerName('Patient A');
    s().incrementDosage('morning');
    s().addLabel();
    s().incrementDosage('night');
    s().openNumberPad('lunch');
    s().appendDigit('4');
    s().appendDigit('2');

    s().clearNumberPadBuffer();

    expect(s().numberPad).toMatchObject({ visible: true, buffer: '', targetControl: 'lunch' });
    expect(s().customerName).toBe('Patient A');
    expect(s().labels).toHaveLength(2);
    expect(s().labels[0].dosage.morning.qty).toBe(1);
    expect(s().labels[1].dosage.night.qty).toBe(1);
  });
});

describe('number pad entry validation (defect B9: bad entries silently reinterpreted)', () => {
  it.each([
    ['1/0', 'morning'],
    ['1/', 'morning'],
    ['/', 'morning'],
    ['3/2', 'morning_fraction'],
    ['5', 'lunch_fraction'],
    ['1 1/2', 'night_fraction'],
    ['1/2', 'days'],
  ] as const)('refuses %s for %s, keeps the pad open and the value unchanged', (entry, target) => {
    s().incrementDosage('morning'); // morning = 1
    s().openNumberPad(target);
    for (const ch of entry) s().appendDigit(ch);
    s().confirmNumberPad();

    expect(s().numberPad.visible).toBe(true);
    expect(s().numberPad.error).toBeTruthy();
    expect(s().dosage.morning).toEqual({ qty: 1, isFraction: false });
    expect(s().days).toBeNull();
  });

  it('a new key press clears the message', () => {
    s().openNumberPad('morning');
    s().appendDigit('/');
    s().confirmNumberPad();
    expect(s().numberPad.error).toBeTruthy();
    s().backspace();
    expect(s().numberPad.error).toBeNull();
  });

  it('accepts a proper fraction for X/Y and adds it to the whole number', () => {
    s().incrementDosage('night');
    s().openNumberPad('night_fraction');
    for (const ch of '3/4') s().appendDigit(ch);
    s().confirmNumberPad();
    expect(s().dosage.night).toEqual({ qty: 1.75, isFraction: true });
    expect(s().numberPad.visible).toBe(false);
  });

  it('validateQtyEntry allows whole numbers, fractions and (for rows) improper fractions', () => {
    expect(validateQtyEntry('2', 'morning')).toBeNull();
    expect(validateQtyEntry('3/2', 'morning')).toBeNull();
    expect(validateQtyEntry('1/2', 'morning_fraction')).toBeNull();
    expect(validateQtyEntry('14', 'days')).toBeNull();
    expect(validateQtyEntry('', 'morning')).toBeNull();
  });
});

describe('dosage + / − (existing rule: whole units, never below 0)', () => {
  it('changes only the row tapped', () => {
    s().incrementDosage('lunch');
    s().incrementDosage('lunch');
    expect(s().dosage).toEqual({
      morning: { qty: 0, isFraction: false },
      lunch: { qty: 2, isFraction: false },
      night: { qty: 0, isFraction: false },
    });
  });

  it('rapid repeated taps are all counted, and − never goes negative', () => {
    for (let i = 0; i < 50; i++) s().incrementDosage('morning');
    expect(s().dosage.morning.qty).toBe(50);
    for (let i = 0; i < 60; i++) s().decrementDosage('morning');
    expect(s().dosage.morning.qty).toBe(0);
    expect(s().labels[0].dosage.morning.qty).toBe(0);
  });

  it('an X/Y fraction is kept when another row changes', () => {
    s().openNumberPad('morning_fraction');
    s().setQuickFraction('1/2');
    s().incrementDosage('night');
    expect(s().dosage.morning).toEqual({ qty: 0.5, isFraction: true });
  });
});

describe('instruction groups (defect B5: WITH FOOD could be combined with EMPTY STOMACH and BEFORE)', () => {
  it('WITH FOOD refuses Empty Stomach and removes BEFORE/AFTER after correction', () => {
    s().toggleAdditionalInstruction('EMPTY STOMACH');
    s().toggleAdditionalInstruction('WITH FOOD');
    expect(s().additionalInstructions).toEqual(['EMPTY STOMACH']);
    s().toggleAdditionalInstruction('EMPTY STOMACH');
    s().toggleAdditionalInstruction('TAKE');
    s().toggleAdditionalInstruction('BEFORE');
    s().toggleAdditionalInstruction('WITH FOOD');
    expect(s().additionalInstructions).toEqual(['TAKE', 'WITH FOOD']);
  });

  it('BEFORE/AFTER cannot be added while WITH FOOD or EMPTY STOMACH is selected', () => {
    s().toggleAdditionalInstruction('WITH FOOD');
    s().toggleAdditionalInstruction('AFTER');
    expect(s().additionalInstructions).toEqual(['WITH FOOD']);
  });

  it('a timing can always be deselected', () => {
    useLabelStore.setState((st) => {
      const labels = [...st.labels];
      labels[0] = { ...labels[0], additionalInstructions: ['EMPTY STOMACH', 'BEFORE'] };
      return { labels, additionalInstructions: labels[0].additionalInstructions };
    });
    s().toggleAdditionalInstruction('BEFORE');
    expect(s().additionalInstructions).toEqual(['EMPTY STOMACH']);
  });

  it('GIVE/TAKE and BEFORE/AFTER are each one-of-two, and combine with each other', () => {
    s().toggleAdditionalInstruction('GIVE');
    s().toggleAdditionalInstruction('TAKE');
    s().toggleAdditionalInstruction('BEFORE');
    s().toggleAdditionalInstruction('AFTER');
    expect(s().additionalInstructions).toEqual(['TAKE', 'AFTER']);
  });

  it('an interval refuses other intervals and WEEKLY without changing its selection', () => {
    s().toggleAdditionalInstruction('6H');
    s().toggleAdditionalInstruction('8H');
    expect(s().additionalInstructions).toEqual(['6H']);

    s().toggleAdditionalInstruction('WEEKLY');
    expect(s().additionalInstructions).toEqual(['6H']);
    expect(findInstructionConflicts(s().additionalInstructions)).toEqual([]);
  });

  it('double tap selects then deselects', () => {
    s().toggleAdditionalInstruction('KEEP IN MOUTH');
    s().toggleAdditionalInstruction('KEEP IN MOUTH');
    expect(s().additionalInstructions).toEqual([]);
  });
});

describe('Reasons panel (defect B4: could not be closed and cleared form instructions)', () => {
  it('opening and closing the panel leaves every instruction alone', () => {
    s().toggleAdditionalInstruction('CHEWABLE');
    s().setReasonCatalogue(['කැස්සට', 'සෙමට']);
    s().openReasonsPanel();
    expect(s().activeControl).toBe('reasons');
    s().toggleReason('කැස්සට');
    s().closeReasonsPanel();

    expect(s().activeControl).toBe('idle');
    expect(s().additionalInstructions).toEqual(['CHEWABLE']);
    expect(s().reasons).toEqual(['කැස්සට']);
  });
});

describe('STAT (defects B2, B3, B6, B7)', () => {
  it('re-opening STAT edits the existing dose; Cancel puts it back', () => {
    s().startStat();
    s().incrementDosage('stat');
    s().incrementDosage('stat');
    s().doneStat();
    s().setStatFollowUp('8H');

    s().startStat();
    expect(s().stat).toMatchObject({ qty: 2, isFraction: false, followUp: '8H' });
    s().incrementDosage('stat');
    s().cancelStat();
    expect(s().stat).toMatchObject({ qty: 2, isFraction: false, followUp: '8H' });
    expect(s().labels[0].stat).toMatchObject({ qty: 2, isFraction: false, followUp: '8H' });
  });

  it('DONE needs a quantity', () => {
    s().startStat();
    s().doneStat();
    expect(s().activeControl).toBe('stat');
  });

  it('the X/Y quick fractions work for STAT and return to the STAT panel', () => {
    s().startStat();
    s().incrementDosage('stat');
    s().openNumberPad('stat_fraction');
    s().setQuickFraction('1/2');
    expect(s().stat).toMatchObject({ qty: 1.5, isFraction: true });
    expect(s().activeControl).toBe('stat');
  });

  it('removing the STAT chip removes the dose and never adds a STAT tag', () => {
    s().toggleAdditionalInstruction('6H');
    s().startStat();
    s().incrementDosage('stat');
    s().doneStat();
    s().setStatFollowUp('DAILY');
    s().removeStat();
    expect(s().stat).toBeNull();
    expect(s().additionalInstructions).toEqual(['6H']);
  });

  it('STAT never changes the scheduled doses', () => {
    s().incrementDosage('morning');
    s().startStat();
    s().incrementDosage('stat');
    s().doneStat();
    s().setStatFollowUp('8H');
    expect(s().dosage.morning).toEqual({ qty: 1, isFraction: false });
  });
});

describe('days and days of week (defects B8, B10)', () => {
  it('no duration until entered: + starts at 1, − does nothing when unset, minimum 1', () => {
    expect(s().days).toBeNull();
    s().decrementDays();
    expect(s().days).toBeNull();
    s().incrementDays();
    expect(s().days).toBe(1);
    s().decrementDays();
    expect(s().days).toBe(1);
    expect(s().labels[0].days).toBe(1);
  });

  it('Cancel restores the days of week; ENTER keeps them', () => {
    s().openDaysOfWeekPanel();
    s().toggleDayOfWeek('FRIDAY');
    s().toggleDayOfWeek('MONDAY');
    s().closeDaysOfWeekPanel();
    expect(s().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']);

    s().openDaysOfWeekPanel();
    s().setDaysOfWeek(['SUNDAY']);
    s().cancelDaysOfWeekPanel();
    expect(s().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']);
    expect(s().labels[0].selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']);
  });
});

describe('label management', () => {
  it('Add Label starts blank and leaves the previous label unchanged', () => {
    s().setProduct({ id: 'p1', name: 'Medicine A', expiry_date: '2030-01-31' });
    s().incrementDosage('morning');
    s().toggleAdditionalInstruction('TAKE');
    s().addLabel();

    expect(s().activeLabelIndex).toBe(1);
    expect(s().product).toBeNull();
    expect(s().dosage.morning.qty).toBe(0);
    expect(s().additionalInstructions).toEqual([]);
    expect(s().labels[0].product?.name).toBe('Medicine A');
    expect(s().labels[0].additionalInstructions).toEqual(['TAKE']);
  });

  it('Delete removes only the active label and shows its neighbour', () => {
    s().setProduct({ id: 'a', name: 'A' });
    s().addLabel();
    s().setProduct({ id: 'b', name: 'B' });
    s().addLabel();
    s().setProduct({ id: 'c', name: 'C' });
    s().selectLabel(1);
    s().confirmDeleteActiveLabel();

    expect(s().labels.map((l) => l.product?.name)).toEqual(['A', 'C']);
    expect(s().activeLabelIndex).toBe(1);
    expect(s().product?.name).toBe('C');
  });

  it('switching labels mid-STAT abandons the unfinished STAT entry on that label', () => {
    s().addLabel();
    s().selectLabel(0);
    s().startStat();
    s().incrementDosage('stat');
    s().selectLabel(1);
    expect(s().labels[0].stat).toBeNull();
    expect(s().activeControl).toBe('idle');
  });

  it('Clear All clears instructions only; product and doses stay', () => {
    s().setProduct({ id: 'a', name: 'A' });
    s().incrementDosage('lunch');
    s().incrementDays();
    s().toggleAdditionalInstruction('DAILY');
    s().toggleReason('සෙමට');
    s().clearLabelInstructions();
    expect(s().additionalInstructions).toEqual([]);
    expect(s().reasons).toEqual([]);
    expect(s().product?.name).toBe('A');
    expect(s().dosage.lunch.qty).toBe(1);
    expect(s().days).toBe(1);
  });

  it('removing the expiry also removes the ADD EXP DATE marker', () => {
    s().setProduct({ id: 'a', name: 'A', expiry_date: '2030-01-31' });
    s().setExpiryBatch({ id: 'b1', productId: 'a', batchNumber: 'B1', expiryDate: '2099-01-31', source: 'inventory' });
    expect(s().additionalInstructions).toContain('ADD EXP DATE');
    s().clearExpiry();
    expect(s().additionalInstructions).not.toContain('ADD EXP DATE');
    expect(s().expiryDate).toBeNull();
    expect(s().expiryBatch).toBeNull();
  });
});

describe('expiry entry check (defect B11: any text accepted, including past dates)', () => {
  const today = new Date(2026, 9, 10); // 10 Oct 2026

  it.each([
    ['2027-02-30', 'not a real date'],
    ['2026-10-09', 'already passed'],
    ['09/2026', 'already passed'],
    ['13/2027', 'month must be 1 to 12'],
    ['   ', 'Enter the expiry date'],
  ])('refuses %s', (text, message) => {
    const r = checkLabelExpiry(text, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain(message);
  });

  it.each([
    ['2026-10-10', true],
    ['10/2026', true],
    ['12/2028', true],
    ['1/8/2028', false], // ambiguous: printed as typed, not checked (unchanged behaviour)
  ])('accepts %s (checked: %s)', (text, checked) => {
    expect(checkLabelExpiry(text, today)).toEqual({ ok: true, checked });
  });
});
