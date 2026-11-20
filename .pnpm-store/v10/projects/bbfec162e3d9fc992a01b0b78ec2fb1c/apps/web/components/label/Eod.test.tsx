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
import { analyseLabel, eodPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { EOD_TEXT } from '../../lib/eod';
import { defaultEnt } from '../../lib/ent';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const button = (name: string | RegExp) => screen.getByRole('button', { name });
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
function printed() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return { built, ...render(<LabelCard labelItem={built} />) };
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('EOD (%s mode)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
    state().setProductQuantity(10);
  });

  it('is exactly text-only, opens no pad and permits review Save/Print without USB or a product type', async () => {
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: null });
    const user = userEvent.setup(); render(<><InstructionGrid /><LabelActions /></>);
    await user.click(button('EOD'));
    expect(button('EOD')).toHaveAttribute('data-selected', 'true');
    expect(state().activeControl).toBe('idle'); expect(state().numberPad.visible).toBe(false);
    expect(state().frequencyDosage.qty).toBe(0); expect(state().additionalInstructions).toEqual(['EOD']);
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('EOD');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(EOD_TEXT);
    expect(analyseLabel(state().labels[0]).blocking).toBeNull();
    const output = printed();
    expect(output.built.instructionString).toBe(EOD_TEXT); expect(output.built.frequencyDosage).toBeUndefined();
    expect(output.built.dosageText).toBe('');
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(EOD_TEXT);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={vi.fn()} />);
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('natively locks conflicting modes, days and new STAT, and refuses direct calls without replacement', async () => {
    const user = userEvent.setup(); render(<InstructionGrid />); await user.click(button('EOD'));
    // Till to the Day and Edit start day are inside the Name of Days panel, which EOD locks.
    for (const name of ['Weekly', 'STAT', /^Name of Days/]) {
      expect(button(name)).toBeDisabled(); expect(button(name).className).toContain('opacity-45');
      await user.click(button(name));
    }
    act(() => {
      choose(['WEEKLY', 'TILL DATE', 'AND THIS DATE', '4H', 'CUSTOM', 'SOS']);
      state().startStat(); state().setStatFollowUp('EOD'); state().openDaysOfWeekPanel();
      state().toggleDayOfWeek('MONDAY'); state().setDaysOfWeek(['MONDAY']);
    });
    expect(state().additionalInstructions).toEqual(['EOD']); expect(state().stat).toBeNull();
    expect(state().selectedDaysOfWeek).toEqual([]); expect(state().activeControl).toBe('idle');
    await user.click(button('EOD'));
    for (const name of ['Weekly', 'STAT', /^Name of Days/]) expect(button(name)).toBeEnabled();
  });

  it.each(['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY', 'CHEWABLE', 'WITH FOOD', 'TAKE'])('refuses %s → EOD', code => {
    choose([code]); state().cancelNumberPad(); const saved = structuredClone(state().labels[0]);
    choose(['EOD']); expect(state().labels[0]).toEqual(saved); expect(state().workflowNotice).toContain('EOD first');
  });

  it('refuses EOD after digital doses or selected days', () => {
    state().incrementDosage('morning'); choose(['EOD']); expect(state().additionalInstructions).not.toContain('EOD');
    state().allClear(); state().setDaysOfWeek(['MONDAY']); choose(['EOD']);
    expect(state().additionalInstructions).not.toContain('EOD');
  });

  it.each(['8H', '6H', '5H'])('preserves EOD first and locks other dosing modes after %s', async code => {
    choose(['EOD', code]); state().appendDigit('1/2'); state().confirmNumberPad();
    render(<><InstructionGrid /><DosagePanel /></>);
    for (const other of ['8H', '6H', '5H'].filter(i => i !== code)) {
      expect(button(other)).toBeDisabled(); fireEvent.click(button(other));
      act(() => choose([other]));
    }
    expect(button('Daily')).toBeDisabled(); expect(button('Evening')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Increase MORNING/ })).toBeDisabled();
    act(() => { state().incrementDosage('morning'); state().openNumberPad('morning'); });
    expect(state().dosage.morning.qty).toBe(0); expect(state().numberPad.visible).toBe(false);
    expect(state().additionalInstructions).toEqual(['EOD', code]);
    act(() => choose(['EOD']));
    expect(state().additionalInstructions).toEqual([code]); expect(state().frequencyDosage.qty).toBe(0.5);
    expect(button('EOD')).toBeDisabled(); // Cannot re-add EOD after the remaining interval.
  });

  it.each(['Pethi', 'Karal', 'Packet'])('%s retains exact EOD interval text with half/mixed quantities and all intervals', type => {
    state().setProduct({ id: type, name: type, product_type: type });
    const word = type === 'Pethi' ? 'පෙති' : type === 'Karal' ? 'කරල්' : 'පැකට්';
    for (const code of ['8H', '6H', '5H']) for (const qty of [0.5, 1.5]) {
      state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD', code, 'EMPTY STOMACH', 'TAKE'], frequencyDosage: { qty, isFraction: true } });
      const text = buildFinalInstruction(state().labels[0]).instructionString;
      expect(text).toBe(`දිනක් හැර දිනක්, ${word} ${qty === 0.5 ? '½' : '1½'} බැගින් පැය ${code[0]}කට වරක් හිස් බඩ ගන්න`);
      expect(eodPrintError(state().labels[0])).toBeNull();
    }
  });

  it.each([
    ['TAKE', 'AFTER'], ['GIVE', 'BEFORE'], ['WITH FOOD', 'TAKE'], ['EMPTY STOMACH', 'GIVE'],
    ['CHEWABLE', 'TAKE', 'AFTER'], ['DISSOLVE AND DRINK', 'GIVE', 'BEFORE'], ['KEEP IN MOUTH', 'TAKE', 'AFTER'],
    ['WITH FOOD', 'CHEWABLE', 'GIVE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE'], ['EMPTY STOMACH', 'KEEP IN MOUTH', 'GIVE'],
  ])('preserves USB/SAM %j in the EOD interval', (...admin) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD', '6H', ...admin], frequencyDosage: { qty: 1.5, isFraction: true } });
    const output = printed();
    expect(output.built.instructionString).toMatch(/^දිනක් හැර දිනක්, කරල් 1½ බැගින් පැය 6කට වරක් /);
    expect(output.built.instructionString.split(EOD_TEXT).length - 1).toBe(1);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(output.built.instructionString);
    expect(eodPrintError(state().labels[0])).toBeNull();
  });

  it.each(['BD', 'TDS', 'FOUR', 'MORNING', 'LUNCH', 'NIGHT', 'DAILY', 'EVENING'])('supports EOD → %s without losing EOD or inventing a type', code => {
    choose(['EOD']);
    if (['DAILY', 'EVENING'].includes(code)) { choose([code]); state().appendDigit('1'); state().confirmNumberPad(); }
    else {
      const times = code === 'BD' ? ['morning', 'night'] as const : ['TDS', 'FOUR'].includes(code) ? ['morning', 'lunch', 'night'] as const : [code.toLowerCase() as 'morning' | 'lunch' | 'night'];
      for (const time of times) state().incrementDosage(time);
      if (code === 'FOUR') { choose(['EVENING']); state().appendDigit('1'); state().confirmNumberPad(); }
    }
    choose(['TAKE', 'AFTER']);
    const built = buildFinalInstruction(state().labels[0]);
    expect(built.instructionString).toContain(EOD_TEXT); expect(built.instructionString.split(EOD_TEXT).length - 1).toBe(1);
    expect(state().additionalInstructions[0]).toBe('EOD'); expect(eodPrintError(state().labels[0])).toBeNull();
    if (!['BD', 'TDS', 'FOUR'].includes(code)) expect(built.instructionString).not.toContain('කරල්');
    choose(['WEEKLY']); expect(state().additionalInstructions).not.toContain('WEEKLY');
  });

  it.each([
    ['6H', 'EOD', 'TAKE', 'AFTER'], ['WITH FOOD', 'EOD', 'TAKE'], ['EOD', 'WEEKLY'],
    ['EOD', 'TILL DATE'], ['EOD', '8H', '6H', 'TAKE', 'AFTER'], ['EOD', 'EOD'],
  ])('rejects malformed restored %j at review and allows correction', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    expect(analyseLabel(state().labels[0]).blocking).toBeTruthy();
    expect(buildFinalInstruction(state().labels[0]).instructionString).toBe('');
    const save = vi.fn(), print = vi.fn();
    render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    expect(screen.getByTestId('eod-validation-blocked')).toHaveTextContent('Label 1:');
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD'] }));
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('rejects legacy EOD quantities and day conflicts without rewriting records, then corrects by deselection', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD'], frequencyDosage: { qty: 2, isFraction: false } });
    expect(eodPrintError(state().labels[0])).toContain('EOD has no quantity');
    expect(buildFinalInstruction(state().labels[0]).frequencyDosage).toBeUndefined();
    choose(['EOD', 'EOD']); expect(state().frequencyDosage.qty).toBe(0);
    expect(eodPrintError(state().labels[0])).toBeNull();
    state().restoreLabel({ ...state().labels[0], selectedDaysOfWeek: ['MONDAY'] });
    expect(eodPrintError(state().labels[0])).toContain('selected days');
    state().setDaysOfWeek([]); expect(eodPrintError(state().labels[0])).toBeNull();
  });

  it('preserves STAT → EOD and separate doses through the existing STAT follow-up panel', () => {
    state().startStat(); state().openNumberPad('stat'); state().appendDigit('2'); state().confirmNumberPad(); state().doneStat();
    
    state().setStatFollowUp('EOD'); expect(state().additionalInstructions).toEqual(['STAT', 'EOD']);
    expect(state().numberPad.visible).toBe(false); expect(state().stat?.qty).toBe(2);
    choose(['8H']); state().appendDigit('1/2'); state().confirmNumberPad(); choose(['EMPTY STOMACH', 'TAKE']);
    const output = printed();
    expect(output.built.instructionString).toContain('දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ ගන්න');
    expect(output.built.instructionString.split(EOD_TEXT).length - 1).toBe(1);
    expect(state().stat?.qty).toBe(2); expect(state().frequencyDosage.qty).toBe(0.5);
    expect(output.container.textContent).not.toContain('then EOD');
    expect(output.container.textContent).not.toContain('THEN EOD');
  });

  it('preserves per-label navigation, restoration, Back/reset and ENT units', () => {
    choose(['EOD']); const saved = structuredClone(state().labels[0]);
    state().openNumberPad('morning'); state().appendDigit('2'); state().cancelNumberPad();
    expect(state().additionalInstructions).toEqual(['EOD']); expect(state().dosage.morning.qty).toBe(0);
    state().addLabel(); choose(['TAKE', 'AFTER']); state().selectLabel(0);
    expect(buildFinalInstruction(state().labels[0]).instructionString).toBe(EOD_TEXT);
    state().selectLabel(1); expect(state().additionalInstructions).toEqual(['TAKE', 'AFTER']);
    state().restoreLabel(saved); expect(state().additionalInstructions).toEqual(['EOD']);
    state().setEnt(defaultEnt('eye')); state().incrementDosage('morning');
    expect(buildFinalInstruction(state().labels[1]).instructionString).toContain('Instill 1 drop into the left eye in the morning.');
    state().clearLabelInstructions(); expect(state().additionalInstructions).toEqual([]);
    state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });
});
