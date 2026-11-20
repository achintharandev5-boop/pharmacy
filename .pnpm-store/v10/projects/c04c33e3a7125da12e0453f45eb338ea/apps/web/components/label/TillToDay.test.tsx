import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard, INSTRUCTION_SIZES } from '../PrintableLabel';
import { useLabelStore, createDefaultLabel } from '../../store/labelStore';
import { DAY_NAMES, formatDays, formatWeekdayRange } from '../../lib/nameOfDays';
import { analyseLabel, daysPrintError, setWordingModeForTests } from '../../lib/instructionEngine';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { labelFitReport } from '../../lib/labelFit';
import { defaultEnt } from '../../lib/ent';
vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
const choose = (...codes: string[]) => codes.forEach(code => state().toggleAdditionalInstruction(code));
function first(day = 'MONDAY') { state().openDaysOfWeekPanel(); state().toggleDayOfWeek(day); state().closeDaysOfWeekPanel(); }
function range(start = 'MONDAY', end = 'FRIDAY') { first(start); state().toggleWeekdayRange(); state().openDaysOfWeekPanel(); state().toggleDayOfWeek(end); state().closeDaysOfWeekPanel(); }
function schedule(code = 'DAILY') { if (code === 'DIGITAL') state().incrementDosage('morning'); else { choose(code); state().appendDigit('1/2'); state().confirmNumberPad(); } choose('EMPTY STOMACH', 'TAKE'); }
afterEach(() => setWordingModeForTests(null));
describe.each(['current', 'spec'] as const)('Till to the Day (%s)', mode => {
 beforeEach(() => { state().allClear(); setWordingModeForTests(mode); vi.mocked(labelFitReport).mockReturnValue([]); state().setProduct({ id: 'p', name: 'Medicine', product_type: 'Karal' }); state().setProductQuantity(10); });
 it('follows the PDF day-first sequence, retains the first day and waits for a distinct end entry', () => {
  state().toggleWeekdayRange(); expect(label().weekdayRange).toBeFalsy(); expect(state().workflowNotice).toContain('exactly one');
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('MONDAY'); state().toggleWeekdayRange(); expect(label().weekdayRange).toBeFalsy();
  state().closeDaysOfWeekPanel(); state().toggleWeekdayRange();
  expect(label().weekdayRange).toEqual({ start: 'MONDAY', end: null, confirmed: false }); expect(label().selectedDaysOfWeek).toEqual([]); expect(state().activeControl).toBe('idle');
  expect(buildFinalInstruction(label()).finalInstructionText).toBe(''); expect(daysPrintError(label())).toContain('end weekday');
  choose('DAILY'); state().incrementDosage('morning'); expect(label().additionalInstructions).not.toContain('DAILY'); expect(label().dosage.morning.qty).toBe(0);
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('FRIDAY'); expect(label().weekdayRange?.confirmed).toBe(false); state().closeDaysOfWeekPanel(); schedule(); expect(analyseLabel(label()).blocking).toBeNull();
 });
 it.each(Object.keys(DAY_NAMES))('retains %s as the end weekday without calendar sorting', end => {
  range('SUNDAY', end); schedule(); const text = formatWeekdayRange(label().weekdayRange);
  expect(text).toBe(`ඉරිදා සිට ${DAY_NAMES[end]} දක්වා`); expect(daysPrintError(label())).toBeNull(); expect(text).not.toContain('සහ');
  expect(text.match(/සිට/g)).toHaveLength(1); expect(text.match(/දක්වා/g)).toHaveLength(1);
 });
 it('allows identical endpoints without inferring duration', () => { range('MONDAY', 'MONDAY'); schedule(); expect(daysPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).finalInstructionText).toBe('සඳුදා සිට සඳුදා දක්වා දිනකට ½ හිස් බඩ ගන්න'); expect(label().days).toBeNull(); });
 it('renders blue range/endpoint states and natively locks incompatible controls', () => {
  // Till to the Day is inside the Select Days panel (Name of Days): it confirms the start day and opens the end day.
  first(); const view = render(<><InstructionGrid /><ActionWorkspace /></>); fireEvent.click(screen.getByRole('button', { name: /^Name of Days/ })); fireEvent.click(screen.getByRole('button', { name: 'Till to the Day' }));
  expect(screen.getByRole('button', { name: 'Till to the Day' })).toHaveAttribute('aria-pressed', 'true'); expect(screen.getByRole('button', { name: 'Till to the Day' })).toHaveClass('border-primary');
  expect(screen.getByRole('heading', { name: 'Select end day' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Select All' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(label().weekdayRange?.start).toBe('MONDAY');
  for (const name of ['Weekly', 'EOD', 'STAT', '8H', '6H', '5H', 'Daily', 'Evening']) { const button = screen.getByRole('button', { name }); expect(button).toBeDisabled(); expect(button.className).toContain('opacity-45'); }
  act(() => state().openDaysOfWeekPanel()); expect(screen.getByRole('heading', { name: 'Select end day' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Select All' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: DAY_NAMES.FRIDAY })); expect(screen.getByRole('button', { name: DAY_NAMES.FRIDAY })).toHaveClass('bg-primary-soft', 'border-primary'); fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.getByRole('button', { name: 'Daily' })).toBeEnabled(); expect(view.container).toHaveTextContent('සඳුදා සිට සිකුරාදා දක්වා');
 });
 it.each(['WEEKLY', 'EOD', '8H', '6H', '5H', 'STAT'])('refuses %s in either order and preserves existing selection', code => {
  range(); const previous = structuredClone(label()); choose(code); expect(label().additionalInstructions).toEqual(previous.additionalInstructions); expect(label().weekdayRange).toEqual(previous.weekdayRange);
  state().allClear(); if (code === 'STAT') { state().startStat(); state().incrementDosage('stat'); state().doneStat(); } else { choose(code); state().appendDigit('1'); state().confirmNumberPad(); }
  state().toggleWeekdayRange(); expect(label().weekdayRange).toBeFalsy(); expect(label().additionalInstructions).toContain(code);
 });
 it('preserves multiple independent weekdays and refuses unrelated conversions', () => {
  first(); state().openDaysOfWeekPanel(); state().toggleDayOfWeek('WEDNESDAY'); state().closeDaysOfWeekPanel(); state().toggleWeekdayRange();
  expect(label().weekdayRange).toBeFalsy(); expect(label().selectedDaysOfWeek).toEqual(['MONDAY', 'WEDNESDAY']); expect(formatDays(label().selectedDaysOfWeek)).toBe('සඳුදා සහ බදාදා');
  state().allClear(); first(); schedule(); state().toggleWeekdayRange(); expect(label().weekdayRange).toBeFalsy(); expect(label().selectedDaysOfWeek).toEqual(['MONDAY']);
 });
 it.each(['DAILY', 'EVENING', 'DIGITAL'])('combines a completed range with %s without an assumed product type', code => {
  range(); schedule(code); expect(daysPrintError(label())).toBeNull(); const built = buildFinalInstruction(label()); expect(built.finalInstructionText).toMatch(/^සඳුදා සිට සිකුරාදා දක්වා /); expect(built.finalInstructionText).not.toMatch(/TILL|MONDAY|FRIDAY|සහ|කරල්/);
  const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelector('[data-label-body]')?.textContent).toMatch(/^සඳුදා සිට සිකුරාදා දක්වා /); expect(view.container.querySelector('[data-label]')).toHaveClass('w-[70mm]', 'h-[50mm]');
 });
 it.each(['Pethi', 'Karal', 'Packet'])('preserves %s BD/TDS consolidation and unequal circled rows', product_type => {
  range(); state().setProduct({ id: 'p', name: 'Medicine', product_type }); state().incrementDosage('morning'); state().incrementDosage('night'); choose('EMPTY STOMACH', 'TAKE');
  const word = { Pethi: 'පෙති', Karal: 'කරල්', Packet: 'පැකට්' }[product_type]; expect(buildFinalInstruction(label()).finalInstructionText).toContain(`දක්වා ${word} 1`);
  state().incrementDosage('lunch'); expect(buildFinalInstruction(label()).consolidatedDosage).toBe(true); state().incrementDosage('night'); const built = buildFinalInstruction(label()); expect(built.consolidatedDosage).toBe(false);
  const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelectorAll('[data-dose-badge]')).toHaveLength(3); expect(daysPrintError(label())).toBeNull();
 });
 it.each(['TAKE', 'GIVE'])('retains %s with all approved SAM combinations and ordinary timing', action => {
  for (const methods of [[], ['WITH FOOD'], ['EMPTY STOMACH'], ['CHEWABLE'], ['DISSOLVE AND DRINK'], ['KEEP IN MOUTH'], ['WITH FOOD', 'CHEWABLE'], ['WITH FOOD', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'CHEWABLE'], ['EMPTY STOMACH', 'DISSOLVE AND DRINK'], ['EMPTY STOMACH', 'KEEP IN MOUTH']]) {
   state().allClear(); range(); state().incrementDosage('morning'); choose(...methods, action); if (!methods.some(c => ['WITH FOOD', 'EMPTY STOMACH'].includes(c))) choose('AFTER'); expect(daysPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).finalInstructionText).toMatch(/^සඳුදා සිට සිකුරාදා දක්වා /);
  }
 });
 it('retains the completed Evening + Digital four-dose consolidation and unequal rows', () => {
  range(); choose('EVENING'); state().appendDigit('1'); state().confirmNumberPad(); state().confirmEvening();
  for (const time of ['morning', 'lunch', 'night'] as const) state().incrementDosage(time);
  choose('EMPTY STOMACH', 'TAKE'); expect(daysPrintError(label())).toBeNull(); expect(buildFinalInstruction(label()).finalInstructionText).toBe('සඳුදා සිට සිකුරාදා දක්වා කරල් 1 බැගින් දිනකට හතර වරක් හිස් බඩ ගන්න');
  state().incrementDosage('night'); const built = buildFinalInstruction(label()); const view = render(<LabelCard labelItem={built} />); expect(view.container.querySelectorAll('[data-dose-badge]')).toHaveLength(4);
 });
 it('abandons pending endpoint snapshots when resetting or clearing instructions', () => {
  range(); state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SUNDAY'); state().resetActiveLabel(); state().addLabel(); state().selectLabel(0); expect(label().weekdayRange).toBeNull();
  range(); state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SUNDAY'); state().clearLabelInstructions(); state().addLabel(); state().selectLabel(0); expect(label().weekdayRange).toBeNull(); expect(label().additionalInstructions).toEqual([]);
 });
 it('keeps start/end edits distinct and cancels pending edits on Back/navigation', () => {
  range(); schedule(); state().openDaysOfWeekPanel('start'); state().toggleDayOfWeek('TUESDAY'); expect(label().weekdayRange?.end).toBe('FRIDAY'); state().closeDaysOfWeekPanel(); expect(label().weekdayRange?.start).toBe('TUESDAY');
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SUNDAY'); state().cancelDaysOfWeekPanel(); expect(label().weekdayRange?.end).toBe('FRIDAY'); expect(label().weekdayRange?.confirmed).toBe(true);
  state().openDaysOfWeekPanel(); state().toggleDayOfWeek('SATURDAY'); state().addLabel(); expect(label().weekdayRange).toBeFalsy(); state().selectLabel(0); expect(label().weekdayRange?.end).toBe('FRIDAY');
  state().openNumberPad('frequency'); state().appendDigit('9'); state().cancelNumberPad(); expect(label().frequencyDosage.qty).toBe(0.5); expect(label().weekdayRange?.end).toBe('FRIDAY');
 });
 it('deselects a range back to its original single-day qualifier, clears stale endpoints and resets independently', () => {
  range(); state().toggleWeekdayRange(); expect(label().weekdayRange).toBeNull(); expect(label().selectedDaysOfWeek).toEqual(['MONDAY']);
  state().toggleWeekdayRange(); expect(label().weekdayRange?.end).toBeNull(); state().resetActiveLabel(); expect(label().weekdayRange).toBeFalsy();
  range(); state().clearLabelInstructions(); expect(label().weekdayRange).toBeNull(); expect(label().additionalInstructions).toEqual([]);
 });
 it('restores a detached per-label serialized range and rejects invalid legacy tags without printing old translations', () => {
  range(); schedule(); const draft = JSON.parse(JSON.stringify(label())); state().addLabel(); state().restoreLabel(draft); draft.weekdayRange.start = 'BAD'; expect(label().weekdayRange?.start).toBe('MONDAY'); expect(daysPrintError(label())).toBeNull();
  state().restoreLabel({ ...label(), weekdayRange: null, additionalInstructions: ['TILL DATE', 'DAILY', 'EMPTY STOMACH', 'TAKE'] }); expect(daysPrintError(label())).toContain('legacy'); expect(buildFinalInstruction(label()).finalInstructionText).toBe(''); state().toggleAdditionalInstruction('TILL DATE'); expect(label().additionalInstructions).not.toContain('TILL DATE');
 });
 it.each([
  { start: null, end: null, confirmed: false }, { start: 'MONDAY', end: null, confirmed: false }, { start: null, end: 'FRIDAY', confirmed: true },
  { start: 'BAD', end: 'FRIDAY', confirmed: true }, { start: 'MONDAY', end: 'BAD', confirmed: true }, { start: 'MONDAY', end: 'FRIDAY', confirmed: false },
 ])('rejects incomplete/malformed endpoints %j', weekdayRange => {
  state().restoreLabel({ ...createDefaultLabel(), additionalInstructions: ['TILL TO DAY'], weekdayRange }); expect(daysPrintError(label())).toBeTruthy(); expect(analyseLabel(label()).blocking).toBeTruthy(); expect(buildFinalInstruction(label()).finalInstructionText).toBe('');
 });
 it('rejects marker/metadata mismatch, duplicate markers, mixed individual days and restored reverse selection order', () => {
  range(); schedule(); const valid = structuredClone(label());
  for (const draft of [{ ...valid, additionalInstructions: valid.additionalInstructions.filter(c => c !== 'TILL TO DAY') }, { ...valid, additionalInstructions: ['TILL TO DAY', ...valid.additionalInstructions] }, { ...valid, selectedDaysOfWeek: ['SUNDAY'] }, { ...valid, additionalInstructions: ['DAILY', 'TILL TO DAY', 'EMPTY STOMACH', 'TAKE'] }]) { state().restoreLabel(draft); expect(daysPrintError(label())).toBeTruthy(); }
 });
 it('refuses direct bulk-day/ENT/legacy actions while retaining valid endpoints', () => {
  range(); const previous = structuredClone(label().weekdayRange); state().setDaysOfWeek(['SUNDAY']); expect(label().selectedDaysOfWeek).toEqual([]); state().setEnt(defaultEnt('ear')); expect(label().additionalInstructions).toEqual(['TILL TO DAY']); expect(label().weekdayRange).toEqual(previous);
  state().allClear(); choose('TILL DATE', 'AND THIS DATE'); expect(label().additionalInstructions).toEqual([]);
 });
 it('rechecks review callbacks and measured overflow at unchanged range-heading font size', async () => {
  range('THURSDAY', 'SATURDAY'); schedule(); const save = vi.fn(), print = vi.fn(); const view = render(<LabelActionPage onSave={save} onPrintAndSave={print} onBack={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Print & Save' })).toBeEnabled(); vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['instructions'] }]); fireEvent.click(screen.getByRole('button', { name: 'Print & Save' })); expect(print).not.toHaveBeenCalled();
  act(() => state().restoreLabel({ ...label(), weekdayRange: { start: 'THURSDAY', end: null, confirmed: false } })); expect(screen.getByRole('button', { name: 'Save without printing' })).toBeDisabled(); expect(screen.getByTestId('days-validation-blocked')).toBeInTheDocument(); view.unmount();
  const actual = await vi.importActual<typeof import('../../lib/labelFit')>('../../lib/labelFit'); state().restoreLabel({ ...label(), weekdayRange: { start: 'THURSDAY', end: 'SATURDAY', confirmed: true } });
  const printed = render(<LabelCard labelItem={buildFinalInstruction(label())} />); const body = printed.container.querySelector('[data-label-body]')!; const heading = body.firstElementChild!;
  const rect = (bottom: number) => ({ top: 0, bottom, left: 0, right: 200, height: bottom, width: 200, x: 0, y: 0, toJSON: () => ({}) }); vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect(100)); vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(rect(140));
  expect(actual.labelFitReport(printed.container)[0].problems).toContain('instructions (dose rows and Sinhala lines)'); expect(heading.getAttribute('style')).toContain('font-size: var(--ins-size)'); expect(Math.min(...INSTRUCTION_SIZES)).toBe(13.5);
 });
});
