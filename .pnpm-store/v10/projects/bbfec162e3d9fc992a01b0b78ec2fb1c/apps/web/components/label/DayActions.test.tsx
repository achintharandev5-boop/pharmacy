import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Day-related actions reorganised: Days and Name of Days are grid buttons; Till to the Day and
 * Edit start day are inside the Select Days panel; the bottom Days / Name of Days controls are gone.
 */
vi.mock('../../app/actions/inventory', () => ({ getDispensingBatches: vi.fn(() => new Promise(() => {})) }));

import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { BottomActionBar } from './BottomActionBar';
import { useLabelStore } from '../../store/labelStore';
import { DAY_NAMES } from '../../lib/nameOfDays';
import { buildFinalInstruction } from '../../lib/labelBuilder';

const s = () => useLabelStore.getState();
const label = () => s().labels[s().activeLabelIndex];
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const panel = () => within(screen.getByRole('region', { name: 'Action workspace' }));
const gridTiles = () => Array.from(screen.getByTestId('left').querySelectorAll('[data-testid="action-grid"] button')).map((b) => b.textContent ?? '');

function Workstation() {
  return <><div data-testid="left"><InstructionGrid /></div><ActionWorkspace /><BottomActionBar onDone={() => {}} /></>;
}

/** The label text of a Monday–Friday range with a Daily dose, built through the store as before. */
function rangeTextViaStore() {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
  s().openDaysOfWeekPanel(); s().toggleDayOfWeek('MONDAY'); s().closeDaysOfWeekPanel();
  s().toggleWeekdayRange();
  s().openDaysOfWeekPanel(); s().toggleDayOfWeek('FRIDAY'); s().closeDaysOfWeekPanel();
  return { range: structuredClone(label().weekdayRange), text: buildFinalInstruction(label()).finalInstructionText };
}

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe('button locations', () => {
  it('the five-column grid has Days and Name of Days in place of Till to the Day and Edit start day; still 20 buttons', () => {
    render(<Workstation />);
    const tiles = gridTiles();
    expect(tiles).toHaveLength(20);
    expect(tiles[1]).toMatch(/^Days/); // row 1: Reasons | Days | 5H | Evening | 6H
    expect(tiles[6]).toMatch(/^Name of Days/); // row 2: Remove Address | Name of Days | …
    expect(tiles.some((t) => t.includes('Till to the Day'))).toBe(false);
    expect(tiles.some((t) => t.includes('Edit start day'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Till to the Day' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit start day' })).toBeNull();
    // The ENT button was removed from the workstation.
    expect(screen.queryByRole('button', { name: /^ENT/ })).toBeNull();
  });

  it('the old bottom Days and Name of Days controls are gone; Expiry, label navigation and DONE remain', () => {
    render(<Workstation />);
    expect(screen.queryByRole('button', { name: 'Increase days' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decrease days' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select days of week' })).toBeNull();
    expect(button(/Expiry date not added/)).toBeInTheDocument();
    expect(button('Previous label')).toBeInTheDocument();
    expect(button('Done — review and print labels')).toBeInTheDocument();
  });
});

describe('Days', () => {
  it('opens on the right; +/− follow the former rules; Done applies, Cancel discards', () => {
    render(<Workstation />);
    fireEvent.click(button(/^Days/));
    expect(panel().getByRole('heading', { name: 'Days' })).toBeInTheDocument();
    expect(panel().getByTestId('days-qty')).toHaveTextContent('—');
    expect(panel().getByRole('button', { name: 'Decrease days quantity' })).toBeDisabled();
    fireEvent.click(panel().getByRole('button', { name: 'Increase days quantity' }));
    fireEvent.click(panel().getByRole('button', { name: 'Increase days quantity' }));
    fireEvent.click(panel().getByRole('button', { name: 'Increase days quantity' }));
    fireEvent.click(panel().getByRole('button', { name: 'Decrease days quantity' }));
    expect(panel().getByTestId('days-qty')).toHaveTextContent('2');
    expect(s().days).toBeNull(); // draft only
    fireEvent.click(panel().getByRole('button', { name: 'Cancel' }));
    expect(s().days).toBeNull();
    expect(screen.queryByRole('region', { name: 'Action workspace' })).toBeNull();

    fireEvent.click(button(/^Days/));
    fireEvent.click(panel().getByRole('button', { name: 'Increase days quantity' }));
    fireEvent.click(panel().getByRole('button', { name: 'Decrease days quantity' })); // never below 1
    expect(panel().getByRole('button', { name: 'Decrease days quantity' })).toBeDisabled();
    fireEvent.click(panel().getByRole('button', { name: 'Done' }));
    expect(s().days).toBe(1);
    expect(button(/^Days 1 day/)).toHaveAttribute('data-selected', 'true');
  });

  it('typed entry uses the existing Days number pad and its whole-number rule', () => {
    render(<Workstation />);
    fireEvent.click(button(/^Days/));
    fireEvent.click(panel().getByRole('button', { name: /Days: not set\. Type the number of days/ }));
    act(() => { s().appendDigit('1.5'); s().confirmNumberPad(); });
    expect(s().numberPad.error).toBe('Days must be a whole number.');
    act(() => { s().clearNumberPadBuffer(); s().appendDigit('30'); s().confirmNumberPad(); });
    expect(s().days).toBe(30);
    expect(buildFinalInstruction(label()).days).toBe(30);
  });
});

