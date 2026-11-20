import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelActions } from './LabelActions';
import { InstructionGrid } from './InstructionGrid';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, currentAdministrationText, setWordingModeForTests, specAdministrationText, usbPrintError } from '../../lib/instructionEngine';
import { defaultEnt } from '../../lib/ent';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const button = (name: string) => screen.getByRole('button', { name });
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
function printed() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return { built, ...render(<LabelCard labelItem={built} />) };
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('USB (%s mode)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
    state().setProductQuantity(10);
  });

  it.each([['TAKE', 'ගන්න'], ['GIVE', 'දෙන්න']])('ordinary %s preserves exact wording and preview/print consistency', async (action, verb) => {
    const user = userEvent.setup(); render(<><InstructionGrid /><LabelActions /></>);
    await user.click(button(action === 'TAKE' ? 'Take medication' : 'Give medication'));
    expect(usbPrintError(state().labels[0])).toBe('Choose BEFORE or AFTER');
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    await user.click(button('Before meals'));
    const expected = mode === 'spec' ? `${verb} කෑමට පෙර` : `කෑමට පෙර ${verb}`;
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(expected);
    const output = printed();
    expect(output.built.instructionString).toBe(expected);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(expected);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(usbPrintError(state().labels[0])).toBeNull();
  });

  it('supports keyboard/touch replacement, blue states and action deselection without changing product/dosage', async () => {
    const user = userEvent.setup();
    state().openNumberPad('morning'); state().appendDigit('1 1/2'); state().confirmNumberPad();
    const saved = structuredClone(state().labels[0]);
    render(<LabelActions />);
    button('Take medication').focus(); await user.keyboard('[Space]');
    expect(button('Take medication')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Take medication')).toHaveAttribute('data-selected', 'true');
    fireEvent.touchStart(button('Give medication')); fireEvent.touchEnd(button('Give medication'));
    await user.click(button('Give medication'));
    expect(state().additionalInstructions).toEqual(['GIVE']);
    expect(button('Give medication')).toHaveAttribute('data-selected', 'true');
    expect(button('Take medication')).not.toHaveAttribute('data-selected');
    button('Take medication').focus(); await user.keyboard('{Enter}');
    expect(state().additionalInstructions).toEqual(['TAKE']);
    await user.click(button('After meals')); await user.click(button('Take medication'));
    expect(state().additionalInstructions).toEqual(['AFTER']);
    expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    expect(screen.getByTestId('admin-status')).toHaveTextContent('Choose TAKE or GIVE');
    act(() => choose(['GIVE', 'TAKE'])); expect(state().additionalInstructions).toEqual(['AFTER', 'TAKE']);
    act(() => choose(['GIVE'])); expect(state().additionalInstructions).toEqual(['AFTER', 'GIVE']);
    expect(state().labels[0].product).toEqual(saved.product);
    expect(state().labels[0].dosage).toEqual(saved.dosage);
  });

  it.each([
    [[], 'ගන්න', 'දෙන්න', true],
    [['CHEWABLE'], 'හපලා කන්න', 'හපලා කන්න දෙන්න', true],
    [['WITH FOOD', 'CHEWABLE'], 'කෑමත් සමඟ හපලා කන්න', 'කෑමත් සමඟ හපලා කන්න දෙන්න', false],
    [['EMPTY STOMACH', 'CHEWABLE'], 'හිස් බඩ හපලා කන්න', 'හිස් බඩ හපලා කන්න දෙන්න', false],
    [['DISSOLVE AND DRINK'], 'දිය කර බොන්න', 'දිය කර බොන්න දෙන්න', true],
    [['WITH FOOD', 'DISSOLVE AND DRINK'], 'කෑමත් සමඟ දිය කර බොන්න', 'කෑමත් සමඟ දිය කර බොන්න දෙන්න', false],
    [['EMPTY STOMACH', 'DISSOLVE AND DRINK'], 'හිස් බඩ දිය කර බොන්න', 'හිස් බඩ දිය කර බොන්න දෙන්න', false],
    [['WITH FOOD'], 'කෑමත් සමඟ ගන්න', 'කෑමත් සමඟ දෙන්න', false],
    [['EMPTY STOMACH'], 'හිස් බඩ ගන්න', 'හිස් බඩ දෙන්න', false],
    [['KEEP IN MOUTH'], 'දිව මත තබා ගන්න', 'දිව මත තබන්න', true],
    [['EMPTY STOMACH', 'KEEP IN MOUTH'], 'හිස් බඩ දිව මත තබා ගන්න', 'හිස් බඩ දිව මත තබන්න', false],
  ] as const)('%j uses method-specific verbs when actions change', (codes, take, give, timing) => {
    choose([...codes]);
    for (const [action, phrase] of [['TAKE', take], ['GIVE', give], ['TAKE', take]] as const) {
      choose([action]); if (timing && !state().additionalInstructions.includes('AFTER')) choose(['AFTER']);
      const expected = timing
        ? codes.length === 0 && mode === 'current' ? `කෑමට පසු ${phrase}`
          : `${mode === 'current' && codes[0] === 'CHEWABLE' ? phrase.replace('හපලා', 'සපලා') : phrase} කෑමට පසු`
        : phrase;
      expect(buildFinalInstruction(state().labels[0]).instructionString).toBe(expected);
      expect(state().additionalInstructions.filter(i => i === 'TAKE' || i === 'GIVE')).toEqual([action]);
      expect(usbPrintError(state().labels[0])).toBeNull();
    }
    render(<LabelActions />);
    // Locked buttons are aria-disabled (focusable, explained); toBeDisabled covers both forms.
    for (const name of ['Before meals', 'After meals']) {
      if (timing) expect(button(name)).toBeEnabled(); else expect(button(name)).toBeDisabled();
    }
  });

  it.each([
    ['AFTER'], ['TAKE'], ['TAKE', 'GIVE', 'AFTER'],
    ['WITH FOOD', 'TAKE', 'GIVE'], ['CHEWABLE'],
  ])('rejects incomplete/conflicting legacy USB %j at review and permits correction', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    expect(currentAdministrationText(codes)).toBeNull(); expect(specAdministrationText(codes)).toBeNull();
    expect(analyseLabel(state().labels[0]).blocking).toBeTruthy();
    const save = vi.fn(), print = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    expect(screen.getByTestId('usb-validation-blocked')).toHaveTextContent('Label 1:');
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['GIVE', 'AFTER'] }));
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('preserves Back, label ownership/restoration, deselection and reset', () => {
    choose(['TAKE', 'BEFORE']); const saved = structuredClone(state().labels[0]);
    state().openNumberPad('morning'); state().appendDigit('3'); state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(['TAKE', 'BEFORE']);
    state().addLabel(); choose(['GIVE', 'AFTER']); state().selectLabel(0);
    expect(state().additionalInstructions).toEqual(['TAKE', 'BEFORE']);
    state().selectLabel(1); expect(state().additionalInstructions).toEqual(['GIVE', 'AFTER']);
    state().restoreLabel(saved); expect(state().additionalInstructions).toEqual(['TAKE', 'BEFORE']);
    choose(['TAKE']); expect(currentAdministrationText(state().additionalInstructions)).toBeNull();
    state().clearLabelInstructions(); expect(state().additionalInstructions).toEqual([]);
    state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });

  it.each(['8H', '6H', '5H', 'BD', 'TDS', 'FOUR'])('%s requires action and retains mixed quantities on switching to GIVE', code => {
    if (['BD', 'TDS', 'FOUR'].includes(code)) {
      if (code === 'FOUR') { choose(['EVENING']); state().appendDigit('1 1/2'); state().confirmNumberPad(); state().confirmEvening(); }
      for (const time of code === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) {
        state().openNumberPad(time); state().appendDigit('1 1/2'); state().confirmNumberPad();
      }
    } else { choose([code]); state().appendDigit('1 1/2'); state().confirmNumberPad(); }
    expect(usbPrintError(state().labels[0])).toBe('Choose TAKE or GIVE');
    choose(['TAKE', 'AFTER', 'GIVE']);
    const output = printed();
    expect(output.built.instructionString).toContain('කරල් 1½ බැගින්');
    expect(output.built.instructionString).toContain(mode === 'spec' ? 'දෙන්න කෑමට පසු' : 'කෑමට පසු දෙන්න');
    expect(output.built.instructionString).not.toContain('ගන්න');
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent((output.built.additionalInstructions ?? []).join(' '));
  });

  it.each([['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']])('%s keeps STAT and EOD doses separate from follow-up USB', (type, word) => {
    state().restoreLabel({ ...state().labels[0], product: { id: type, name: type, product_type: type },
      additionalInstructions: ['EOD', '6H', 'GIVE', 'AFTER'], frequencyDosage: { qty: 0.5, isFraction: true },
      stat: { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '6H' } });
    expect(usbPrintError(state().labels[0])).toBeNull();
    const output = printed();
    expect(output.built.instructionString).toContain(`දිනක් හැර දිනක්, ${word} ½ බැගින් පැය 6කට වරක්`);
  });

  it.each([[], ['REMOVE ADDRESS'], ['TILL TO DAY'], ['WEEKLY']])('requires USB for quantity-bearing Weekly but preserves text-only %j labels', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    if ((codes as string[]).includes('WEEKLY')) expect(usbPrintError(state().labels[0])).toBeTruthy();
    else expect(usbPrintError(state().labels[0])).toBeNull();
  });
  it('preserves ENT actions and the STAT-only exception without imposing oral USB', () => {
    state().setEnt(defaultEnt('eye')); state().incrementDosage('morning');
    expect(usbPrintError(state().labels[0])).toBeNull();
    expect(analyseLabel(state().labels[0]).blocking).toBeNull();
    expect(printed().built.instructionString).toContain('Instill 1 drop into the left eye in the morning.');
    state().allClear();
    state().restoreLabel({ ...state().labels[0], stat: { qty: 2, isFraction: false, administration: ['TAKE'], followUp: null } });
    expect(usbPrintError(state().labels[0])).toBeNull();
    expect(analyseLabel(state().labels[0]).blocking).toContain('follow-up');
  });
});
