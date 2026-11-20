import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultLabel, useLabelStore, type LabelData } from '../store/labelStore';
import { buildFinalInstruction } from '../lib/labelBuilder';
import { analyseLabel, setWordingModeForTests } from '../lib/instructionEngine';
import { productTypePrinting } from '../lib/productTypePrinting';
import { defaultEnt, ENT_PREFIX } from '../lib/ent';
import { LabelCard } from './PrintableLabel';
import { LabelActionPage } from './label/LabelActionPage';
import { SelectedInstructionsPanel } from './label/SelectedInstructionsPanel';

vi.mock('../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../lib/labelFit', () => ({ labelFitReport: () => [] }));

const state = () => useLabelStore.getState();
const types = [['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']] as const;
const dose = (qty: number) => ({ qty, isFraction: !Number.isInteger(qty) });
function label(type: string | null = 'Pethi', codes = ['8H']): LabelData {
  return { ...createDefaultLabel(), product: { id: 'medicine', name: 'Medicine', product_type: type },
    productQuantity: 10, frequencyDosage: dose(1), additionalInstructions: [...codes, 'TAKE', 'AFTER'] };
}
function daily(pattern: 'BD' | 'TDS' | 'FOUR', type = 'Pethi', qty = 1): LabelData {
  const value = label(type, pattern === 'FOUR' ? ['EVENING'] : []);
  value.dosage = { morning: dose(qty), lunch: dose(pattern === 'BD' ? 0 : qty), night: dose(qty) };
  value.frequencyDosage = { ...dose(pattern === 'FOUR' ? qty : 0), confirmed: pattern === 'FOUR' };
  return value;
}
function printed(value: LabelData) {
  const built = buildFinalInstruction(value);
  const result = render(<LabelCard labelItem={built} />);
  return { built, body: result.container.querySelector('[data-label-body]')?.textContent ?? '', container: result.container };
}
beforeEach(() => { state().allClear(); setWordingModeForTests(null); });
afterEach(() => setWordingModeForTests(null));

