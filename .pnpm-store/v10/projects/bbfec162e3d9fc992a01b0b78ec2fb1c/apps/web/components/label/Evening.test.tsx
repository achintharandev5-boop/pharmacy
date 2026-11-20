import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, eveningPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { labelFitReport } from '../../lib/labelFit';
import { defaultEnt } from '../../lib/ent';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
function evening(qty = '1', done = false) { choose('EVENING'); state().appendDigit(qty); state().confirmNumberPad(); if (done) state().confirmEvening(); }
function digital(morning = 1, lunch = 1, night = 1) { state().restoreLabel({ ...label(), dosage: { morning: { qty: morning, isFraction: !Number.isInteger(morning) }, lunch: { qty: lunch, isFraction: !Number.isInteger(lunch) }, night: { qty: night, isFraction: !Number.isInteger(night) } } }); }
const button = (name: string | RegExp) => screen.getByRole('button', { name });
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Evening and four doses (%s)', mode => {
  beforeEach(() => { state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]); state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10); });

  it.each(['TAKE', 'GIVE'])('Evening alone uses exact time wording with %s and no type or duplicate quantity', action => {
    evening('1 1/2'); choose('EMPTY STOMACH', action); const text = `1½ හවසට හිස් බඩ ${action === 'TAKE' ? 'ගන්න' : 'දෙන්න'}`;
    const built = buildFinalInstruction(label()); expect(built.instructionString).toBe(text); expect(built.finalInstructionText).toBe(text); expect(eveningPrintError(label())).toBeNull();
    const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(text); expect(built.instructionString).not.toMatch(/කරල්|EVENING|හතර/);
    expect(state().frequencyDosage.confirmed).not.toBe(true);
  });

  it('locks Digital until Done, permits standalone administration and preserves Back semantics', () => {
    render(<><InstructionGrid /><ActionWorkspace /></>); fireEvent.click(button('Evening')); expect(screen.queryByRole('button', { name: 'Increase MORNING dosage' })).toBeNull(); // the pad is open on the right in place of the dosage rows
    fireEvent.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); fireEvent.click(screen.getByRole('button', { name: /Done \(Next\)/ })); expect(button(/^Evening/)).toHaveAttribute('data-selected', 'true');
    expect(button('Take medication')).toBeEnabled(); expect(button('Increase MORNING dosage')).toBeDisabled();
    act(() => { state().incrementDosage('morning'); state().openNumberPad('night'); }); expect(state().dosage.morning.qty).toBe(0); expect(state().numberPad.visible).toBe(false);
    fireEvent.click(button('Done — enable Digital Label')); expect(button('Increase MORNING dosage')).toBeEnabled(); expect(state().frequencyDosage.confirmed).toBe(true);
    fireEvent.click(button('Increase MORNING dosage')); expect(state().dosage.morning.qty).toBe(1);
    act(() => { state().openNumberPad('frequency'); state().appendDigit('3'); }); fireEvent.click(button('Back from Evening')); expect(state().frequencyDosage.qty).toBe(1); expect(state().frequencyDosage.confirmed).toBe(true);
    act(() => { state().openNumberPad('frequency'); state().appendDigit('2'); state().confirmNumberPad(); }); expect(state().frequencyDosage.confirmed).not.toBe(true); expect(button('Increase MORNING dosage')).toBeDisabled();
    fireEvent.click(button('Done — enable Digital Label')); expect(state().frequencyDosage.qty).toBe(2); expect(state().dosage.morning.qty).toBe(1);
  });

  it.each(['8H', '6H', '5H', 'DAILY'])('Evening refuses %s in both directions without replacing a dose', code => {
    evening(); render(<><InstructionGrid /><ActionWorkspace /></>); expect(button(code === 'DAILY' ? 'Daily' : code)).toBeDisabled(); act(() => choose(code)); expect(state().additionalInstructions).toEqual(['EVENING']); expect(state().frequencyDosage.qty).toBe(1);
    act(() => { choose('EVENING'); choose(code); state().appendDigit('2'); state().confirmNumberPad(); choose('EVENING'); }); expect(state().additionalInstructions).toEqual([code]); expect(state().frequencyDosage.qty).toBe(2);
  });

  it.each(['BD', 'TDS'])('refuses Evening added after %s and retains its independent quantities', pattern => {
    digital(1, pattern === 'BD' ? 0 : 1, 1); render(<><InstructionGrid /><ActionWorkspace /></>); expect(button('Evening')).toBeDisabled(); act(() => choose('EVENING')); expect(state().additionalInstructions).not.toContain('EVENING'); expect(state().dosage.night.qty).toBe(1);
  });

  it.each([['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']])('consolidates four equal doses for %s only', (type, word) => {
    for (const [qty, entered, formatted] of [[1, '1', '1'], [0.5, '1/2', '½'], [1.5, '1 1/2', '1½'], [1 / 3, '1/3', '1/3']] as const) {
      state().allClear(); state().setProduct({ id: type, name: type, product_type: type }); evening(entered, true); digital(qty, qty, qty); choose('EMPTY STOMACH', 'TAKE');
      const built = buildFinalInstruction(label()); const text = `${word} ${formatted} බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න`;
      expect(built.instructionString).toBe(text); expect(built.finalInstructionText).toBe(text); expect(eveningPrintError(label())).toBeNull();
      const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(text); expect(view.container.querySelector('[data-dose-badge]')).toBeNull(); view.unmount();
    }
  });

  it.each([[1, 2, 3], [0.5, 1.5, 2], [1, 0, 1], [0, 0, 2]])('keeps unequal/partial digital slots %j/%j/%j in circled chronological rows', (m, l, n) => {
    evening('1 1/2', true); digital(m, l, n); choose('EMPTY STOMACH', 'GIVE'); const built = buildFinalInstruction(label());
    const view = render(<LabelCard labelItem={built} />); const rows = built.digitalRows!;
    expect(rows.map(row => row.time)).toEqual([...(m ? ['morning'] : []), ...(l ? ['lunch'] : []), 'evening', ...(n ? ['night'] : [])]);
    expect(Array.from(view.container.querySelectorAll('[data-dose-badge]')).map(el => el.textContent)).toEqual(rows.map(row => row.formatted));
    expect(view.container.querySelector('[data-digital-administration]')).toHaveTextContent('හිස් බඩ දෙන්න'); expect(built.instructionString).not.toMatch(/හතර|කරල්|EVENING/); expect(eveningPrintError(label())).toBeNull();
    expect(built.finalInstructionText).toContain('හවසට 1½'); expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
  });

  it('does not consolidate a partial equal schedule into four times or invent missing doses', () => {
    evening('1', true); digital(1, 0, 1); choose('WITH FOOD', 'TAKE'); const built = buildFinalInstruction(label());
    expect(built.digitalRows).toHaveLength(3); expect(built.consolidatedDosage).toBe(false); expect(built.instructionString).not.toContain('හතර'); expect(state().dosage.lunch.qty).toBe(0);
  });

  it.each([0, -1, NaN, Infinity])('blocks invalid Evening quantity %s at DONE/review and permits correction', qty => {
    evening(); choose('EMPTY STOMACH', 'TAKE'); state().restoreLabel({ ...label(), frequencyDosage: { qty, isFraction: false } }); expect(analyseLabel(label()).blocking).toBeTruthy();
    render(<LabelActionPage onSave={vi.fn()} onPrintAndSave={vi.fn()} onBack={vi.fn()} onDelete={vi.fn()} />); expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled(); expect(screen.getByTestId('evening-validation-blocked')).toHaveTextContent('Label 1');
    act(() => state().restoreLabel({ ...label(), frequencyDosage: { qty: 1, isFraction: false } })); expect(button('Save without printing')).toBeEnabled();
  });

  it.each([null, 'Unsupported'])('requires product type %s only when a true four-dose format needs it', type => {
    state().setProduct({ id: 'x', name: 'X', product_type: type }); evening('1', true); choose('EMPTY STOMACH', 'TAKE'); expect(eveningPrintError(label())).toBeNull();
    digital(); expect(eveningPrintError(label())).toMatch(/product type/i); digital(1, 0, 2); expect(eveningPrintError(label())).toBeNull();
  });

  it.each(['TAKE', 'GIVE'])('preserves %s and all completed SAM combinations', action => {
    for (const method of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
      state().allClear(); state().setProduct({ id: 'k', name: 'K', product_type: 'Karal' }); evening('1/2', true); digital(0.5, 0.5, 0.5); choose(...method, action); if (!method.includes('WITH FOOD') && !method.includes('EMPTY STOMACH')) choose('BEFORE');
      expect(eveningPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toMatch(/^කරල් ½ බැගින් දිනකට හතර වරක් /);
    }
  });

  it.each(['STAT', 'EOD'])('retains ordered %s prefix with Evening and four doses', modifier => {
    if (modifier === 'STAT') { state().startStat(); state().incrementDosage('stat'); state().incrementDosage('stat'); state().doneStat(); } else choose('EOD');
    evening('1', true); digital(); choose('EMPTY STOMACH', 'TAKE'); const text = buildFinalInstruction(label()).instructionString;
    expect(text).toMatch(modifier === 'STAT' ? /^පළමුව පමණක් 2 ගන්න ඉන්පසු,/ : /^දිනක් හැර දිනක්,/); expect(eveningPrintError(label())).toBeNull();
  });

  it('rejects unconfirmed and conflicting restored drafts while retaining correction and independent labels', () => {
    evening('1', true); digital(1, 2, 3); choose('EMPTY STOMACH', 'TAKE'); const saved = structuredClone(label());
    state().restoreLabel({ ...saved, frequencyDosage: { qty: 1, isFraction: false } }); expect(eveningPrintError(label())).toContain('Done'); state().confirmEvening(); expect(eveningPrintError(label())).toBeNull();
    state().addLabel(); evening('2'); state().selectLabel(0); expect(state().frequencyDosage.qty).toBe(1); expect(state().frequencyDosage.confirmed).toBe(true);
    state().restoreLabel(JSON.parse(JSON.stringify(saved))); expect(buildFinalInstruction(label()).digitalRows?.map(row => row.qty)).toEqual([1, 2, 1, 3]);
    state().restoreLabel({ ...saved, additionalInstructions: [...saved.additionalInstructions, 'DAILY'] }); expect(eveningPrintError(label())).toBeTruthy(); choose('DAILY'); expect(eveningPrintError(label())).toBeNull();
    state().allClear(); expect(state().frequencyDosage.qty).toBe(0); expect(state().frequencyDosage.confirmed).not.toBe(true);
  });

  it('switches by removing Evening without losing valid Digital quantities, and enforces print-fit for four rows', () => {
    evening('1', true); digital(1, 2, 3); choose('EMPTY STOMACH', 'TAKE'); const print = vi.fn(); render(<LabelActionPage onSave={vi.fn()} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
    vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['medicine instructions'] }]); fireEvent.click(button('Print & Save')); expect(print).not.toHaveBeenCalled(); expect(screen.getByTestId('print-blocked')).toBeInTheDocument();
    act(() => choose('EVENING')); expect(state().dosage.lunch.qty).toBe(2); expect(state().frequencyDosage.qty).toBe(0);
  });

  it('preserves ENT Evening output and units without oral gating', () => {
    state().setEnt(defaultEnt('eye')); evening(); expect(eveningPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toContain('Instill 1 drop');
  });

  it('preserves Weekly as an Evening-only modifier but rejects an unspecified Weekly four-dose frequency', () => {
    choose('WEEKLY'); state().appendDigit('1'); state().confirmNumberPad(); state().confirmWeekly(); evening(); choose('WITH FOOD', 'TAKE'); expect(eveningPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toBe('සතියකට වරක් 1 හවසට කෑමත් සමඟ ගන්න');
    state().confirmEvening(); digital(); expect(eveningPrintError(label())).toContain('Weekly with Evening');
  });

  it('invalidates Digital confirmation on whole/fraction edits without changing any Digital dose', () => {
    evening('1', true); digital(); choose('EMPTY STOMACH', 'TAKE'); state().incrementFrequencyDosage(); expect(eveningPrintError(label())).toContain('Done'); expect(state().dosage.morning.qty).toBe(1);
    state().decrementFrequencyDosage(); state().confirmEvening(); expect(eveningPrintError(label())).toBeNull();
    state().openNumberPad('frequency_fraction'); state().setQuickFraction('1/2'); state().confirmNumberPad(); expect(state().frequencyDosage.qty).toBe(1.5); expect(eveningPrintError(label())).toContain('Done');
  });

  it('clears Evening quantity/confirmation with selected-instruction reset without clearing the Digital rows', () => {
    evening('1', true); digital(1, 2, 3); state().clearLabelInstructions(); expect(state().frequencyDosage.qty).toBe(0); expect(state().frequencyDosage.confirmed).not.toBe(true); expect(state().dosage.night.qty).toBe(3);
  });
});
