import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { LabelActions } from './LabelActions';
import { DosagePanel } from './DosagePanel';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseAdministration, dissolvePrintError, currentAdministrationText, setWordingModeForTests, specAdministrationText } from '../../lib/instructionEngine';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));

const state = () => useLabelStore.getState();
const button = (name: string) => screen.getByRole('button', { name });
const preview = () => screen.getByTestId('label-text-preview').textContent ?? '';
function Workstation() { return <><InstructionGrid /><DosagePanel /><LabelActions /></>; }
function printedText() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return render(<LabelCard labelItem={built} />).container.querySelector('[data-label-body]')?.textContent ?? '';
}
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Dissolve and Drink SAM (%s wording)', mode => {
  beforeEach(() => {
    state().allClear();
    setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
  });

  it.each([
    ['Take medication', 'Before meals', 'බොන්න කෑමට පෙර'],
    ['Take medication', 'After meals', 'බොන්න කෑමට පසු'],
    ['Give medication', 'Before meals', 'බොන්න දෙන්න කෑමට පෙර'],
    ['Give medication', 'After meals', 'බොන්න දෙන්න කෑමට පසු'],
  ])('Dissolve and Drink + %s + %s updates preview and print', async (action, timing, suffix) => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Dissolve and Drink'));
    await user.click(button(action));
    expect(dissolvePrintError(state().labels[0])).toBe('Choose BEFORE or AFTER');
    expect(button('Before meals')).toBeEnabled();
    expect(button('After meals')).toBeEnabled();
    await user.click(button(timing));
    const sentence = `දිය කර ${suffix}`;
    expect(preview()).toContain(sentence);
    expect(printedText()).toContain(sentence);
    expect(dissolvePrintError(state().labels[0])).toBeNull();
    expect(button('Dissolve and Drink')).toHaveAttribute('data-selected', 'true');
    expect(button(action)).toHaveAttribute('data-selected', 'true');
    expect(button(timing)).toHaveAttribute('data-selected', 'true');
  });

  it.each([
    ['With Food', 'WITH FOOD', 'කෑමත් සමඟ', 'Take medication', 'බොන්න'],
    ['With Food', 'WITH FOOD', 'කෑමත් සමඟ', 'Give medication', 'බොන්න දෙන්න'],
    ['Empty Stomach', 'EMPTY STOMACH', 'හිස් බඩ', 'Take medication', 'බොන්න'],
    ['Empty Stomach', 'EMPTY STOMACH', 'හිස් බඩ', 'Give medication', 'බොන්න දෙන්න'],
  ])('%s → Dissolve and Drink → %s (%s) / %s', async (mealButton, mealCode, mealWords, action, verb) => {
    const user = userEvent.setup();
    render(<Workstation />);
    // Old timing must be cleared when the meal condition is selected.
    await user.click(button('Before meals'));
    await user.click(button(mealButton));
    await user.click(button('Dissolve and Drink'));
    await user.click(button(action));
    const sentence = `${mealWords} දිය කර ${verb}`;
    expect(state().additionalInstructions).toEqual([mealCode, 'DISSOLVE AND DRINK', action.startsWith('Give') ? 'GIVE' : 'TAKE']);
    expect(preview()).toContain(sentence);
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('DISSOLVE AND DRINK');
    expect(button('Before meals')).toBeDisabled();
    expect(button('After meals')).toBeDisabled();
    const before = [...state().additionalInstructions];
    await user.click(button('After meals'));
    expect(state().additionalInstructions).toEqual(before);
    const printed = printedText();
    expect(printed).toContain(sentence);
    expect(printed.split('දිය කර').length - 1).toBe(1);
    expect(printed).not.toContain('කෑමට');
    expect(dissolvePrintError(state().labels[0])).toBeNull();
  });

  it('locks all four incompatible tiles with native disabled state and faded styling', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Dissolve and Drink'));
    for (const name of ['Chewable', 'With Food', 'Empty Stomach', 'Keep in Mouth']) {
      const tile = button(name);
      expect(tile).toBeDisabled();
      expect(tile).toHaveAttribute('data-state', 'locked');
      expect(tile.className).toContain('opacity-45');
      await user.click(tile);
      expect(state().additionalInstructions).toEqual(['DISSOLVE AND DRINK']);
    }
    await user.click(button('Dissolve and Drink')); // removing it unlocks the other methods
    expect(button('With Food')).toBeEnabled();
    expect(button('Chewable')).toBeEnabled();
  });

  it('also refuses incompatible programmatic taps without replacing Dissolve and Drink', () => {
    choose(['DISSOLVE AND DRINK']);
    for (const next of ['CHEWABLE', 'WITH FOOD', 'EMPTY STOMACH', 'KEEP IN MOUTH']) {
      choose([next]);
      expect(state().additionalInstructions).toEqual(['DISSOLVE AND DRINK']);
      expect(state().workflowNotice).toBeTruthy();
    }
  });

  it('does not activate Dissolve on top of Keep in Mouth or replace it silently', () => {
    choose(['KEEP IN MOUTH']);
    render(<Workstation />);
    expect(button('Dissolve and Drink')).toBeDisabled();
    choose(['DISSOLVE AND DRINK']);
    expect(state().additionalInstructions).toEqual(['KEEP IN MOUTH']);
  });

  it.each([
    ['DISSOLVE AND DRINK', 'WITH FOOD', 'TAKE'], ['DISSOLVE AND DRINK', 'EMPTY STOMACH', 'GIVE'],
    ['DISSOLVE AND DRINK', 'CHEWABLE', 'TAKE', 'AFTER'], ['DISSOLVE AND DRINK', 'KEEP IN MOUTH', 'TAKE', 'BEFORE'],
  ])('rejects incompatible/restored sequence %j', (...codes) => {
    const analysis = analyseAdministration(codes, undefined, mode);
    expect(analysis.status).toBe('invalid');
    expect(analysis.text).toBeNull();
    expect(currentAdministrationText(codes)).toBeNull();
    expect(specAdministrationText(codes)).toBeNull();
  });

  it.each([
    ['8H', ['DISSOLVE AND DRINK', 'TAKE', 'AFTER']],
    ['6H', ['WITH FOOD', 'DISSOLVE AND DRINK', 'TAKE']],
    ['5H', ['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'GIVE']],
  ] as const)('%s preserves the product type, fractional dose and Dissolve and Drink instruction', (interval, codes) => {
    choose([interval]);
    state().appendDigit('1 1/2');
    state().confirmNumberPad();
    choose([...codes]);
    const sentence = analyseAdministration(state().additionalInstructions, undefined, mode).text;
    const printed = printedText();
    expect(printed).toContain(`කරල් 1½ බැගින් පැය ${interval[0]}කට වරක්`);
    expect(sentence).toBeTruthy();
    expect(printed).toContain(sentence);
    expect(printed.split('කරල්').length - 1).toBe(1);
  });

  it.each(['BD', 'TDS'])('combines with %s without changing product-type printing rules', pattern => {
    state().incrementDosage('morning'); state().incrementDosage('night');
    if (pattern === 'TDS') state().incrementDosage('lunch');
    choose(['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE']);
    expect(printedText()).toContain(`කරල් 1 බැගින් දිනකට ${pattern === 'BD' ? 2 : 3} වරක් හිස් බඩ දිය කර බොන්න`);
  });

  it.each([
    ['DISSOLVE AND DRINK'], ['DISSOLVE AND DRINK', 'TAKE'],
    ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'],
  ])('incomplete %j has no administration text and cannot be completed', (...codes) => {
    choose(codes);
    expect(dissolvePrintError(state().labels[0])).toBeTruthy();
    expect(currentAdministrationText(codes)).toBeNull();
    expect(specAdministrationText(codes)).toBeNull();
  });

  it('preserves the STAT dose and EOD modifier on a Dissolve and Drink interval label', () => {
    const saved = structuredClone(state().labels[0]);
    saved.stat = { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '8H' };
    saved.frequencyDosage = { qty: 0.5, isFraction: true };
    saved.additionalInstructions = ['EOD', '8H', 'EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE'];
    state().restoreLabel(saved);
    const printed = printedText();
    expect(printed).toContain('දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ දිය කර බොන්න');
    expect(state().stat?.qty).toBe(2);
  });

  it('Back preserves confirmed Dissolve and Drink and reset clears it using existing rules', () => {
    choose(['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE']);
    const saved = [...state().additionalInstructions];
    state().openNumberPad('morning_fraction');
    state().appendDigit('1/2');
    state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(saved);
    state().clearLabelInstructions();
    expect(state().additionalInstructions).toEqual([]);
    expect(state().product?.product_type).toBe('Karal');
    state().restoreLabel({ ...state().labels[0], additionalInstructions: saved });
    state().allClear();
    expect(state().additionalInstructions).toEqual([]);
  });

  it('label navigation, draft restoration and cancelling STAT preserve the chosen combination', () => {
    choose(['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'GIVE']);
    const saved = structuredClone(state().labels[0]);
    state().startStat();
    state().incrementDosage('stat');
    state().cancelStat();
    expect(state().additionalInstructions).toEqual(saved.additionalInstructions);
    state().addLabel();
    choose(['WITH FOOD', 'DISSOLVE AND DRINK', 'TAKE']);
    state().selectLabel(0);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දිය කර බොන්න දෙන්න');
    state().selectLabel(1);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('කෑමත් සමඟ දිය කර බොන්න');
    state().restoreLabel(saved);
    expect(specAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දිය කර බොන්න දෙන්න');
    expect(state().labels[0].additionalInstructions).toEqual(saved.additionalInstructions);
  });

  it('review blocks invalid restored Dissolve and Drink and unlocks after the order is corrected', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['DISSOLVE AND DRINK', 'EMPTY STOMACH', 'TAKE'] });
    const print = vi.fn();
    const save = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onPrintAndSave={print} onBack={vi.fn()} />);
    const printButton = button('Print & Save');
    expect(printButton).toBeDisabled();
    expect(screen.getByTestId('dissolve-validation-blocked')).toHaveTextContent('Dissolve and Drink then Empty Stomach');
    expect(button('Save without printing')).toBeDisabled();
    fireEvent.click(button('Save without printing'));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(printButton);
    expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE'] }));
    expect(printButton).toBeEnabled();
    expect(button('Save without printing')).toBeEnabled();
  });
});