describe('product-type-dependent printing', () => {
  it.each(types.flatMap(([type, word]) => ['8H', '6H', '5H'].map(code => [type, word, code])))('%s + %s + %s uses one shared preview/print line', (type, word, code) => {
    const { built, body, container } = printed(label(type, [code]));
    const expected = `${word} 1 බැගින් පැය ${code[0]}කට වරක් කෑමට පසු ගන්න`;
    expect(built.instructionString).toContain(expected);
    expect(body).toContain(expected);
    expect(body.split(word).length - 1).toBe(1);
    expect(container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
  });

  it.each(types.flatMap(([type, word]) => ['BD', 'TDS', 'FOUR'].map(pattern => [type, word, pattern])))('%s prints the consolidated %s / %s pattern', (type, word, pattern) => {
    const value = daily(pattern as 'BD' | 'TDS' | 'FOUR', type);
    const { built, body } = printed(value);
    const frequency = pattern === 'BD' ? '2' : pattern === 'TDS' ? '3' : 'හතර';
    expect(body).toContain(`${word} 1 බැගින් දිනකට ${frequency} වරක් කෑමට පසු ගන්න`);
    expect(body.split(word).length - 1).toBe(1);
    expect(built.consolidatedDosage).toBe(true);
    expect(body).not.toContain('උදේ');
  });

  it.each(['BD', 'TDS'] as const)('Weekly + %s retains the PDF-mandated type and weekly phrase', pattern => {
    const value = daily(pattern, 'Karal');
    value.additionalInstructions.unshift('WEEKLY');
    const { body } = printed(value);
    expect(body).toContain('කරල් 1 සතියකට වරක් කෑමට පසු ගන්න');
    expect(body).not.toContain('දිනකට');
  });

  it('STAT + interval puts the product type only on the interval line', () => {
    setWordingModeForTests('spec');
    const value = label('Packet');
    value.stat = { qty: 2, isFraction: false, administration: ['TAKE'], followUp: '8H' };
    const { body } = printed(value);
    expect(body).toContain('පළමුව පමණක් 2 ගන්න ඉන්පසු,');
    expect(body).toContain('පැකට් 1 බැගින් පැය 8කට වරක්');
    expect(body.indexOf('පළමුව')).toBeLessThan(body.indexOf('පැකට්'));
    expect(body.split('පැකට්').length - 1).toBe(1);
  });

  it('EOD + interval retains EOD in the required EOD-first order', () => {
    for (const codes of [['EOD', '6H']]) {
      const { body, built } = printed(label('Karal', codes));
      expect(body).toContain('දිනක් හැර දිනක්, කරල් 1 බැගින් පැය 6කට වරක්');
      expect(built.frequencyDosage?.freqLabel).toBe('6H');
    }
    state().toggleAdditionalInstruction('EOD');
    state().cancelNumberPad();
    state().toggleAdditionalInstruction('6H');
    expect(state().additionalInstructions).toEqual(['EOD', '6H']);
    state().toggleAdditionalInstruction('EOD');
    state().toggleAdditionalInstruction('EOD');
    expect(state().additionalInstructions).toContain('6H');
  });

  it.each(['STAT', 'EOD', 'DAILY', 'WEEKLY', 'EVENING', 'TAKE', 'CHEWABLE'])('%s alone never gains a product-type word', code => {
    const value = label('Karal', [code]);
    if (code === 'STAT') value.stat = { qty: 2, isFraction: false, followUp: null };
    const { body } = printed(value);
    for (const [, word] of types) expect(body).not.toContain(word);
    expect(productTypePrinting(value).error).toBeNull();
  });

  it.each(['morning', 'lunch', 'night'] as const)('%s only stays a dose row without product type', time => {
    const value = label('Pethi', []);
    value.frequencyDosage = dose(0);
    value.dosage[time] = dose(1.5);
    const { body } = printed(value);
    expect(body).toContain('1½');
    expect(body).not.toContain('පෙති');
  });

  it('unequal digital/evening doses remain separate without a false common quantity', () => {
    const value = daily('FOUR', 'Pethi');
    value.frequencyDosage = dose(2.5);
    const { body, built } = printed(value);
    expect(built.consolidatedDosage).toBe(false);
    expect(body).toContain('උදේට1');
    expect(body).toContain('2½');
    expect(body).not.toContain('පෙති');
    expect(body).not.toContain('හතර');
  });

  it.each([0.5, 1.5, 4 / 3])('fractional quantity %s survives every permitted pattern', qty => {
    for (const pattern of ['8H', 'BD', 'TDS', 'FOUR'] as const) {
      const value = pattern === '8H' ? label('Packet') : daily(pattern, 'Packet', qty);
      if (pattern === '8H') value.frequencyDosage = dose(qty);
      const expected = qty === 0.5 ? '½' : qty === 1.5 ? '1½' : '1 1/3';
      const { body, built } = printed(value);
      expect(body).toContain(`පැකට් ${expected} `);
      expect(built.instructionString).toContain(`පැකට් ${expected} `);
    }
  });

  it.each(['BD', 'TDS', 'FOUR'] as const)('%s also requires a supported type', pattern => {
    const value = daily(pattern, 'Unknown');
    expect(analyseLabel(value).blocking).toMatch(/Unsupported product type/);
    expect(buildFinalInstruction(value).productTypePrintingError).toMatch(/Unsupported product type/);
  });

  it('does not block a type-free workflow for a missing product type', () => {
    for (const code of ['EOD', 'DAILY', 'WEEKLY', 'EVENING']) {
      const value = label(null, [code]);
      if (code === 'EOD') value.frequencyDosage = dose(0);
      if (code === 'WEEKLY') value.weeklyDosage = dose(1);
      expect(analyseLabel(value).blocking).toBeNull();
    }
  });

  it('preserves ENT instructions without oral product-type injection or validation', () => {
    const value = label(null, ['8H', ENT_PREFIX + JSON.stringify(defaultEnt('eye'))]);
    const { body } = printed(value);
    expect(body).toContain('Instill 1 drop');
    expect(analyseLabel(value).blocking).toBeNull();
    for (const [, word] of types) expect(body).not.toContain(word);
  });

  it('keeps the approved spec administration wording exactly', () => {
    setWordingModeForTests('spec');
    const value = label('Karal', ['6H', 'CHEWABLE']);
    expect(printed(value).body).toContain('කරල් 1 බැගින් පැය 6කට වරක් හපලා කන්න කෑමට පසු');
  });

  it.each([null, '', 'Tablet', 'Unknown'])('blocks missing/unsupported type %s without a fallback', type => {
    const value = label(type);
    expect(analyseLabel(value).blocking).toMatch(/product type/i);
    const { body, built } = printed(value);
    expect(built.productTypePrintingError).toMatch(/product type/i);
    expect(body).not.toContain('පෙති');
    state().restoreLabel(value);
    const onPrintAndSave = vi.fn();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={onPrintAndSave} />);
    expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Print & Save/ }));
    expect(onPrintAndSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('product-type-print-blocked')).toHaveTextContent(/product type/i);
  });

  it('correcting the type unlocks printing, and later invalidation blocks it again', () => {
    state().restoreLabel(label(null));
    const onPrintAndSave = vi.fn();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={onPrintAndSave} />);
    act(() => state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Packet' }));
    fireEvent.click(screen.getByRole('button', { name: /Print & Save/ }));
    expect(onPrintAndSave).toHaveBeenCalledTimes(1);
    act(() => state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Bad' }));
    expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled();
  });

  it('label switching, selected preview and draft restoration retain each medicine type and mixed dose', () => {
    state().restoreLabel(daily('BD', 'Karal', 1.5));
    const saved = structuredClone(state().labels[0]);
    state().addLabel();
    state().restoreLabel(label('Packet', ['5H']));
    state().selectLabel(0);
    render(<SelectedInstructionsPanel />);
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('කරල් 1½ බැගින් දිනකට 2 වරක්');
    act(() => state().selectLabel(1));
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('පැකට් 1 බැගින් පැය 5කට වරක්');
    act(() => state().restoreLabel(saved));
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('කරල් 1½ බැගින් දිනකට 2 වරක්');
    expect(printed(state().labels[1]).body).toContain('කරල් 1½');
  });

  it('renders multiple medicines independently and blocks an invalid non-active label', () => {
    state().restoreLabel(label('Pethi', ['5H']));
    state().addLabel();
    state().restoreLabel(label('Packet', ['6H']));
    state().selectLabel(0);
    const onPrintAndSave = vi.fn();
    const page = render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onBack={vi.fn()} onPrintAndSave={onPrintAndSave} />);
    const printedLabels = page.container.querySelectorAll('[data-label-body]');
    expect(printedLabels[0]).toHaveTextContent('පෙති 1 බැගින් පැය 5කට වරක්');
    expect(printedLabels[1]).toHaveTextContent('පැකට් 1 බැගින් පැය 6කට වරක්');
    act(() => {
      state().selectLabel(1);
      state().setProduct({ id: 'second', name: 'Second', product_type: null });
      state().selectLabel(0);
    });
    expect(screen.getByTestId('product-type-print-blocked')).toHaveTextContent('Label 2:');
    expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled();
  });
});
