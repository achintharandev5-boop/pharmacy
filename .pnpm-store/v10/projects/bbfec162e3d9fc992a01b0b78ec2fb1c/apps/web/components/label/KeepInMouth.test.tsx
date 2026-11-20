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
import { analyseAdministration, currentAdministrationText, specAdministrationText, setWordingModeForTests, keepInMouthPrintError } from '../../lib/instructionEngine';

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


describe.each(['current', 'spec'] as const)('Keep in Mouth (%s mode)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Packet' });
    state().setProductQuantity(10);
  });
  it.each([
    ['TAKE', 'BEFORE', 'තබා ගන්න කෑමට පෙර'], ['TAKE', 'AFTER', 'තබා ගන්න කෑමට පසු'],
    ['GIVE', 'BEFORE', 'තබන්න කෑමට පෙර'], ['GIVE', 'AFTER', 'තබන්න කෑමට පසු'],
  ])('standalone %s/%s generates one shared sentence', async (action, timing, suffix) => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Keep in Mouth'));
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    await user.click(button(action === 'TAKE' ? 'Take medication' : 'Give medication'));
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    expect(keepInMouthPrintError(state().labels[0])).toBe('Choose BEFORE or AFTER');
    await user.click(button(timing === 'BEFORE' ? 'Before meals' : 'After meals'));
    const expected = `දිව මත ${suffix}`;
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(expected);
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('KEEP IN MOUTH');
    expect(button('Keep in Mouth')).toHaveAttribute('data-selected', 'true');
    expect(button(action === 'TAKE' ? 'Take medication' : 'Give medication')).toHaveAttribute('data-selected', 'true');
    const output = printed();
    expect(output.built.instructionString).toBe(expected);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(expected);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(keepInMouthPrintError(state().labels[0])).toBeNull();
  });
  it.each([['TAKE', 'තබා ගන්න'], ['GIVE', 'තබන්න']])('Empty Stomach → Keep in Mouth → %s', async (action, verb) => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Empty Stomach'));
    for (const name of ['Keep in Mouth', 'Chewable', 'Dissolve and Drink']) expect(button(name)).toBeEnabled();
    expect(button('With Food')).toBeDisabled();
    await user.click(button('Keep in Mouth'));
    await user.click(button(action === 'TAKE' ? 'Take medication' : 'Give medication'));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH', 'KEEP IN MOUTH', action]);
    for (const name of ['Before meals', 'After meals', 'With Food', 'Chewable', 'Dissolve and Drink']) {
      expect(button(name)).toBeDisabled(); expect(button(name).className).toMatch(/opacity-(?:40|45)/);
      await user.click(button(name));
    }
    act(() => choose(['BEFORE', 'AFTER', 'WITH FOOD', 'CHEWABLE', 'DISSOLVE AND DRINK']));
    expect(state().additionalInstructions).toEqual(['EMPTY STOMACH', 'KEEP IN MOUTH', action]);
    const expected = `හිස් බඩ දිව මත ${verb}`;
    expect(currentAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(specAdministrationText(state().additionalInstructions)).toBe(expected);
    expect(printed().built.instructionString).toBe(expected);
  });
  it('locks incompatible methods in UI and store, then releases locks on deselection', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(button('Keep in Mouth'));
    for (const name of ['Chewable', 'Dissolve and Drink', 'With Food', 'Empty Stomach']) {
      expect(button(name)).toBeDisabled(); expect(button(name).className).toContain('opacity-45');
      await user.click(button(name));
    }
    act(() => choose(['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD', 'EMPTY STOMACH']));
    expect(state().additionalInstructions).toEqual(['KEEP IN MOUTH']);
    for (const name of ['Take medication', 'Give medication', 'Before meals', 'After meals']) expect(button(name)).toBeEnabled();
    await user.click(button('Keep in Mouth'));
    for (const name of ['Chewable', 'Dissolve and Drink', 'With Food', 'Empty Stomach']) expect(button(name)).toBeEnabled();
  });
  it.each(['CHEWABLE', 'DISSOLVE AND DRINK', 'WITH FOOD'])('refuses %s ? Keep in Mouth without replacing the existing method', method => {
    choose([method, 'KEEP IN MOUTH']); expect(state().additionalInstructions).toEqual([method]);
    expect(state().workflowNotice).toBeTruthy();
  });
  it.each([
    ['KEEP IN MOUTH'], ['KEEP IN MOUTH', 'TAKE'],
    ['KEEP IN MOUTH', 'EMPTY STOMACH', 'TAKE'],
    ['KEEP IN MOUTH', 'CHEWABLE', 'TAKE', 'AFTER'],
    ['DISSOLVE AND DRINK', 'KEEP IN MOUTH', 'TAKE', 'AFTER'],
    ['WITH FOOD', 'KEEP IN MOUTH', 'GIVE'],
  ])('rejects incomplete/invalid restored %j at review and supports correction', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    expect(analyseAdministration(codes, undefined, mode).text).toBeNull();
    expect(currentAdministrationText(codes)).toBeNull(); expect(specAdministrationText(codes)).toBeNull();
    const save = vi.fn(), print = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    expect(screen.getByTestId('keep-in-mouth-validation-blocked')).toHaveTextContent('Label 1:');
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['KEEP IN MOUTH', 'GIVE', 'BEFORE'] }));
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });
  it('preserves label ownership, valid restored combinations, Back and reset', () => {
    choose(['EMPTY STOMACH', 'KEEP IN MOUTH', 'GIVE']);
    const saved = structuredClone(state().labels[0]);
    state().openNumberPad('morning'); state().appendDigit('2'); state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(saved.additionalInstructions);
    state().addLabel(); choose(['KEEP IN MOUTH', 'TAKE', 'BEFORE']);
    state().selectLabel(0);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දිව මත තබන්න');
    state().selectLabel(1);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('දිව මත තබා ගන්න කෑමට පෙර');
    state().restoreLabel(saved);
    expect(currentAdministrationText(state().additionalInstructions)).toBe('හිස් බඩ දිව මත තබන්න');
    state().clearLabelInstructions(); expect(state().additionalInstructions).toEqual([]);
    state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });

  it.each(['8H', '6H', '5H', 'BD', 'TDS'])('%s retains mixed quantities and dynamic product type', code => {
    if (code === 'BD' || code === 'TDS') {
      for (const time of code === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) {
        state().openNumberPad(time); state().appendDigit('1 1/2'); state().confirmNumberPad();
      }
    } else { choose([code]); state().appendDigit('1 1/2'); state().confirmNumberPad(); }
    choose(['EMPTY STOMACH', 'KEEP IN MOUTH', 'TAKE']);
    const output = printed();
    expect(output.built.instructionString).toContain('පැකට් 1½ බැගින්');
    expect(output.container.textContent).toContain('හිස් බඩ දිව මත තබා ගන්න');
    expect(output.built.instructionString.split('දිව මත').length - 1).toBe(1);
  });

  it('preserves the STAT prefix and EOD interval modifier', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD', '6H', 'EMPTY STOMACH', 'KEEP IN MOUTH', 'GIVE'],
      frequencyDosage: { qty: 0.5, isFraction: true },
      stat: { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '6H' } });
    const text = printed().container.textContent ?? '';
    expect(text).toContain('දිනක් හැර දිනක්, පැකට් ½ බැගින් පැය 6කට වරක් හිස් බඩ දිව මත තබන්න');
  });
});
