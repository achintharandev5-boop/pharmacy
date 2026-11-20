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
import { analyseAdministration, currentAdministrationText, specAdministrationText, setWordingModeForTests, withFoodPrintError } from '../../lib/instructionEngine';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const button = (name: string) => screen.getByRole('button', { name });
function Workstation() { return <><InstructionGrid /><LabelActions /></>; }
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
function printed() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return { built, ...render(<LabelCard labelItem={built} />) };
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('With Food (%s mode)', mode => {
  beforeEach(() => {
    state().allClear();
    setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Packet' });
    state().setProductQuantity(10);
  });

  it.each([['Take medication', 'ගන්න'], ['Give medication', 'දෙන්න']])('With Food + %s updates selected, review and printed instruction', async (action, verb) => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('With Food'));
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    expect(withFoodPrintError(state().labels[0])).toBe('Choose TAKE or GIVE');
    await user.click(button(action));
    const expected = `කෑමත් සමඟ ${verb}`;
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('WITH FOOD');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(expected);
    const output = printed();
    expect(output.built.instructionString).toBe(expected);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(expected);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(button('With Food')).toHaveAttribute('data-selected', 'true');
    expect(button(action)).toHaveAttribute('data-selected', 'true');
    expect(withFoodPrintError(state().labels[0])).toBeNull();
  });

  it('locks only the incompatible methods and timing, while preserving both compatible choices', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Before meals'));
    await user.click(button('With Food'));
    for (const name of ['Empty Stomach', 'Keep in Mouth', 'Before meals', 'After meals']) {
      expect(button(name)).toBeDisabled();
      expect(button(name).className).toMatch(/opacity-(?:40|45)/);
      await user.click(button(name));
      expect(state().additionalInstructions).toEqual(['WITH FOOD']);
    }
    for (const name of ['Chewable', 'Dissolve and Drink', 'Take medication', 'Give medication']) expect(button(name)).toBeEnabled();
    for (const code of ['EMPTY STOMACH', 'KEEP IN MOUTH', 'BEFORE', 'AFTER']) {
      act(() => choose([code]));
      expect(state().additionalInstructions).toEqual(['WITH FOOD']);
    }
    await user.click(button('With Food'));
    for (const name of ['Empty Stomach', 'Keep in Mouth', 'Before meals', 'After meals']) expect(button(name)).toBeEnabled();
    await user.click(button('Keep in Mouth'));
    expect(button('With Food')).toBeDisabled();
    act(() => choose(['WITH FOOD']));
    expect(state().additionalInstructions).toEqual(['KEEP IN MOUTH']);
  });

  it.each([
    ['CHEWABLE', 'TAKE', 'හපලා කන්න'], ['CHEWABLE', 'GIVE', 'හපලා කන්න දෙන්න'],
    ['DISSOLVE AND DRINK', 'TAKE', 'දිය කර බොන්න'], ['DISSOLVE AND DRINK', 'GIVE', 'දිය කර බොන්න දෙන්න'],
  ])('preserves the completed With Food → %s → %s combination', (method, action, suffix) => {
    choose(['WITH FOOD', method, action]);
    const expected = `කෑමත් සමඟ ${suffix}`;
    expect(state().additionalInstructions).toEqual(['WITH FOOD', method, action]);
    expect(currentAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(specAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(printed().built.instructionString).toBe(expected);
    choose(['BEFORE', 'AFTER']);
    expect(state().additionalInstructions).toEqual(['WITH FOOD', method, action]);
  });

  it.each(['CHEWABLE', 'DISSOLVE AND DRINK'])('continues to refuse %s → With Food', method => {
    choose([method, 'WITH FOOD']);
    expect(state().additionalInstructions).toEqual([method]);
    expect(state().workflowNotice).toBeTruthy();
  });

  it.each([['WITH FOOD'], ['WITH FOOD', 'EMPTY STOMACH', 'TAKE'], ['WITH FOOD', 'KEEP IN MOUTH', 'GIVE']])('blocks incomplete/invalid restored %j at review', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    expect(analyseAdministration(codes, undefined, mode).text).toBeNull();
    const save = vi.fn(), print = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled();
    expect(button('Print & Save')).toBeDisabled();
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    expect(screen.getByTestId('with-food-validation-blocked')).toHaveTextContent('Label 1:');
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['WITH FOOD', 'TAKE'] }));
    expect(button('Save without printing')).toBeEnabled();
    expect(button('Print & Save')).toBeEnabled();
  });

  it('preserves label ownership, valid restored combinations, Back and reset', () => {
    choose(['WITH FOOD', 'CHEWABLE', 'GIVE']);
    const saved = structuredClone(state().labels[0]);
    state().openNumberPad('morning'); state().appendDigit('2'); state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(saved.additionalInstructions);
    state().addLabel(); choose(['WITH FOOD', 'DISSOLVE AND DRINK', 'TAKE']);
    state().selectLabel(0);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('කෑමත් සමඟ හපලා කන්න දෙන්න');
    state().selectLabel(1);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('කෑමත් සමඟ දිය කර බොන්න');
    state().restoreLabel(saved);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('කෑමත් සමඟ හපලා කන්න දෙන්න');
    state().clearLabelInstructions(); expect(state().additionalInstructions).toEqual([]);
    state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });

  it.each(['8H', '6H', '5H', 'BD', 'TDS'])('%s retains mixed quantities and dynamic product type', code => {
    if (code === 'BD' || code === 'TDS') {
      for (const time of code === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) {
        state().openNumberPad(time); state().appendDigit('1 1/2'); state().confirmNumberPad();
      }
    } else { choose([code]); state().appendDigit('1 1/2'); state().confirmNumberPad(); }
    choose(['WITH FOOD', 'TAKE']);
    const output = printed();
    expect(output.built.instructionString).toContain('පැකට් 1½ බැගින්');
    expect(output.container.textContent).toContain('කෑමත් සමඟ ගන්න');
    expect(output.built.instructionString.split('කෑමත් සමඟ').length - 1).toBe(1);
  });

  it('preserves the STAT prefix and EOD interval modifier', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD', '6H', 'WITH FOOD', 'GIVE'],
      frequencyDosage: { qty: 0.5, isFraction: true },
      stat: { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '6H' } });
    const text = printed().container.textContent ?? '';
    expect(text).toContain('දිනක් හැර දිනක්, පැකට් ½ බැගින් පැය 6කට වරක් කෑමත් සමඟ දෙන්න');
  });
});
