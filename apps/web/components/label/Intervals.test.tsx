import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { DosagePanel } from './DosagePanel';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { createDefaultLabel, useLabelStore } from '../../store/labelStore';
import { analyseLabel, intervalPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { defaultEnt } from '../../lib/ent';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
function interval(code = '8H', qty = '1') { choose(code); state().appendDigit(qty); state().confirmNumberPad(); }
const button = (name: string) => screen.getByRole('button', { name: name.match(/^[568]H$/) ? new RegExp(`^${name}(?:\\s|$)`) : name });
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('interval completion (%s)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Pethi' }); state().setProductQuantity(10);
  });

  it.each(['8H', '6H', '5H'])('%s locks the other intervals and schedules in UI and direct actions', code => {
    interval(code, '1 1/2');
    render(<><InstructionGrid /><DosagePanel /></>);
    expect(button(code)).toHaveAttribute('data-selected', 'true'); expect(button(code)).toHaveAttribute('aria-pressed', 'true');
    for (const other of ['8H', '6H', '5H'].filter(i => i !== code)) {
      expect(button(other)).toBeDisabled(); expect(button(other)).toHaveClass('opacity-45');
      fireEvent.click(button(other)); act(() => choose(other));
    }
    for (const [name, key] of [['Daily', 'DAILY'], ['Weekly', 'WEEKLY'], ['Evening', 'EVENING'], ['STAT', 'STAT'], ['EOD', 'EOD']]) {
      expect(button(name)).toBeDisabled(); act(() => choose(key));
    }
    expect(button('Increase MORNING dosage')).toBeDisabled();
    act(() => { state().incrementDosage('morning'); state().openNumberPad('morning_fraction'); state().startStat(); state().openDaysOfWeekPanel(); state().toggleDayOfWeek('MONDAY'); state().setDaysOfWeek(['MONDAY']); });
    expect(state().dosage.morning.qty).toBe(0); expect(state().stat).toBeNull(); expect(state().selectedDaysOfWeek).toEqual([]);
    expect(state().additionalInstructions).toEqual([code]); expect(state().frequencyDosage.qty).toBe(1.5);
    act(() => choose(code)); expect(button('Increase MORNING dosage')).toBeEnabled();
    expect(button('6H')).toBeEnabled();
  });

  it.each(['8H', '6H', '5H'])('%s prints all catalogue types, fractions and exact wording consistently', code => {
    for (const [type, word] of [['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']]) {
      for (const [qty, formatted] of [['1', '1'], ['1/2', '½'], ['1 1/2', '1½'], ['1/3', '1/3']]) {
        state().allClear(); state().setProduct({ id: type, name: type, product_type: type });
        interval(code, qty); choose('TAKE', 'AFTER');
        const built = buildFinalInstruction(label());
        const suffix = mode === 'current' ? 'කෑමට පසු ගන්න' : 'ගන්න කෑමට පසු';
        const text = `${word} ${formatted} බැගින් පැය ${code[0]}කට වරක් ${suffix}`;
        expect(built.instructionString).toBe(text); expect(intervalPrintError(label())).toBeNull();
        const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(text);
        expect(built.finalInstructionText).toBe(text); view.unmount();
      }
    }
  });

  it.each(['TAKE', 'GIVE'])('%s works with all completed SAM combinations', action => {
    for (const method of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'],
      ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
      state().allClear(); state().setProduct({ id: 'k', name: 'K', product_type: 'Karal' }); interval('6H', '1/2'); choose(...method, action);
      if (!method.includes('WITH FOOD') && !method.includes('EMPTY STOMACH')) choose('BEFORE');
      const text = buildFinalInstruction(label()).instructionString;
      expect(intervalPrintError(label())).toBeNull(); expect(text).toMatch(/^කරල් ½ බැගින් පැය 6කට වරක් /);
      expect(text.match(/පැය 6කට වරක්/g)).toHaveLength(1);
      if (method.includes('WITH FOOD') || method.includes('EMPTY STOMACH')) expect(text).not.toContain('කෑමට පෙර');
    }
  });

  it.each(['8H', '6H', '5H'])('%s preserves STAT/EOD prefixes and independent quantities', code => {
    state().startStat(); state().incrementDosage('stat'); state().incrementDosage('stat'); state().doneStat(); choose('EOD');
    interval(code, '1/2'); choose('EMPTY STOMACH', 'GIVE');
    const built = buildFinalInstruction(label());
    expect(built.instructionString).toBe(`පළමුව පමණක් 2 ගන්න ඉන්පසු, දිනක් හැර දිනක්, පෙති ½ බැගින් පැය ${code[0]}කට වරක් හිස් බඩ දෙන්න`);
    expect(state().stat?.qty).toBe(2); expect(state().frequencyDosage.qty).toBe(0.5); expect(intervalPrintError(label())).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('rejects invalid interval quantity %s at readiness and review', qty => {
    state().restoreLabel({ ...label(), additionalInstructions: ['8H', 'TAKE', 'AFTER'], frequencyDosage: { qty, isFraction: false } });
    expect(analyseLabel(label()).blocking).toBeTruthy(); expect(intervalPrintError(label())).toBeTruthy();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={vi.fn()} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled();
    expect(screen.getByTestId('interval-validation-blocked')).toHaveTextContent('Label 1');
  });

  it.each(['DAILY', 'EVENING', 'WEEKLY', 'DIGITAL', 'DAYS'])('refuses interval over %s without losing the previous schedule', previous => {
    if (previous === 'DIGITAL') state().incrementDosage('morning');
    else if (previous === 'DAYS') state().setDaysOfWeek(['MONDAY']); else choose(previous);
    state().cancelNumberPad(); const before = structuredClone(label()); choose('8H');
    expect(label()).toEqual(before);
  });

  it.each(['DIGITAL', 'WEEKLY', 'DAILY', 'EVENING', 'DAYS', 'MULTIPLE'])('rejects restored %s conflicts and permits correction', conflict => {
    interval(); choose('TAKE', 'AFTER');
    const draft = structuredClone(label());
    if (conflict === 'DIGITAL') draft.dosage.morning.qty = 1;
    else if (conflict === 'DAYS') draft.selectedDaysOfWeek = ['MONDAY'];
    else draft.additionalInstructions.push(conflict === 'MULTIPLE' ? '6H' : conflict);
    state().restoreLabel(draft); expect(intervalPrintError(label())).toBeTruthy();
    choose('8H'); expect(state().additionalInstructions).not.toContain('8H');
    expect(draft.additionalInstructions).toContain('8H');
  });

  it.each([undefined, null, 'Unsupported'])('blocks missing/unsupported product type %s', product_type => {
    state().setProduct({ id: 'missing', name: 'Missing', product_type }); interval(); choose('TAKE', 'AFTER');
    expect(intervalPrintError(label())).toMatch(/product type/i); expect(buildFinalInstruction(label()).instructionString).not.toContain('පෙති');
  });

  it('requires complete USB and rejects invalid restored SAM order', () => {
    interval(); expect(intervalPrintError(label())).toBeTruthy(); choose('TAKE'); expect(intervalPrintError(label())).toBeTruthy();
    choose('AFTER'); expect(intervalPrintError(label())).toBeNull();
    state().restoreLabel({ ...label(), additionalInstructions: ['8H', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'] });
    expect(intervalPrintError(label())).toBeTruthy();
  });

  it('retains confirmed quantity on refused switching and Back, then supports removal, re-entry and reset', () => {
    interval('6H', '1 1/2'); choose('8H'); expect(state().frequencyDosage.qty).toBe(1.5); expect(state().additionalInstructions).toEqual(['6H']);
    state().openNumberPad('frequency'); state().appendDigit('3'); state().cancelNumberPad(); expect(state().frequencyDosage.qty).toBe(1.5);
    state().incrementFrequencyDosage(); expect(state().frequencyDosage.qty).toBe(2.5); state().decrementFrequencyDosage(); expect(state().frequencyDosage.qty).toBe(1.5);
    state().openNumberPad('frequency_fraction'); state().setQuickFraction('1/4'); state().confirmNumberPad(); expect(state().frequencyDosage.qty).toBe(1.25);
    choose('6H'); expect(state().frequencyDosage.qty).toBe(0); interval('8H', '2'); expect(state().frequencyDosage.qty).toBe(2);
    state().allClear(); expect(state().additionalInstructions).toEqual([]); expect(state().frequencyDosage.qty).toBe(0);
  });

  it('updates the selected panel and preserves independent label/draft state', () => {
    interval('8H', '1/2'); choose('WITH FOOD', 'TAKE'); const first = structuredClone(label());
    render(<InstructionGrid />); expect(screen.getByTestId('label-text-preview')).toHaveTextContent('පෙති ½ බැගින් පැය 8කට වරක් කෑමත් සමඟ ගන්න');
    act(() => { state().addLabel(); state().setProduct({ id: 'p', name: 'P', product_type: 'Packet' }); interval('5H', '1 1/2'); choose('EMPTY STOMACH', 'TAKE'); });
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('පැකට් 1½ බැගින් පැය 5කට වරක් හිස් බඩ ගන්න');
    act(() => state().selectLabel(0)); expect(state().frequencyDosage.qty).toBe(0.5);
    act(() => state().restoreLabel(JSON.parse(JSON.stringify(first)))); expect(buildFinalInstruction(label()).instructionString).toContain('පෙති ½');
  });

  it('preserves ENT interval instructions and bypasses oral product-type requirements', () => {
    state().restoreLabel({ ...createDefaultLabel(), product: { id: 'eye', name: 'Eye drops' } }); state().setEnt(defaultEnt('eye')); interval('6H');
    expect(intervalPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toContain('Instill 1 drop');
    expect(buildFinalInstruction(label()).instructionString).not.toContain('පෙති');
  });
});
