import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, setWordingModeForTests, statPrintError } from '../../lib/instructionEngine';
import { defaultEnt } from '../../lib/ent';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const button = (name: string | RegExp) => screen.getByRole('button', { name });
function choose(codes: string[]) { for (const code of codes) state().toggleAdditionalInstruction(code); }
function initial(qty = '2') {
  state().startStat(); state().openNumberPad('stat'); state().appendDigit(qty); state().confirmNumberPad(); state().doneStat();
}
function interval(code = '8H', qty = '1/2') {
  choose([code]); state().appendDigit(qty); state().confirmNumberPad();
}
function printed() {
  const built = buildFinalInstruction(state().labels[state().activeLabelIndex]);
  return { built, ...render(<LabelCard labelItem={built} />) };
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('STAT complete workflow (%s mode)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10);
  });

  it('locks main controls until Done, returns to Function Pad and preserves an independent mixed initial dose', async () => {
    const user = userEvent.setup(); render(<><InstructionGrid /><ActionWorkspace /></>);
    await user.click(button('STAT')); expect(button('Done (Next)')).toBeDisabled();
    expect(button('Take medication')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Increase MORNING dosage' })).toBeNull(); // the STAT panel is open on the right in place of the dosage rows
    act(() => { choose(['8H', 'WITH FOOD']); state().incrementDosage('morning'); state().openNumberPad('morning'); });
    expect(state().additionalInstructions).toEqual(['STAT']); expect(state().dosage.morning.qty).toBe(0);
    await user.click(button('Increase STAT quantity'));
    await user.click(button('Enter STAT fraction')); await user.click(button('1/2')); // compact X/Y applies at once
    expect(state().stat?.qty).toBe(1.5); expect(state().activeControl).toBe('stat');
    await user.click(button('Done (Next)'));
    expect(state().activeControl).toBe('idle'); expect(button('STAT')).toHaveAttribute('data-selected', 'true');
    expect(statPrintError(state().labels[0])).toContain('follow-up');
    await user.click(button('8H')); await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    await user.click(button('Empty Stomach')); await user.click(button('Take medication'));
    const output = printed();
    expect(output.built.instructionString).toBe('පළමුව පමණක් 1½ ගන්න ඉන්පසු, කරල් 1 බැගින් පැය 8කට වරක් හිස් බඩ ගන්න');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent(output.built.instructionString);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(output.built.instructionString);
    expect(output.container.querySelector('[data-label-body]')?.firstElementChild).toHaveAttribute('data-stat-phrase');
    expect(output.built.finalInstructionText).toBe(output.built.instructionString);
    expect(output.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(output.built.dosageText).not.toContain('STAT');
    expect(state().stat?.qty).toBe(1.5); expect(state().frequencyDosage.qty).toBe(1);
  });

  it.each(['8H', '6H', '5H'])('%s supports independent whole/fractional/mixed quantities and all catalogue types', code => {
    for (const [type, word] of [['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']]) {
      state().restoreLabel({ ...state().labels[0], product: { id: type, name: type, product_type: type },
        stat: { qty: 1.5, isFraction: true, followUp: code }, additionalInstructions: ['STAT', code, 'EMPTY STOMACH', 'GIVE'],
        frequencyDosage: { qty: 0.5, isFraction: true } });
      expect(buildFinalInstruction(state().labels[0]).instructionString).toBe(`පළමුව පමණක් 1½ ගන්න ඉන්පසු, ${word} ½ බැගින් පැය ${code[0]}කට වරක් හිස් බඩ දෙන්න`);
      expect(statPrintError(state().labels[0])).toBeNull();
    }
  });

  it.each([
    ['TAKE', 'AFTER'], ['GIVE', 'BEFORE'], ['WITH FOOD', 'TAKE'], ['EMPTY STOMACH', 'GIVE'],
    ['CHEWABLE', 'TAKE', 'AFTER'], ['DISSOLVE AND DRINK', 'GIVE', 'BEFORE'], ['KEEP IN MOUTH', 'TAKE', 'AFTER'],
    ['WITH FOOD', 'CHEWABLE', 'GIVE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK', 'TAKE'], ['EMPTY STOMACH', 'KEEP IN MOUTH', 'GIVE'],
  ])('preserves the method-specific follow-up %j', (...admin) => {
    initial(); interval('6H', '1/2'); choose(admin);
    const output = printed(); expect(statPrintError(state().labels[0])).toBeNull();
    expect(output.built.instructionString).toMatch(/^පළමුව පමණක් 2 ගන්න ඉන්පසු, කරල් ½ බැගින් පැය 6කට වරක් /);
    expect(output.built.instructionString.split('පළමුව පමණක්').length - 1).toBe(1);
    expect(output.container.querySelector('[data-label-body]')).toHaveTextContent(output.built.instructionString);
    expect(output.container.textContent).not.toContain('STAT 2');
  });

  it.each(['EOD', 'EOD_INTERVAL', 'DAILY', 'EVENING', 'WEEKLY', 'BD', 'TDS', 'FOUR'])('supports STAT → %s without inventing an initial product type', code => {
    initial('2');
    if (code === 'EOD' || code === 'EOD_INTERVAL') {
      state().setStatFollowUp('EOD'); if (code === 'EOD_INTERVAL') { interval(); choose(['EMPTY STOMACH', 'TAKE']); }
    } else if (['DAILY', 'EVENING', 'WEEKLY'].includes(code)) {
      choose([code]); state().appendDigit('1'); state().confirmNumberPad(); choose(['TAKE', 'AFTER']);
    } else {
      if (code === 'FOUR') { choose(['EVENING']); state().appendDigit('1'); state().confirmNumberPad(); state().confirmEvening(); }
      for (const time of code === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) state().incrementDosage(time);
      choose(['TAKE', 'AFTER']);
    }
    const output = printed(); expect(statPrintError(state().labels[0])).toBeNull();
    expect(output.built.instructionString).toMatch(/^පළමුව පමණක් 2 ගන්න ඉන්පසු, /);
    expect(output.built.instructionString.split('පළමුව පමණක්').length - 1).toBe(1);
    expect(output.built.instructionString).not.toContain('THEN'); expect(output.built.instructionString).not.toContain('STAT');
    expect(output.built.instructionString).not.toMatch(/\b(?:DAILY|EVENING|WEEKLY)\b/);
    expect(output.container.querySelector('[data-label-body]')?.firstElementChild).toHaveAttribute('data-stat-phrase');
    if (code === 'EOD') expect(output.built.instructionString).toBe('පළමුව පමණක් 2 ගන්න ඉන්පසු, දිනක් හැර දිනක්');
    if (code === 'WEEKLY') expect(output.built.instructionString).toContain('සතියකට වරක් 1');
    if (code.startsWith('EOD')) expect(output.built.instructionString.split('දිනක් හැර දිනක්').length - 1).toBe(1);
  });

  it.each(['8H', '6H', '5H', 'DAILY', 'EVENING', 'WEEKLY', 'EOD', 'CHEWABLE', 'TAKE'])('refuses new STAT after %s in UI and direct store actions', code => {
    choose([code]); state().cancelNumberPad(); render(<><InstructionGrid /><ActionWorkspace /></>);
    expect(button('STAT')).toBeDisabled(); expect(button('STAT').className).toContain('opacity-45');
    fireEvent.click(button('STAT')); act(() => { state().startStat(); choose(['STAT']); state().openNumberPad('stat'); state().incrementDosage('stat'); });
    expect(state().stat).toBeNull(); expect(state().additionalInstructions).toEqual([code]);
  });

  it.each(['4H', 'CUSTOM', 'SOS', 'TILL DATE', 'AND THIS DATE'])('refuses unsupported STAT follow-up %s without changing the quantity', code => {
    initial(); choose([code]); state().setStatFollowUp(code);
    expect(state().additionalInstructions).toEqual(['STAT']); expect(state().stat?.qty).toBe(2);
    expect(state().workflowNotice).toBeTruthy();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid initial quantity %s and supports correction', qty => {
    state().restoreLabel({ ...state().labels[0], stat: { qty, isFraction: false, followUp: '8H' },
      additionalInstructions: ['STAT', '8H', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: { qty: 0.5, isFraction: true } });
    expect(statPrintError(state().labels[0])).toContain('positive STAT quantity');
    const save = vi.fn(), print = vi.fn(); render(<LabelActionPage onSave={save} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={print} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    expect(screen.getByTestId('stat-validation-blocked')).toHaveTextContent('Label 1:');
    fireEvent.click(button('Save without printing')); fireEvent.click(button('Print & Save'));
    expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...state().labels[0], stat: { qty: 2, isFraction: false, followUp: '8H' } }));
    expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it.each([['STAT'], ['8H', 'STAT', 'TAKE', 'AFTER'], ['STAT', 'SOS'], ['STAT', '8H', '6H', 'TAKE', 'AFTER']])('rejects malformed/STAT-only restored %j', (...codes) => {
    state().restoreLabel({ ...state().labels[0], stat: { qty: 2, isFraction: false, followUp: '8H' }, additionalInstructions: codes, frequencyDosage: { qty: 1, isFraction: false } });
    expect(analyseLabel(state().labels[0]).blocking).toBeTruthy(); expect(statPrintError(state().labels[0])).toBeTruthy();
    expect(buildFinalInstruction(state().labels[0]).instructionString).toBe('');
  });

  it('preserves quantity correction, pad Back, cancellation, per-label restoration and reset', () => {
    initial(); interval(); choose(['EMPTY STOMACH', 'TAKE']); const saved = structuredClone(state().labels[0]);
    state().startStat(); state().incrementDosage('stat'); state().openNumberPad('stat_fraction'); state().cancelNumberPad(); state().cancelStat();
    expect(state().labels[0]).toEqual(saved);
    state().startStat(); state().decrementDosage('stat'); state().doneStat(); expect(state().stat?.qty).toBe(1);
    expect(state().frequencyDosage.qty).toBe(0.5);
    state().addLabel(); initial('3'); choose(['EOD']); state().selectLabel(0); expect(state().stat?.qty).toBe(1);
    state().selectLabel(1); expect(state().stat?.qty).toBe(3); state().restoreLabel(saved); expect(state().stat?.qty).toBe(2);
    state().removeStat(); expect(state().additionalInstructions).not.toContain('STAT'); expect(state().frequencyDosage.qty).toBe(0.5);
    state().allClear(); state().startStat(); state().cancelStat(); expect(state().additionalInstructions).toEqual([]); expect(state().stat).toBeNull();
  });

  it('preserves ENT as a separate supported follow-up without oral product types', () => {
    initial(); state().setEnt(defaultEnt('eye')); state().incrementDosage('morning');
    const output = printed(); expect(statPrintError(state().labels[0])).toBeNull();
    expect(output.built.instructionString).toContain('Instill 1 drop into the left eye in the morning.');
    expect(output.built.instructionString).not.toContain('කරල්');
  });
  it('blocks pending quantity edits at review and restores availability on Cancel', () => {
    initial(); interval(); choose(['EMPTY STOMACH', 'TAKE']);
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={vi.fn()} />);
    expect(button('Print & Save')).toBeEnabled();
    act(() => { state().startStat(); state().incrementDosage('stat'); state().openReasonsPanel(); state().setActiveControl('idle'); });
    expect(state().activeControl).toBe('stat');
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    expect(screen.getByTestId('stat-validation-blocked')).toHaveTextContent('Confirm or cancel');
    act(() => state().cancelStat()); expect(button('Print & Save')).toBeEnabled(); expect(state().stat?.qty).toBe(2);
  });
  it('rejects unsupported legacy follow-up metadata instead of printing an English tag', () => {
    initial(); interval(); choose(['EMPTY STOMACH', 'TAKE']);
    state().restoreLabel({ ...state().labels[0], stat: { qty: 2, isFraction: false, followUp: 'SOS' } });
    expect(statPrintError(state().labels[0])).toContain('saved STAT follow-up is unsupported');
    expect(buildFinalInstruction(state().labels[0]).instructionString).toBe('');
  });
});
