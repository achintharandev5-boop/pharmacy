import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { DosagePanel } from './DosagePanel';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, dailyPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { defaultEnt } from '../../lib/ent';
import { labelFitReport } from '../../lib/labelFit';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
function daily(qty = '1') { choose('DAILY'); state().appendDigit(qty); state().confirmNumberPad(); }
const button = (name: string | RegExp) => screen.getByRole('button', { name });
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Daily dosing (%s)', mode => {
  beforeEach(() => { state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]); state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10); });

  it('selects Daily without assuming dose/action, exposes Done/Back and updates preview immediately', () => {
    render(<><InstructionGrid /><ActionWorkspace /></>); fireEvent.click(button('Daily')); expect(state().frequencyDosage.qty).toBe(0); expect(button('Done - Daily')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Increase MORNING dosage' })).toBeNull(); // the pad is open on the right in place of the dosage rows
    fireEvent.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); fireEvent.click(screen.getByRole('button', { name: /Done \(Next\)/ })); expect(button('Increase MORNING dosage')).toBeDisabled();
    expect(button(/^Daily 1 each/)).toHaveAttribute('data-selected', 'true'); expect(button('Done - Daily')).toBeEnabled(); expect(buildFinalInstruction(label()).instructionString).toBe('දිනකට 1'); expect(dailyPrintError(label())).toBeTruthy();
    fireEvent.click(button('Empty Stomach')); fireEvent.click(button('Take medication')); fireEvent.click(button('Done - Daily'));
    expect(state().activeControl).toBe('idle'); expect(screen.getByTestId('label-text-preview')).toHaveTextContent('දිනකට 1 හිස් බඩ ගන්න');
  });

  it.each([['1', '1'], ['1/2', '½'], ['1 1/2', '1½'], ['1/3', '1/3']])('prints exact Daily quantity %s once in shared preview/save/print text', (entered, formatted) => {
    daily(entered); choose('TAKE', 'AFTER'); const suffix = mode === 'current' ? 'කෑමට පසු ගන්න' : 'ගන්න කෑමට පසු'; const text = `දිනකට ${formatted} ${suffix}`;
    const built = buildFinalInstruction(label()); expect(built.instructionString).toBe(text); expect(built.finalInstructionText).toBe(text); expect(dailyPrintError(label())).toBeNull();
    const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(text); expect(built.instructionString).not.toMatch(/DAILY|දිනපතා|කරල්|වරක්/);
    expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]'); expect(view.container.querySelector('[data-label-body]')).toHaveClass('flex-1'); // the instruction area takes all height the optional rows leave free
  });

  it.each(['TAKE', 'GIVE'])('retains %s with BEFORE/AFTER and all completed SAM combinations', action => {
    for (const method of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
      for (const timing of ['BEFORE', 'AFTER']) {
        state().allClear(); daily('1/2'); choose(...method, action); if (!method.includes('WITH FOOD') && !method.includes('EMPTY STOMACH')) choose(timing);
        const text = buildFinalInstruction(label()).instructionString; expect(text).toMatch(/^දිනකට ½ /); expect(dailyPrintError(label())).toBeNull(); expect(text.match(/දිනකට/g)).toHaveLength(1);
        if (method.includes('WITH FOOD') || method.includes('EMPTY STOMACH')) expect(text).not.toMatch(/කෑමට පෙර|කෑමට පසු/);
      }
    }
  });

  it.each(['8H', '6H', '5H', 'EVENING'])('locks %s and refuses both selection directions without replacing quantities', code => {
    daily('1 1/2'); render(<><InstructionGrid /><ActionWorkspace /></>); const target = button(code === 'EVENING' ? 'Evening' : code); expect(target).toBeDisabled(); expect(target).toHaveClass('opacity-45'); fireEvent.click(target); act(() => choose(code)); expect(state().additionalInstructions).toEqual(['DAILY']); expect(state().frequencyDosage.qty).toBe(1.5);
    act(() => { choose('DAILY'); choose(code); state().appendDigit('2'); state().confirmNumberPad(); choose('DAILY'); }); expect(state().additionalInstructions).toEqual([code]); expect(state().frequencyDosage.qty).toBe(2);
  });

  it('locks all Digital dose entry paths until Daily is removed', () => {
    daily(); render(<DosagePanel />); expect(button('Increase MORNING dosage')).toBeDisabled();
    act(() => { state().incrementDosage('morning'); state().openNumberPad('night_fraction'); }); expect(state().dosage.morning.qty).toBe(0); expect(state().numberPad.visible).toBe(false);
    act(() => choose('DAILY')); expect(button('Increase MORNING dosage')).toBeEnabled(); expect(state().frequencyDosage.qty).toBe(0);
  });

  it.each(['BD', 'TDS', 'FOUR'])('refuses Daily over a completed %s schedule without deleting its doses', pattern => {
    if (pattern === 'FOUR') { choose('EVENING'); state().appendDigit('1'); state().confirmNumberPad(); state().confirmEvening(); }
    for (const time of pattern === 'BD' ? ['morning', 'night'] as const : ['morning', 'lunch', 'night'] as const) state().incrementDosage(time);
    choose('EMPTY STOMACH', 'TAKE'); const before = structuredClone(label()); choose('DAILY'); expect(label()).toEqual(before);
  });

  it.each([0, -1, NaN, Infinity])('blocks invalid Daily quantity %s at readiness/review and permits correction', qty => {
    daily(); choose('EMPTY STOMACH', 'TAKE'); state().restoreLabel({ ...label(), frequencyDosage: { qty, isFraction: false } }); expect(analyseLabel(label()).blocking).toBeTruthy();
    render(<LabelActionPage onSave={vi.fn()} onPrintAndSave={vi.fn()} onBack={vi.fn()} onDelete={vi.fn()} />); expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled(); expect(screen.getByTestId('daily-validation-blocked')).toHaveTextContent('Label 1');
    act(() => state().restoreLabel({ ...label(), frequencyDosage: { qty: 1, isFraction: false } })); expect(button('Save without printing')).toBeEnabled();
  });

  it.each(['INTERVAL', 'DIGITAL', 'EVENING', 'DUPLICATE', 'SAM'])('rejects restored %s conflicts without destructively changing the saved draft', problem => {
    daily(); choose('EMPTY STOMACH', 'TAKE'); const saved = structuredClone(label());
    if (problem === 'DIGITAL') saved.dosage.morning.qty = 1;
    else if (problem === 'SAM') saved.additionalInstructions = ['DAILY', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
    else saved.additionalInstructions.push(problem === 'INTERVAL' ? '8H' : problem === 'DUPLICATE' ? 'DAILY' : 'EVENING');
    state().restoreLabel(saved); expect(dailyPrintError(label())).toBeTruthy(); choose('DAILY'); expect(saved.additionalInstructions).toContain('DAILY'); expect(state().additionalInstructions).not.toContain('DAILY'); expect(state().frequencyDosage.qty).toBe(problem === 'INTERVAL' || problem === 'EVENING' ? 1 : 0);
  });

  it.each(['STAT', 'EOD'])('retains %s-first with an independent Daily quantity and refuses reverse order', modifier => {
    if (modifier === 'STAT') { state().startStat(); state().incrementDosage('stat'); state().incrementDosage('stat'); state().doneStat(); } else choose('EOD');
    daily('1/2'); choose('EMPTY STOMACH', 'GIVE'); const text = buildFinalInstruction(label()).instructionString;
    expect(text).toBe(`${modifier === 'STAT' ? 'පළමුව පමණක් 2 ගන්න ඉන්පසු,' : 'දිනක් හැර දිනක්,'} දිනකට ½ හිස් බඩ දෙන්න`); expect(dailyPrintError(label())).toBeNull(); if (modifier === 'STAT') expect(state().stat?.qty).toBe(2);
    state().allClear(); daily(); choose(modifier); expect(state().additionalInstructions).toEqual(['DAILY']); expect(state().stat).toBeNull();
  });

  it.each([true, false])('requires the complete Weekly-first workflow, Weekly-first=%s', first => {
    if (first) { choose('WEEKLY'); state().appendDigit('2'); state().confirmNumberPad(); state().confirmWeekly(); } daily('1 1/2'); if (!first) { choose('WEEKLY'); expect(state().additionalInstructions).not.toContain('WEEKLY'); return; } choose('WITH FOOD', 'TAKE');
    expect(buildFinalInstruction(label()).finalInstructionText).toBe('සතියකට වරක් දිනකට 1½ කෑමත් සමඟ ගන්න'); expect(dailyPrintError(label())).toBeNull(); expect(state().frequencyDosage.qty).toBe(1.5);
  });

  it.each([null, 'Unsupported'])('keeps Daily type-free with catalogue type %s and preserves warnings', type => {
    state().setProduct({ id: 'x', name: 'X', product_type: type }); daily(); choose('EMPTY STOMACH', 'TAKE'); expect(dailyPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toBe('දිනකට 1 හිස් බඩ ගන්න');
  });

  it('preserves Back, whole/fraction corrections, independent labels, restoration and reset', () => {
    daily('1 1/2'); choose('EMPTY STOMACH', 'TAKE'); state().openNumberPad('frequency'); state().appendDigit('3'); state().cancelNumberPad(); expect(state().frequencyDosage.qty).toBe(1.5);
    state().incrementFrequencyDosage(); expect(state().frequencyDosage.qty).toBe(2.5); state().decrementFrequencyDosage(); state().openNumberPad('frequency_fraction'); state().setQuickFraction('1/4'); state().confirmNumberPad(); expect(state().frequencyDosage.qty).toBe(1.25);
    const saved = JSON.parse(JSON.stringify(label())); state().addLabel(); daily('2'); state().selectLabel(0); state().restoreLabel(saved); expect(state().frequencyDosage.qty).toBe(1.25); expect(buildFinalInstruction(label()).instructionString).toContain('දිනකට 1¼');
    state().clearLabelInstructions(); expect(state().frequencyDosage.qty).toBe(0); state().allClear(); expect(state().additionalInstructions).toEqual([]);
  });

  it('retains text-only EOD when no Daily schedule is selected', () => {
    choose('EOD'); expect(buildFinalInstruction(label()).instructionString).toBe('දිනක් හැර දිනක්'); expect(state().frequencyDosage.qty).toBe(0);
  });

  it('retains print-fit rejection and ENT Daily templates', () => {
    daily(); choose('EMPTY STOMACH', 'TAKE'); const print = vi.fn(); render(<LabelActionPage onSave={vi.fn()} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
    vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['medicine instructions'] }]); fireEvent.click(button('Print & Save')); expect(print).not.toHaveBeenCalled(); expect(screen.getByTestId('print-blocked')).toBeInTheDocument();
    state().allClear(); state().setEnt(defaultEnt('eye')); daily(); expect(dailyPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toContain('Instill 1 drop');
  });
});
