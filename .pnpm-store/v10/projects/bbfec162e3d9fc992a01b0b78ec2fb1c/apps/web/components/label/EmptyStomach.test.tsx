import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { LabelActions } from './LabelActions';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseAdministration, currentAdministrationText, emptyStomachPrintError, setWordingModeForTests, specAdministrationText } from '../../lib/instructionEngine';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const button = (name: string) => screen.getByRole('button', { name });
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
function Workstation() { return <><InstructionGrid /><LabelActions /></>; }
function printed() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return { built, ...render(<LabelCard labelItem={built} />) };
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Empty Stomach (%s mode)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Packet' });
    state().setProductQuantity(10);
  });

  it.each([['Take medication', 'ගන්න'], ['Give medication', 'දෙන්න']])('standalone %s has exact shared preview/review/print text', async (action, verb) => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Empty Stomach'));
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    expect(specAdministrationText(state().additionalInstructions)).toBeNull();
    expect(emptyStomachPrintError(state().labels[0])).toBe('Choose TAKE or GIVE');
    await user.click(button(action));
    const expected = `හිස් බඩ ${verb}`;
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('EMPTY STOMACH');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(expected);
    expect(button('Empty Stomach')).toHaveAttribute('data-selected', 'true');
    expect(button(action)).toHaveAttribute('data-selected', 'true');
    const output = printed();
    expect(output.built.instructionString).toBe(expected);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(expected);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(emptyStomachPrintError(state().labels[0])).toBeNull();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={vi.fn()} />);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('removes stale timing, locks timing/With Food and releases its locks when removed', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Before meals')); await user.click(button('Empty Stomach'));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH']);
    for (const name of ['Before meals', 'After meals', 'With Food']) {
      expect(button(name)).toBeDisabled(); expect(button(name).className).toMatch(/opacity-(?:40|45)/);
      await user.click(button(name));
    }
    act(() => choose(['BEFORE', 'AFTER', 'WITH FOOD']));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH']);
    for (const name of ['Chewable', 'Dissolve and Drink', 'Keep in Mouth', 'Take medication', 'Give medication']) expect(button(name)).toBeEnabled();
    await user.click(button('Empty Stomach'));
    for (const name of ['Before meals', 'After meals', 'With Food']) expect(button(name)).toBeEnabled();
  });

  it.each([
    ['CHEWABLE', 'Chewable', 'TAKE', 'හපලා කන්න'], ['CHEWABLE', 'Chewable', 'GIVE', 'හපලා කන්න දෙන්න'],
    ['DISSOLVE AND DRINK', 'Dissolve and Drink', 'TAKE', 'දිය කර බොන්න'], ['DISSOLVE AND DRINK', 'Dissolve and Drink', 'GIVE', 'දිය කර බොන්න දෙන්න'],
    ['KEEP IN MOUTH', 'Keep in Mouth', 'TAKE', 'දිව මත තබා ගන්න'], ['KEEP IN MOUTH', 'Keep in Mouth', 'GIVE', 'දිව මත තබන්න'],
  ])('preserves Empty Stomach → %s → %s output and method locks', async (method, name, action, suffix) => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Empty Stomach')); await user.click(button(name));
    await user.click(button(action === 'TAKE' ? 'Take medication' : 'Give medication'));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH', method, action]);
    const expected = `හිස් බඩ ${suffix}`;
    expect(currentAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(specAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(expected);
    for (const other of ['Chewable', 'Dissolve and Drink', 'Keep in Mouth'].filter(i => i !== name)) {
      expect(button(other)).toBeDisabled(); await user.click(button(other));
    }
    act(() => choose(['CHEWABLE', 'DISSOLVE AND DRINK', 'KEEP IN MOUTH'].filter(i => i !== method)));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH', method, action]);
    expect(printed().built.instructionString).toBe(expected);
    await user.click(button('Empty Stomach'));
    expect(analyseAdministration(state().additionalInstructions, undefined, mode).missing).toContain('BEFORE_OR_AFTER');
    expect(button('With Food')).toBeDisabled();
    expect(button('Before meals')).toBeEnabled();
  });

  it.each(['CHEWABLE', 'DISSOLVE AND DRINK', 'KEEP IN MOUTH', 'WITH FOOD'])('refuses %s → Empty Stomach without replacement', method => {
    choose([method, 'EMPTY STOMACH']);
    expect(state().additionalInstructions).toEqual([method]); expect(state().workflowNotice).toBeTruthy();
  });

  it.each([
    ['EMPTY STOMACH'], ['EMPTY STOMACH', 'BEFORE'],
    ['CHEWABLE', 'EMPTY STOMACH', 'TAKE'], ['DISSOLVE AND DRINK', 'EMPTY STOMACH', 'TAKE'],
    ['KEEP IN MOUTH', 'EMPTY STOMACH', 'GIVE'], ['EMPTY STOMACH', 'WITH FOOD', 'TAKE'],
  ])('blocks invalid/incomplete restored %j and permits correction', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    expect(currentAdministrationText(codes)).toBeNull(); expect(specAdministrationText(codes)).toBeNull();
    const save = vi.fn(), print = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    expect(screen.getByTestId('empty-stomach-validation-blocked')).toHaveTextContent('Label 1:');
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH', 'GIVE'] }));
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('preserves independent labels, serialized restoration, Number Pad Back and reset', () => {
    choose(['EMPTY STOMACH', 'GIVE']); const saved = structuredClone(state().labels[0]);
    state().openNumberPad('morning'); state().appendDigit('2'); state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(saved.additionalInstructions);
    state().addLabel(); choose(['EMPTY STOMACH', 'KEEP IN MOUTH', 'TAKE']);
    state().selectLabel(0); expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දෙන්න');
    state().selectLabel(1); expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දිව මත තබා ගන්න');
    state().restoreLabel(saved); expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දෙන්න');
    state().clearLabelInstructions(); expect(state().additionalInstructions).toEqual([]);
    state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });

  it.each(['8H', '6H', '5H', 'BD', 'TDS'])('%s retains mixed dosage and exactly one Empty Stomach sentence', code => {
    if (code === 'BD' || code === 'TDS') {
      for (const time of code === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) {
        state().openNumberPad(time); state().appendDigit('1 1/2'); state().confirmNumberPad();
      }
    } else { choose([code]); state().appendDigit('1 1/2'); state().confirmNumberPad(); }
    choose(['EMPTY STOMACH', 'TAKE']); const output = printed();
    expect(output.built.instructionString).toContain('පැකට් 1½ බැගින්');
    expect(output.container.textContent).toContain('හිස් බඩ ගන්න');
    expect(output.built.instructionString.split('හිස් බඩ').length - 1).toBe(1);
  });

  it.each([['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']])('preserves %s output with STAT/EOD and a fractional quantity', (type, word) => {
    state().restoreLabel({ ...state().labels[0], product: { id: type, name: type, product_type: type },
      additionalInstructions: ['EOD', '6H', 'EMPTY STOMACH', 'GIVE'], frequencyDosage: { qty: 0.5, isFraction: true },
      stat: { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '6H' } });
    const text = printed().container.textContent ?? '';
    expect(text).toContain(`දිනක් හැර දිනක්, ${word} ½ බැගින් පැය 6කට වරක් හිස් බඩ දෙන්න`);
  });
});
