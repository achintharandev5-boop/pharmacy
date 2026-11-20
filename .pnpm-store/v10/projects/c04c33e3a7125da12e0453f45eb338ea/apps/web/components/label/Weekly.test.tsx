import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, weeklyPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { defaultEnt } from '../../lib/ent';
import { labelFitReport } from '../../lib/labelFit';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
const button = (name: string | RegExp) => screen.getByRole('button', { name });
function weekly(qty = '1', done = false) { choose('WEEKLY'); state().appendDigit(qty); state().confirmNumberPad(); if (done) state().confirmWeekly(); }
function digital(morning: number, lunch: number, night: number) {
  for (const [time, qty] of Object.entries({ morning, lunch, night })) {
    state().openNumberPad(time as 'morning' | 'lunch' | 'night'); state().appendDigit(qty === 1.5 ? '1 1/2' : qty === 0.5 ? '1/2' : String(qty)); state().confirmNumberPad();
  }
}
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Weekly dosing (%s)', mode => {
  beforeEach(() => { state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]); state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10); });

  it('opens its own quantity pad, never assumes one, and unlocks schedules only after Done', () => {
    render(<><InstructionGrid /><ActionWorkspace /></>);
    fireEvent.click(button('Weekly')); expect(state().numberPad.targetControl).toBe('weekly'); expect(state().weeklyDosage.qty).toBe(0);
    expect(button('Done - Weekly')).toBeDisabled(); fireEvent.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); fireEvent.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    expect(button(/^Weekly 1$/)).toHaveAttribute('data-selected', 'true'); expect(button('Daily')).toBeDisabled(); expect(button('Evening')).toBeDisabled(); expect(button('Increase MORNING dosage')).toBeDisabled();
    for (const code of ['DAILY', 'EVENING']) act(() => choose(code)); act(() => state().incrementDosage('morning'));
    expect(state().additionalInstructions).toEqual(['WEEKLY']); expect(state().dosage.morning.qty).toBe(0);
    fireEvent.click(button('Done - Weekly')); expect(state().weeklyDosage.confirmed).toBe(true); expect(button('Daily')).toBeEnabled(); expect(button('Evening')).toBeEnabled(); expect(button('Increase MORNING dosage')).toBeEnabled();
    for (const code of ['8H', '6H', '5H', 'EOD']) { expect(button(code)).toBeDisabled(); expect(button(code)).toHaveClass('opacity-45'); fireEvent.click(button(code)); act(() => choose(code)); }
    expect(state().additionalInstructions).toEqual(['WEEKLY']);
  });

  it.each([['1', '1'], ['1/2', '½'], ['1 1/2', '1½'], ['1/3', '1/3']])('prints standalone Weekly quantity %s without requiring Done or a product type', (qty, formatted) => {
    weekly(qty); state().setProduct({ id: 'missing', name: 'Missing', product_type: null }); choose('WITH FOOD', 'TAKE');
    const built = buildFinalInstruction(label()); const expected = `සතියකට වරක් ${formatted} කෑමත් සමඟ ගන්න`;
    expect(weeklyPrintError(label())).toBeNull(); expect(built.finalInstructionText).toBe(expected); expect(built.instructionString).toBe(expected); expect(built.frequencyDosage).toBeUndefined();
    const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(expected); expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]'); expect(view.container.querySelector('[data-label-body]')).toHaveClass('flex-1'); // the instruction area takes all height the optional rows leave free
  });

  it.each(['TAKE', 'GIVE'])('uses %s with approved timing and completed ordered SAMs without duplicate wording', action => {
    for (const methods of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
      for (const timing of ['BEFORE', 'AFTER']) {
        state().allClear(); weekly('1/2'); choose(...methods, action); if (!methods.some(code => ['WITH FOOD', 'EMPTY STOMACH'].includes(code))) choose(timing);
        const text = buildFinalInstruction(label()).instructionString; expect(weeklyPrintError(label())).toBeNull(); expect(text).toMatch(/^සතියකට වරක් ½ /); expect(text.match(/සතියකට වරක්/g)).toHaveLength(1); expect(text).not.toMatch(/WEEKLY|TAKE|GIVE/);
        if (methods.some(code => ['WITH FOOD', 'EMPTY STOMACH'].includes(code))) expect(text).not.toMatch(/කෑමට පෙර|කෑමට පසු/);
      }
    }
  });

  it.each(['Pethi', 'Karal', 'Packet'])('preserves %s product type and actual equal BD/TDS quantity independently of Weekly entry', type => {
    for (const lunch of [0, 1.5]) {
      state().allClear(); state().setProduct({ id: 'x', name: 'X', product_type: type }); weekly('3', true); digital(1.5, lunch, 1.5); choose('EMPTY STOMACH', 'TAKE');
      const built = buildFinalInstruction(label()); const word = { Pethi: 'පෙති', Karal: 'කරල්', Packet: 'පැකට්' }[type];
      expect(built.instructionString).toBe(`${word} 1½ සතියකට වරක් හිස් බඩ ගන්න`); expect(built.consolidatedDosage).toBe(true); expect(weeklyPrintError(label())).toBeNull(); expect(state().weeklyDosage.qty).toBe(3);
    }
  });

  it.each([[1.5, 0, 0.5], [0, 0.5, 0], [1, 2, 3]])('retains Weekly above circled rows for %j', (morning, lunch, night) => {
    weekly('2', true); digital(morning, lunch, night); choose('EMPTY STOMACH', 'GIVE'); state().setProduct({ id: 'x', name: 'X', product_type: null });
    const built = buildFinalInstruction(label()); expect(weeklyPrintError(label())).toBeNull(); expect(built.weeklyPrefix).toBe('සතියකට වරක්'); expect(built.finalInstructionText).toMatch(/^සතියකට වරක් /); expect(built.finalInstructionText?.match(/සතියකට වරක්/g)).toHaveLength(1); expect(built.instructionString).not.toMatch(/පෙති|කරල්|පැකට්|WEEKLY/);
    const view = render(<LabelCard labelItem={built} />); const body = view.container.querySelector('[data-label-body]')!; expect(body.textContent?.startsWith('සතියකට වරක්')).toBe(true); expect(body.querySelector('[data-digital-layout="unequal"]')).toBeTruthy(); expect(body.querySelectorAll('[data-dose-badge]')).toHaveLength([morning, lunch, night].filter(qty => qty > 0).length);
  });

  it.each(['DAILY', 'EVENING'])('retains independent subsequent %s quantity and rejects reverse order', code => {
    weekly('3', true); choose(code); state().appendDigit('1/2'); state().confirmNumberPad(); choose('EMPTY STOMACH', 'TAKE');
    const built = buildFinalInstruction(label()); expect(built.instructionString).toBe(code === 'DAILY' ? 'සතියකට වරක් දිනකට ½ හිස් බඩ ගන්න' : 'සතියකට වරක් ½ හවසට හිස් බඩ ගන්න'); expect(weeklyPrintError(label())).toBeNull(); expect(state().weeklyDosage.qty).toBe(3);
    state().allClear(); choose(code); state().appendDigit('1'); state().confirmNumberPad(); choose('WEEKLY'); expect(state().additionalInstructions).not.toContain('WEEKLY');
  });

  it.each(['8H', '6H', '5H', 'EOD'])('refuses Weekly after %s without replacing the schedule', code => {
    choose(code); state().appendDigit('1'); state().confirmNumberPad(); choose('WEEKLY'); expect(state().additionalInstructions).toEqual([code]);
  });

  it('preserves STAT initial dose and locks reverse STAT and Weekly four-dose combinations', () => {
    state().startStat(); state().incrementDosage('stat'); state().incrementDosage('stat'); state().doneStat(); weekly('1/2'); choose('EMPTY STOMACH', 'TAKE');
    expect(weeklyPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toBe('පළමුව පමණක් 2 ගන්න ඉන්පසු, සතියකට වරක් ½ හිස් බඩ ගන්න');
    state().allClear(); weekly('1', true); state().startStat(); expect(state().stat).toBeNull(); choose('EVENING'); state().appendDigit('1'); state().confirmNumberPad(); state().confirmEvening(); digital(1, 1, 1); choose('EMPTY STOMACH', 'TAKE'); expect(weeklyPrintError(label())).toContain('Weekly with Evening');
  });

  it.each([undefined, 0, -1, NaN, Infinity])('rejects missing/invalid Weekly quantity %s and allows explicit correction', qty => {
    weekly(); choose('EMPTY STOMACH', 'TAKE'); state().restoreLabel({ ...label(), weeklyDosage: qty === undefined ? undefined : { qty, isFraction: false } }); expect(weeklyPrintError(label())).toContain('Weekly quantity');
    state().openNumberPad('weekly'); state().appendDigit('1/2'); state().confirmNumberPad(); expect(weeklyPrintError(label())).toBeNull();
  });

  it('rejects invalid draft ordering, missing confirmation, missing administration and missing required type', () => {
    weekly('1', true); digital(1, 0, 1); choose('TAKE', 'AFTER'); const valid = structuredClone(label());
    state().restoreLabel({ ...valid, weeklyDosage: { qty: 1, isFraction: false } }); expect(weeklyPrintError(label())).toContain('Done - Weekly');
    state().restoreLabel({ ...valid, additionalInstructions: ['DAILY', 'WEEKLY', 'TAKE', 'AFTER'], frequencyDosage: { qty: 1, isFraction: false }, dosage: { morning: { qty: 0, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 0, isFraction: false } } }); expect(weeklyPrintError(label())).toContain('before');
    state().restoreLabel({ ...valid, product: { id: 'x', name: 'X', product_type: null } }); expect(weeklyPrintError(label())).toContain('Product type');
    state().restoreLabel({ ...valid, additionalInstructions: ['WEEKLY'] }); expect(weeklyPrintError(label())).toBeTruthy();
  });

  it('preserves fraction stepping, Back, per-label drafts, reset and deselection without hidden quantity leakage', () => {
    weekly('1'); state().openNumberPad('weekly_fraction'); state().appendDigit('1/3'); state().confirmNumberPad(); state().incrementWeeklyDosage(); state().decrementWeeklyDosage(); expect(buildFinalInstruction(label()).instructionString).toBe('සතියකට වරක් 1 1/3');
    state().confirmWeekly(); state().openNumberPad('weekly'); state().appendDigit('9'); state().cancelNumberPad(); expect(state().weeklyDosage.confirmed).toBe(true);
    const draft = JSON.parse(JSON.stringify(label())); state().addLabel(); weekly('2'); state().selectLabel(0); expect(state().weeklyDosage.qty).toBeCloseTo(4 / 3); state().restoreLabel(draft); state().incrementWeeklyDosage(); expect(draft.weeklyDosage.qty).toBeCloseTo(4 / 3);
    choose('WEEKLY'); expect(state().weeklyDosage.qty).toBe(0); expect(buildFinalInstruction(label()).instructionString).not.toContain('සතියකට'); choose('DAILY'); expect(state().additionalInstructions).toContain('DAILY'); state().resetActiveLabel(); expect(state().weeklyDosage.qty).toBe(0);
  });

  it('shows selected quantity/preview immediately and guards review, callbacks and overflow', () => {
    weekly('1/2'); choose('EMPTY STOMACH', 'TAKE'); render(<><InstructionGrid /><ActionWorkspace /></>); expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('WEEKLY: ½'); expect(screen.getByTestId('label-text-preview')).toHaveTextContent('සතියකට වරක් ½ හිස් බඩ ගන්න');
  });

  it('revalidates latest review state and retains the print-fit guard', () => {
    weekly(); choose('EMPTY STOMACH', 'TAKE'); const save = vi.fn(); const print = vi.fn(); render(<LabelActionPage onSave={save} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
    expect(button('Print & Save')).toBeEnabled(); vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['medicine instructions'] }]); fireEvent.click(button('Print & Save')); expect(print).not.toHaveBeenCalled();
    act(() => state().restoreLabel({ ...label(), weeklyDosage: undefined })); expect(button('Print & Save')).toBeDisabled(); expect(screen.getByTestId('weekly-validation-blocked')).toHaveTextContent('Label 1'); fireEvent.click(button('Save without printing')); expect(save).not.toHaveBeenCalled();
  });

  it('leaves ENT administration and units under their existing policy', () => {
    state().setEnt(defaultEnt('ear')); state().incrementDosage('morning'); choose('TAKE', 'AFTER'); const before = buildFinalInstruction(label()).instructionString; expect(analyseLabel(label()).blocking).toBeNull(); expect(weeklyPrintError(label())).toBeNull(); expect(before).not.toContain('සතියකට');
  });
});
