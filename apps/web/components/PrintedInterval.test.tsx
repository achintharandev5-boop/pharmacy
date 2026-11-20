import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { LabelCard } from './PrintableLabel';
import { buildFinalInstruction } from '../lib/labelBuilder';
import { useLabelStore } from '../store/labelStore';
import { analyseAdministration, setWordingModeForTests } from '../lib/instructionEngine';

/**
 * Interval and daily buttons reach the printed label only with a quantity per dose. The printed
 * text below is the existing PrintableLabel wording (unchanged); before the quantity step was
 * added, no button could set the quantity, so these lines were never printed.
 */
const s = () => useLabelStore.getState();

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Pethi' });
});

function printedText() {
  const label = s().labels[s().activeLabelIndex];
  const { container } = render(<LabelCard labelItem={buildFinalInstruction(label)} />);
  return container.textContent ?? '';
}

describe('printed interval line', () => {
  it.each([
    ['8H', 'පෙති 1 බැගින් පැය 8කට වරක්'],
    ['6H', 'පෙති 1 බැගින් පැය 6කට වරක්'],
    ['5H', 'පෙති 1 බැගින් පැය 5කට වරක්'],
    ['DAILY', 'දිනකට 1'],
    ['EVENING', '1 හවසට'],
  ])('%s with quantity 1 prints "%s"', (code, printed) => {
    s().toggleAdditionalInstruction(code);
    expect(s().numberPad).toMatchObject({ visible: true, targetControl: 'frequency' });
    s().appendDigit('1');
    s().confirmNumberPad();
    expect(printedText()).toContain(printed);
  });

  it('without a quantity nothing is printed for the interval, and DONE refuses the label', () => {
    s().toggleAdditionalInstruction('8H');
    s().cancelNumberPad();
    expect(printedText()).not.toContain('පැය 8කට');
    const label = s().labels[0];
    const a = analyseAdministration(label.additionalInstructions, label.dosage, 'current', label.frequencyDosage.qty);
    expect(a).toMatchObject({ status: 'incomplete', missing: ['QUANTITY', 'TAKE_OR_GIVE', 'BEFORE_OR_AFTER'], nextStep: 'Enter the quantity for 8H' });
  });

  it('removing the interval removes its printed line', () => {
    s().toggleAdditionalInstruction('6H');
    s().appendDigit('2');
    s().confirmNumberPad();
    s().toggleAdditionalInstruction('6H');
    expect(printedText()).not.toContain('බැගින්');
  });

  it('the Morning/Lunch/Night rows are not changed by an interval quantity', () => {
    s().toggleAdditionalInstruction('EVENING');
    s().appendDigit('3');
    s().confirmNumberPad();
    s().confirmEvening();
    s().incrementDosage('morning');
    expect(s().dosage.morning.qty).toBe(1);
    expect(s().dosage.lunch.qty).toBe(0);
    expect(s().frequencyDosage.qty).toBe(3);
  });
});

describe('printed label matches the preview (spec wording)', () => {
  afterEach(() => setWordingModeForTests(null));

  it('Morning/Lunch/Night 1/1/1 with STAT 2 + TAKE: phrases printed in order, quantities kept', () => {
    setWordingModeForTests('spec');
    s().startStat(); s().incrementDosage('stat'); s().incrementDosage('stat'); s().doneStat();
    s().incrementDosage('morning'); s().incrementDosage('lunch'); s().incrementDosage('night');
    s().toggleAdditionalInstruction('TAKE'); s().toggleAdditionalInstruction('AFTER');

    const label = s().labels[0];
    const built = buildFinalInstruction(label);
    const printed = printedText();

    // Same lines in preview (built) and print, in order. STAT Option B (pending pharmacist approval):
    // the quantity is inside the owner's phrase, before the verb: පළමුව පමණක් ② ගන්න
    for (const line of (built.additionalInstructions ?? []).filter((l: string) => l !== 'පළමුව පමණක් ගන්න')) expect(printed).toContain(line);
    expect(printed).toContain('පළමුව පමණක් 2 ගන්න ඉන්පසු,');
    expect(printed.indexOf('පළමුව පමණක්')).toBeLessThan(printed.indexOf('ඉන්පසු'));
    expect(printed.indexOf('ඉන්පසු')).toBeLessThan(printed.indexOf('පෙති 1 බැගින් දිනකට 3 වරක්'));
    // STAT quantity printed once: no "STAT 2, then …" pill; the follow-up is kept as a tag
    expect(printed).not.toContain('STAT 2');
    expect(printed).not.toContain('THEN MORNING & NIGHT');
    expect(printed.split('පළමුව පමණක්').length - 1).toBe(1);
    // Equal daily quantities use the PDF's consolidated pattern; source quantities remain intact.
    expect(printed).toContain('පෙති 1 බැගින් දිනකට 3 වරක්');
    expect(built.dosage).toEqual({ morning: '1', lunch: '1', night: '1' });
  });

  it('default wording prints none of the new phrases', () => {
    s().incrementDosage('morning');
    s().incrementDosage('lunch');
    s().incrementDosage('night');
    expect(printedText()).not.toContain('දිනපතා 3 වරක්');
  });
});
