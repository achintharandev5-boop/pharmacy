import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DaysOfWeekPanel } from '../../app/label/DaysOfWeekPanel';
import { InstructionGrid } from './InstructionGrid';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard, INSTRUCTION_SIZES } from '../PrintableLabel';
import { useLabelStore, createDefaultLabel } from '../../store/labelStore';
import { DAY_NAMES, formatDays, daySelectionRefusal } from '../../lib/nameOfDays';
import { analyseLabel, daysPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { labelFitReport } from '../../lib/labelFit';
vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(c => state().toggleAdditionalInstruction(c));
function days(values = ['MONDAY']) { state().openDaysOfWeekPanel(); values.forEach(d => state().toggleDayOfWeek(d)); state().closeDaysOfWeekPanel(); }
function daily() { choose('DAILY'); state().appendDigit('1/2'); state().confirmNumberPad(); choose('EMPTY STOMACH', 'TAKE'); }
afterEach(() => setWordingModeForTests(null));
describe.each(['current', 'spec'] as const)('Name of Days (%s)', mode => {
 beforeEach(() => { state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]); state().setProduct({ id: 'p', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10); });
 it.each(Object.entries(DAY_NAMES))('selects %s as %s and highlights blue', (day, text) => {
  state().openDaysOfWeekPanel(); render(<DaysOfWeekPanel />);
  const button = screen.getByRole('button', { name: text }); fireEvent.click(button);
  expect(button).toHaveAttribute('aria-pressed', 'true'); expect(button).toHaveClass('bg-primary-soft', 'border-primary');
  expect(formatDays(state().selectedDaysOfWeek)).toBe(text);
  fireEvent.click(button); expect(state().selectedDaysOfWeek).toEqual([]);
  expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
 });
 it('retains selection order with comma and a single final conjunction; rejects duplicates', () => {
  days(['SUNDAY', 'WEDNESDAY', 'FRIDAY']); expect(formatDays(label().selectedDaysOfWeek)).toBe('ඉරිදා, බදාදා සහ සිකුරාදා');
  expect(formatDays(['MONDAY', 'THURSDAY'])).toBe('සඳුදා සහ බ්‍රහස්පතින්දා');
  expect(formatDays(['MONDAY', 'MONDAY'])).toBe('');
  state().setDaysOfWeek(['FRIDAY', 'MONDAY', 'FRIDAY', 'UNKNOWN']); expect(label().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']);
 });
 it('requires at least one day at Done and confirmation before schedules', () => {
  state().openDaysOfWeekPanel(); state().closeDaysOfWeekPanel(); expect(state().activeControl).toBe('days_of_week');
  state().toggleDayOfWeek('MONDAY'); choose('DAILY'); expect(state().additionalInstructions).not.toContain('DAILY');
  state().incrementDosage('morning'); expect(state().dosage.morning.qty).toBe(0);
  state().closeDaysOfWeekPanel(); expect(daysPrintError(label())).toContain('Choose Digital');
  daily(); expect(daysPrintError(label())).toBeNull(); expect(analyseLabel(label()).blocking).toBeNull();
 });
 it.each(['8H', '6H', '5H', 'EOD', 'WEEKLY', '4H', 'CUSTOM', 'SOS'])('refuses %s in both orders without replacing selections', code => {
  days(); choose(code); expect(state().additionalInstructions).not.toContain(code);
  expect(daySelectionRefusal(label(), code)).toBeTruthy();
  state().allClear(); choose(code); state().openDaysOfWeekPanel(); expect(state().activeControl).not.toBe('days_of_week');
  state().toggleDayOfWeek('MONDAY'); state().setDaysOfWeek(['MONDAY']); expect(label().selectedDaysOfWeek).toEqual([]);
 });
 it.each(['DAILY', 'EVENING', 'DIGITAL'])('requires days before %s and permits correction afterwards', schedule => {
  if (schedule === 'DIGITAL') state().incrementDosage('morning'); else choose(schedule);
  state().openDaysOfWeekPanel(); expect(state().activeControl).not.toBe('days_of_week');
  state().allClear(); days();
  if (schedule === 'DIGITAL') state().incrementDosage('morning'); else { choose(schedule); state().appendDigit('1'); state().confirmNumberPad(); }
  choose('EMPTY STOMACH', 'GIVE'); expect(daysPrintError(label())).toBeNull();
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('FRIDAY'); state().closeDaysOfWeekPanel(); expect(label().selectedDaysOfWeek).toEqual(['MONDAY', 'FRIDAY']);
 });
 it('uses shared Sinhala text in preview, review and print without English tags or an extra product type', () => {
  days(['MONDAY', 'THURSDAY']); daily(); const built = buildFinalInstruction(label());
  expect(built.finalInstructionText).toBe('සඳුදා සහ බ්‍රහස්පතින්දා දිනකට ½ හිස් බඩ ගන්න');
  expect(built.instructionString).toBe(built.finalInstructionText);
  const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')).toHaveTextContent(built.finalInstructionText!);
  expect(view.container).not.toHaveTextContent(/MONDAY|THURSDAY|Days:|කරල්/);
  expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
 });
 it.each(['Pethi', 'Karal', 'Packet'])('preserves %s equal BD/TDS and unequal dose rows', type => {
  days(); state().setProduct({ id: 'p', name: 'Medicine', product_type: type }); state().incrementDosage('morning'); state().incrementDosage('night'); choose('WITH FOOD', 'TAKE');
  const word = { Pethi: 'පෙති', Karal: 'කරල්', Packet: 'පැකට්' }[type];
  expect(buildFinalInstruction(label()).finalInstructionText).toContain(`සඳුදා ${word} 1`); expect(daysPrintError(label())).toBeNull();
  state().incrementDosage('lunch'); expect(buildFinalInstruction(label()).consolidatedDosage).toBe(true);
  state().incrementDosage('night'); const built = buildFinalInstruction(label()); expect(built.consolidatedDosage).toBe(false);
  const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelectorAll('[data-dose-badge]')).toHaveLength(3);
 });
 it.each(['TAKE', 'GIVE'])('preserves %s and every ordered SAM combination', action => {
  for (const methods of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
   state().allClear(); days(); state().incrementDosage('morning'); choose(...methods, action); if (!methods.some(c => ['WITH FOOD', 'EMPTY STOMACH'].includes(c))) choose('AFTER');
   expect(daysPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).finalInstructionText).toMatch(/^සඳුදා /);
  }
 });
 it('keeps committed days on Number Pad Back, cancels unconfirmed navigation edits and resets only the active label', () => {
  days(['FRIDAY', 'MONDAY']); daily();
  state().openNumberPad('frequency'); state().appendDigit('9'); state().cancelNumberPad(); expect(label().frequencyDosage.qty).toBe(0.5); expect(label().daysConfirmed).toBe(true);
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SUNDAY'); state().addLabel();
  expect(label().selectedDaysOfWeek).toEqual([]); state().selectLabel(0); expect(label().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']); expect(label().daysConfirmed).toBe(true);
  state().resetActiveLabel(); expect(label().selectedDaysOfWeek).toEqual([]);
 });
 it('detects measured vertical and horizontal overflow with seven long weekday names at unchanged font sizes', async () => {
  const actual = await vi.importActual<typeof import('../../lib/labelFit')>('../../lib/labelFit');
  days(Object.keys(DAY_NAMES)); daily(); const view = render(<LabelCard labelItem={buildFinalInstruction(label())} />);
  const body = view.container.querySelector('[data-label-body]')!; const heading = body.firstElementChild!;
  const rect = (top: number, bottom: number, right = 200) => ({ top, bottom, left: 0, right, height: bottom - top, width: right, x: 0, y: top, toJSON: () => ({}) });
  vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
  vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(rect(0, 130, 260));
  expect(actual.labelFitReport(view.container)).toEqual([{ index: 0, problems: expect.arrayContaining(['instructions (dose rows and Sinhala lines)']) }]);
  expect(heading.getAttribute('style')).toContain('font-size: var(--ins-size)'); expect(Math.min(...INSTRUCTION_SIZES)).toBe(13.5);
 });
 it('supports STAT first without duplicating the initial dose', () => {
  state().startStat(); state().incrementDosage('stat'); state().doneStat(); days(); daily();
  expect(daysPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).finalInstructionText).toBe('පළමුව පමණක් 1 ගන්න ඉන්පසු, සඳුදා දිනකට ½ හිස් බඩ ගන්න');
 });
 it('keeps per-label restoration detached and restores cancelled edits; supports complete removal', () => {
  days(['FRIDAY', 'MONDAY']); daily(); const draft = JSON.parse(JSON.stringify(label()));
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SUNDAY'); state().cancelDaysOfWeekPanel(); expect(label().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']); expect(daysPrintError(label())).toBeNull();
  state().addLabel(); expect(label().selectedDaysOfWeek).toEqual([]); state().restoreLabel(draft); draft.selectedDaysOfWeek.push('TUESDAY'); expect(label().selectedDaysOfWeek).toEqual(['FRIDAY', 'MONDAY']);
  state().openDaysOfWeekPanel(); state().removeDaysOfWeek(); expect(label().selectedDaysOfWeek).toEqual([]); expect(state().activeControl).toBe('idle');
  state().allClear(); expect(label().selectedDaysOfWeek).toEqual([]);
 });
 it.each([{ values: ['UNKNOWN'] }, { values: ['MONDAY', 'MONDAY'] }])('rejects corrupt restored weekday values %j', ({ values }) => {
  const draft = createDefaultLabel(); draft.selectedDaysOfWeek = values; draft.daysConfirmed = true; state().restoreLabel(draft); expect(daysPrintError(label())).toBeTruthy(); expect(analyseLabel(label()).blocking).toBeTruthy();
 });
 it('requires explicit legacy confirmation and permits repair without inferring defaults', () => {
  const draft = createDefaultLabel(); draft.selectedDaysOfWeek = ['MONDAY']; draft.additionalInstructions = ['DAILY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage.qty = 1;
  state().restoreLabel(draft); expect(daysPrintError(label())).toContain('Confirm selected days'); state().openDaysOfWeekPanel(); state().closeDaysOfWeekPanel(); expect(daysPrintError(label())).toBeNull();
 });
 it('locks incompatible grid controls natively and updates the selected panel', () => {
  days(['MONDAY', 'FRIDAY']); render(<InstructionGrid validationError={null} />);
  for (const name of ['8H', '6H', '5H', 'EOD', 'Weekly']) { const button = screen.getByRole('button', { name: new RegExp(name, 'i') }); expect(button).toBeDisabled(); }
  expect(screen.getAllByText('සඳුදා සහ සිකුරාදා').length).toBeGreaterThan(0);
 });
 it('blocks review and stale callbacks and retains overflow checks for all seven days', () => {
  days(Object.keys(DAY_NAMES)); daily(); const save = vi.fn(), print = vi.fn();
  const view = render(<LabelActionPage onSave={save} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} isProcessing={false} />);
  act(() => state().restoreLabel({ ...label(), selectedDaysOfWeek: ['BAD'] })); expect(screen.getByTestId('days-validation-blocked')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Save without printing/ })).toBeDisabled();
  expect(save).not.toHaveBeenCalled(); expect(print).not.toHaveBeenCalled(); view.unmount();
  state().restoreLabel({ ...label(), selectedDaysOfWeek: Object.keys(DAY_NAMES), daysConfirmed: true }); vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['instructions'] }]);
  render(<LabelActionPage onSave={save} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} isProcessing={false} />);
  fireEvent.click(screen.getByRole('button', { name: /Print/ })); expect(print).not.toHaveBeenCalled();
 });
});

