import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DosagePanel } from './DosagePanel';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, digitalPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { digitalSchedule } from '../../lib/digitalSchedule';
import { labelFitReport } from '../../lib/labelFit';

vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
function doses(morning: number, lunch: number, night: number) {
  state().restoreLabel({ ...label(), dosage: {
    morning: { qty: morning, isFraction: !Number.isInteger(morning) }, lunch: { qty: lunch, isFraction: !Number.isInteger(lunch) }, night: { qty: night, isFraction: !Number.isInteger(night) },
  } });
}
const button = (name: string | RegExp) => screen.getByRole('button', { name });
afterEach(() => setWordingModeForTests(null));

describe.each(['current', 'spec'] as const)('Digital Label (%s)', mode => {
  beforeEach(() => {
    state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]);
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10);
  });

  it.each(['BD', 'TDS'])('%s consolidates numerical equals for every type and fractional quantity', pattern => {
    for (const [type, word] of [['Pethi', 'පෙති'], ['Karal', 'කරල්'], ['Packet', 'පැකට්']]) {
      for (const [qty, formatted] of [[1, '1'], [0.5, '½'], [1.5, '1½'], [1 / 3, '1/3']] as const) {
        state().allClear(); state().setProduct({ id: type, name: type, product_type: type }); doses(qty, pattern === 'TDS' ? qty : 0, qty); choose('EMPTY STOMACH', 'TAKE');
        const built = buildFinalInstruction(label()); const text = `${word} ${formatted} බැගින් දිනකට ${pattern === 'BD' ? 2 : 3} වරක් හිස් බඩ ගන්න`;
        expect(digitalSchedule(label()).pattern).toBe(pattern); expect(built.instructionString).toBe(text); expect(built.finalInstructionText).toBe(text);
        const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(text);
        expect(view.container.querySelector('[data-dose-badge]')).toBeNull(); expect(digitalPrintError(label())).toBeNull(); view.unmount();
        choose('TAKE'); choose('GIVE'); expect(buildFinalInstruction(label()).instructionString).toContain('හිස් බඩ දෙන්න'); choose('GIVE');
      }
    }
  });

  it.each([[1, 0, 2], [1, 2, 3], [0, 0.5, 1.5], [1.5, 1 / 3, 0]])('prints unequal %j / %j / %j in Picture 5 row order with circled quantities', (m, l, n) => {
    doses(m, l, n); choose('TAKE', 'AFTER'); const built = buildFinalInstruction(label());
    const view = render(<LabelCard labelItem={built} />); const rows = digitalSchedule(label()).rows;
    expect(Array.from(view.container.querySelectorAll('[data-dose-time]')).map(el => el.getAttribute('data-dose-time'))).toEqual(rows.map(row => row.time));
    expect(Array.from(view.container.querySelectorAll('[data-dose-badge]')).map(el => el.textContent)).toEqual(rows.map(row => row.formatted));
    for (const badge of view.container.querySelectorAll('[data-dose-badge]')) expect(badge).toHaveClass('rounded-full', 'border-black', 'text-[12px]');
    expect(view.container.querySelector('[data-digital-layout]')).toHaveClass('flex', 'items-stretch');
    expect(view.container.querySelector('[data-digital-administration]')).toHaveTextContent(mode === 'current' ? 'කෑමට පසු ගන්න' : 'ගන්න කෑමට පසු');
    expect(built.instructionString).not.toMatch(/දිනකට [23] වරක්|කරල්/); expect(digitalPrintError(label())).toBeNull();
    expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
    expect(view.container.querySelector('[data-label-body]')).toHaveClass('flex-1'); // the instruction area takes all height the optional rows leave free
  });

  it.each([[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]])('zero is an unselected slot for %j/%j/%j, not an invented dose', (m, l, n) => {
    doses(m, l, n); if (m + l + n) choose('EMPTY STOMACH', 'GIVE');
    const built = buildFinalInstruction(label()); expect(digitalSchedule(label()).rows).toHaveLength(m + l + n ? 1 : 0);
    expect(built.consolidatedDosage).toBe(false); expect(built.instructionString).not.toContain('කරල්'); expect(digitalPrintError(label())).toBeNull();
  });

  it('switches BD ↔ TDS through independent Lunch controls and supports Back/fractions/reset', () => {
    doses(1, 0, 1); choose('WITH FOOD', 'TAKE'); render(<><ActionWorkspace /><InstructionGrid /></>);
    expect(screen.getByRole('group', { name: 'Morning dose' })).toHaveAttribute('data-selected', 'true'); expect(screen.getByTestId('morning-qty')).toHaveClass('text-primary'); // soft selected state, not a solid-blue block expect(button(/Morning quantity/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('දිනකට 2 වරක්');
    fireEvent.click(button('Increase LUNCH dosage')); expect(digitalSchedule(label()).pattern).toBe('TDS'); expect(screen.getByTestId('label-text-preview')).toHaveTextContent('දිනකට 3 වරක්');
    fireEvent.click(button('Decrease LUNCH dosage')); expect(digitalSchedule(label()).pattern).toBe('BD');
    fireEvent.click(button(/Morning quantity/)); fireEvent.click(button('3')); fireEvent.click(button('BACK')); expect(state().dosage.morning.qty).toBe(1);
    fireEvent.click(button(/Morning fraction:/)); fireEvent.click(button('1/2')); fireEvent.click(screen.getByTestId('numpad-enter'));
    expect(state().dosage.morning.qty).toBe(1.5); expect(digitalSchedule(label()).unequal).toBe(true);
    act(() => state().allClear()); expect(digitalSchedule(label()).rows).toEqual([]);
  });

  it.each(['8H', '6H', '5H', 'DAILY'])('refuses %s over Digital in UI and store without changing doses', code => {
    doses(1, 0, 1); render(<><InstructionGrid /><ActionWorkspace /></>);
    const target = button(code === 'DAILY' ? 'Daily' : code); expect(target).toBeDisabled(); expect(target).toHaveClass('opacity-45');
    fireEvent.click(target); act(() => choose(code)); expect(state().additionalInstructions).not.toContain(code); expect(state().dosage.night.qty).toBe(1);
  });

  it.each(['8H', '6H', '5H', 'DAILY'])('refuses Digital over %s and releases it on removal', code => {
    choose(code); state().appendDigit('1'); state().confirmNumberPad(); render(<DosagePanel />);
    expect(button('Increase MORNING dosage')).toBeDisabled();
    act(() => { state().incrementDosage('morning'); state().openNumberPad('night_fraction'); }); expect(state().dosage.morning.qty).toBe(0); expect(state().numberPad.visible).toBe(false);
    act(() => choose(code)); expect(button('Increase MORNING dosage')).toBeEnabled();
  });

  it.each([-1, NaN, Infinity, -Infinity])('blocks invalid digital quantity %s and permits correction', qty => {
    doses(1, 0, qty); choose('TAKE', 'AFTER'); expect(analyseLabel(label()).blocking).toBeTruthy();
    const save = vi.fn(), print = vi.fn(); render(<LabelActionPage onSave={save} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
    expect(button('Save without printing')).toBeDisabled(); expect(button('Print & Save')).toBeDisabled(); expect(screen.getByTestId('digital-validation-blocked')).toHaveTextContent('Label 1');
    act(() => doses(1, 0, 1)); expect(button('Save without printing')).toBeEnabled(); expect(button('Print & Save')).toBeEnabled();
  });

  it('rejects malformed/missing slots and legacy BD/TDS markers without mutating the saved draft', () => {
    doses(1, 0, 1); const draft = structuredClone(label());
    Reflect.deleteProperty(draft.dosage, 'night'); state().restoreLabel(draft); expect(digitalPrintError(label())).toBeTruthy(); expect(draft.dosage).not.toHaveProperty('night');
    doses(1, 0, 1); choose('BD', 'TDS'); expect(digitalPrintError(label())).toContain('legacy frequency'); choose('BD', 'TDS'); choose('EMPTY STOMACH', 'TAKE'); expect(digitalPrintError(label())).toBeNull();
  });

  it.each([null, 'Unsupported'])('requires a supported type for equal doses but keeps unequal doses type-free: %s', type => {
    state().setProduct({ id: 'x', name: 'X', product_type: type }); doses(1, 0, 1); choose('TAKE', 'BEFORE'); expect(digitalPrintError(label())).toMatch(/product type/i);
    doses(1, 0, 2); expect(digitalPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).not.toContain('පෙති');
  });

  it.each(['TAKE', 'GIVE'])('preserves %s across completed SAM combinations', action => {
    for (const method of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
      state().allClear(); state().setProduct({ id: 'k', name: 'K', product_type: 'Karal' }); doses(0.5, 0.5, 0.5); choose(...method, action);
      if (!method.includes('WITH FOOD') && !method.includes('EMPTY STOMACH')) choose('AFTER');
      expect(digitalPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).instructionString).toMatch(/^කරල් ½ බැගින් දිනකට 3 වරක් /);
    }
  });

  it.each(['STAT', 'EOD', 'WEEKLY', 'EVENING'])('retains existing %s compatibility without a new workflow', modifier => {
    if (modifier === 'STAT') { state().startStat(); state().incrementDosage('stat'); state().doneStat(); }
    else { choose(modifier); if (modifier === 'WEEKLY') { state().appendDigit('1'); state().confirmNumberPad(); state().confirmWeekly(); } if (modifier === 'EVENING') { state().appendDigit('1'); state().confirmNumberPad(); state().confirmEvening(); } }
    doses(1, 1, 1); choose('EMPTY STOMACH', 'TAKE'); const built = buildFinalInstruction(label()); expect(digitalPrintError(label())).toBeNull();
    if (modifier === 'STAT') expect(built.instructionString).toMatch(/^පළමුව පමණක් 1 ගන්න ඉන්පසු,/);
    if (modifier === 'EOD') expect(built.instructionString).toMatch(/^දිනක් හැර දිනක්,/);
    if (modifier === 'WEEKLY') expect(built.instructionString).toContain('කරල් 1 සතියකට වරක්');
    if (modifier === 'EVENING') expect(built.instructionString).toContain('දිනකට හතර වරක්');
  });

  it('preserves independent labels and serialized draft badge structure', () => {
    doses(1.5, 0, 0.5); choose('EMPTY STOMACH', 'GIVE'); const saved = JSON.parse(JSON.stringify(label())); const first = buildFinalInstruction(label());
    state().addLabel(); doses(1, 1, 1); state().selectLabel(0); state().restoreLabel(saved); expect(buildFinalInstruction(label()).digitalRows).toEqual(first.digitalRows);
    expect(buildFinalInstruction(label()).finalInstructionText).toBe(first.finalInstructionText); expect(saved.dosage.night.qty).toBe(0.5);
  });

  it('retains Weekly with unequal circled rows and permits equal-dose consolidation', () => {
    choose('WEEKLY'); state().appendDigit('1'); state().confirmNumberPad(); state().confirmWeekly(); doses(1, 0, 2); choose('EMPTY STOMACH', 'TAKE');
    expect(digitalPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).weeklyPrefix).toBeTruthy();
    doses(1, 0, 1); expect(digitalPrintError(label())).toBeNull();
  });

  it('keeps the print-fit guard for unequal rows and rechecks at click time', () => {
    doses(1.5, 0, 0.5); choose('EMPTY STOMACH', 'GIVE'); const print = vi.fn();
    render(<LabelActionPage onSave={vi.fn()} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
    expect(button('Print & Save')).toBeEnabled(); vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['medicine instructions'] }]); fireEvent.click(button('Print & Save'));
    expect(print).not.toHaveBeenCalled(); expect(screen.getByTestId('print-blocked')).toBeInTheDocument();
  });
});
