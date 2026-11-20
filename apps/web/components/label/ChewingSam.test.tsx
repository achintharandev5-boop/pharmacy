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
import { analyseAdministration, chewingPrintError, currentAdministrationText, setWordingModeForTests, specAdministrationText } from '../../lib/instructionEngine';

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

describe.each(['current', 'spec'] as const)('Chewing SAM (%s wording)', mode => {
  beforeEach(() => {
    state().allClear();
    setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
  });

  it.each([
    ['Take medication', 'Before meals', 'කන්න කෑමට පෙර'],
    ['Take medication', 'After meals', 'කන්න කෑමට පසු'],
    ['Give medication', 'Before meals', 'කන්න දෙන්න කෑමට පෙර'],
    ['Give medication', 'After meals', 'කන්න දෙන්න කෑමට පසු'],
  ])('Chewing + %s + %s updates preview and print', async (action, timing, suffix) => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Chewable'));
    await user.click(button(action));
    expect(chewingPrintError(state().labels[0])).toBe('Choose BEFORE or AFTER');
    expect(button('Before meals')).toBeEnabled();
    expect(button('After meals')).toBeEnabled();
    await user.click(button(timing));
    const sentence = `${mode === 'spec' ? 'හපලා' : 'සපලා'} ${suffix}`;
    expect(preview()).toContain(sentence);
    expect(printedText()).toContain(sentence);
    expect(chewingPrintError(state().labels[0])).toBeNull();
    expect(button('Chewable')).toHaveAttribute('data-selected', 'true');
    expect(button(action)).toHaveAttribute('data-selected', 'true');
    expect(button(timing)).toHaveAttribute('data-selected', 'true');
  });

  it.each([
    ['With Food', 'WITH FOOD', 'කෑමත් සමඟ', 'Take medication', 'කන්න'],
    ['With Food', 'WITH FOOD', 'කෑමත් සමඟ', 'Give medication', 'කන්න දෙන්න'],
    ['Empty Stomach', 'EMPTY STOMACH', 'හිස් බඩ', 'Take medication', 'කන්න'],
    ['Empty Stomach', 'EMPTY STOMACH', 'හිස් බඩ', 'Give medication', 'කන්න දෙන්න'],
  ])('%s → Chewing → %s (%s) / %s', async (mealButton, mealCode, mealWords, action, verb) => {
    const user = userEvent.setup();
    render(<Workstation />);
    // Old timing must be cleared when the meal condition is selected.
    await user.click(button('Before meals'));
    await user.click(button(mealButton));
    await user.click(button('Chewable'));
    await user.click(button(action));
    const sentence = `${mealWords} හපලා ${verb}`;
    expect(state().additionalInstructions).toEqual([mealCode, 'CHEWABLE', action.startsWith('Give') ? 'GIVE' : 'TAKE']);
    expect(preview()).toContain(sentence);
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('CHEWABLE');
    expect(button('Before meals')).toBeDisabled();
    expect(button('After meals')).toBeDisabled();
    const before = [...state().additionalInstructions];
    await user.click(button('After meals'));
    expect(state().additionalInstructions).toEqual(before);
    const printed = printedText();
    expect(printed).toContain(sentence);
    expect(printed.split('හපලා').length - 1).toBe(1);
    expect(printed).not.toContain('කෑමට');
    expect(chewingPrintError(state().labels[0])).toBeNull();
  });

  it('locks all four incompatible tiles with native disabled state and faded styling', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Chewable'));
    for (const name of ['Dissolve and Drink', 'With Food', 'Empty Stomach', 'Keep in Mouth']) {
      const tile = button(name);
      expect(tile).toBeDisabled();
      expect(tile).toHaveAttribute('data-state', 'locked');
      expect(tile.className).toContain('opacity-45');
      await user.click(tile);
      expect(state().additionalInstructions).toEqual(['CHEWABLE']);
    }
    await user.click(button('Chewable')); // removing it unlocks the other methods
    expect(button('With Food')).toBeEnabled();
    expect(button('Dissolve and Drink')).toBeEnabled();
  });

  it('also refuses incompatible programmatic taps without replacing Chewing', () => {
    choose(['CHEWABLE']);
    for (const next of ['DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH', 'KEEP IN MOUTH']) {
      choose([next]);
      expect(state().additionalInstructions).toEqual(['CHEWABLE']);
      expect(state().workflowNotice).toBeTruthy();
    }
  });

  it.each([
    ['CHEWABLE', 'WITH FOOD', 'TAKE'], ['CHEWABLE', 'EMPTY STOMACH', 'GIVE'],
    ['CHEWABLE', 'DISSOLVE AND DRINK', 'TAKE', 'AFTER'], ['CHEWABLE', 'KEEP IN MOUTH', 'TAKE', 'BEFORE'],
  ])('rejects incompatible/restored sequence %j', (...codes) => {
    const analysis = analyseAdministration(codes, undefined, mode);
    expect(analysis.status).toBe('invalid');
    expect(analysis.text).toBeNull();
    expect(currentAdministrationText(codes)).toBeNull();
    expect(specAdministrationText(codes)).toBeNull();
  });

  it.each([
    ['8H', ['CHEWABLE', 'TAKE', 'AFTER']],
    ['6H', ['WITH FOOD', 'CHEWABLE', 'TAKE']],
    ['5H', ['EMPTY STOMACH', 'CHEWABLE', 'GIVE']],
  ] as const)('%s preserves the product type, fractional dose and Chewing instruction', (interval, codes) => {
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

  it('combines with equal digital doses without changing product-type printing rules', () => {
    state().incrementDosage('morning'); state().incrementDosage('night');
    choose(['EMPTY STOMACH', 'CHEWABLE', 'TAKE']);
    expect(printedText()).toContain('කරල් 1 බැගින් දිනකට 2 වරක් හිස් බඩ හපලා කන්න');
  });

  it('preserves the STAT dose and EOD modifier on a Chewing interval label', () => {
    const saved = structuredClone(state().labels[0]);
    saved.stat = { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '8H' };
    saved.frequencyDosage = { qty: 0.5, isFraction: true };
    saved.additionalInstructions = ['EOD', '8H', 'EMPTY STOMACH', 'CHEWABLE', 'TAKE'];
    state().restoreLabel(saved);
    const printed = printedText();
    expect(printed).toContain('දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ හපලා කන්න');
    expect(state().stat?.qty).toBe(2);
  });

  it('Back preserves confirmed Chewing and reset clears it using existing rules', () => {
    choose(['EMPTY STOMACH', 'CHEWABLE', 'TAKE']);
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
    choose(['EMPTY STOMACH', 'CHEWABLE', 'GIVE']);
    const saved = structuredClone(state().labels[0]);
    state().startStat();
    state().incrementDosage('stat');
    state().cancelStat();
    expect(state().additionalInstructions).toEqual(saved.additionalInstructions);
    state().addLabel();
    choose(['WITH FOOD', 'CHEWABLE', 'TAKE']);
    state().selectLabel(0);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ හපලා කන්න දෙන්න');
    state().selectLabel(1);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('කෑමත් සමඟ හපලා කන්න');
    state().restoreLabel(saved);
    expect(specAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ හපලා කන්න දෙන්න');
    expect(state().labels[0].additionalInstructions).toEqual(saved.additionalInstructions);
  });

  it('review blocks invalid restored Chewing and unlocks after the order is corrected', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['CHEWABLE', 'EMPTY STOMACH', 'TAKE'] });
    const print = vi.fn();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onPrintAndSave={print} onBack={vi.fn()} />);
    const printButton = button('Print & Save');
    expect(printButton).toBeDisabled();
    expect(screen.getByTestId('chewing-print-blocked')).toHaveTextContent('Chewable then Empty Stomach');
    fireEvent.click(printButton);
    expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH', 'CHEWABLE', 'TAKE'] }));
    expect(printButton).toBeEnabled();
  });
});