describe('Name of Days panel', () => {
  it('opens Select Days on the right with Sinhala weekdays, Select All, Cancel and Done', () => {
    render(<Workstation />);
    fireEvent.click(button(/^Name of Days/));
    expect(panel().getByRole('heading', { name: 'Select Days' })).toBeInTheDocument();
    for (const day of Object.values(DAY_NAMES)) expect(panel().getByRole('button', { name: day })).toBeInTheDocument();
    fireEvent.click(panel().getByRole('button', { name: 'Select All' }));
    expect(s().selectedDaysOfWeek).toHaveLength(7);
    fireEvent.click(panel().getByRole('button', { name: 'Cancel' }));
    expect(s().selectedDaysOfWeek).toEqual([]);
    fireEvent.click(button(/^Name of Days/));
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.MONDAY }));
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.WEDNESDAY }));
    // Two weekdays: Till to the Day keeps its rule (exactly one start day).
    expect(panel().getByRole('button', { name: 'Till to the Day' })).toBeDisabled();
    expect(panel().getByRole('button', { name: 'Edit start day' })).toBeDisabled();
    fireEvent.click(panel().getByRole('button', { name: 'Done' }));
    expect(s().selectedDaysOfWeek).toEqual(['MONDAY', 'WEDNESDAY']);
    expect(button(/^Name of Days/)).toHaveAttribute('data-selected', 'true');
  });

  it('Till to the Day inside the panel gives exactly the former range and Sinhala text', () => {
    const expected = rangeTextViaStore();
    s().allClear();
    s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
    render(<Workstation />);
    fireEvent.click(button(/^Name of Days/));
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.MONDAY }));
    fireEvent.click(panel().getByRole('button', { name: 'Till to the Day' }));
    expect(panel().getByRole('heading', { name: 'Select end day' })).toBeInTheDocument();
    expect(panel().getByRole('button', { name: 'Till to the Day' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.FRIDAY }));
    fireEvent.click(panel().getByRole('button', { name: 'Done' }));
    expect(label().weekdayRange).toEqual(expected.range);
    expect(buildFinalInstruction(label()).finalInstructionText).toBe(expected.text);
    expect(buildFinalInstruction(label()).finalInstructionText).toContain('සඳුදා සිට සිකුරාදා දක්වා');
    expect(label().days).toBeNull(); // no duration inferred
  });

  it('Edit start day changes only the start day and keeps the end day and other instructions', () => {
    s().toggleAdditionalInstruction('WITH FOOD');
    s().openDaysOfWeekPanel(); s().toggleDayOfWeek('MONDAY'); s().closeDaysOfWeekPanel();
    s().toggleWeekdayRange();
    s().openDaysOfWeekPanel(); s().toggleDayOfWeek('FRIDAY'); s().closeDaysOfWeekPanel();
    render(<Workstation />);
    fireEvent.click(button(/^Name of Days/));
    fireEvent.click(panel().getByRole('button', { name: 'Edit start day' }));
    expect(panel().getByRole('heading', { name: 'Select start day' })).toBeInTheDocument();
    expect(panel().getByRole('button', { name: DAY_NAMES.MONDAY })).toHaveAttribute('aria-pressed', 'true'); // current start shown
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.TUESDAY }));
    fireEvent.click(panel().getByRole('button', { name: 'Done' }));
    expect(label().weekdayRange).toMatchObject({ start: 'TUESDAY', end: 'FRIDAY', confirmed: true });
    expect(label().additionalInstructions).toContain('WITH FOOD');
  });

  it('Till to the Day again removes the range and keeps the start day; Cancel keeps the confirmed range', () => {
    s().openDaysOfWeekPanel(); s().toggleDayOfWeek('MONDAY'); s().closeDaysOfWeekPanel();
    s().toggleWeekdayRange();
    s().openDaysOfWeekPanel(); s().toggleDayOfWeek('FRIDAY'); s().closeDaysOfWeekPanel();
    render(<Workstation />);
    fireEvent.click(button(/^Name of Days/));
    fireEvent.click(panel().getByRole('button', { name: DAY_NAMES.SATURDAY }));
    fireEvent.click(panel().getByRole('button', { name: 'Cancel' }));
    expect(label().weekdayRange).toMatchObject({ start: 'MONDAY', end: 'FRIDAY' });
    fireEvent.click(button(/^Name of Days/));
    fireEvent.click(panel().getByRole('button', { name: 'Till to the Day' }));
    expect(label().weekdayRange).toBeNull();
    expect(s().selectedDaysOfWeek).toEqual(['MONDAY']);
    expect(panel().getByRole('heading', { name: 'Select Days' })).toBeInTheDocument();
  });

  it('each label keeps its own days; Name of Days stays locked by EOD as before', () => {
    s().openDaysOfWeekPanel(); s().toggleDayOfWeek('MONDAY'); s().closeDaysOfWeekPanel();
    s().addLabel();
    s().toggleAdditionalInstruction('EOD');
    render(<Workstation />);
    expect(button(/^Name of Days/)).toBeDisabled();
    act(() => s().selectLabel(0));
    expect(button(/^Name of Days/)).toBeEnabled();
    expect(s().selectedDaysOfWeek).toEqual(['MONDAY']);
    expect(s().labels[1].selectedDaysOfWeek).toEqual([]);
  });
});
