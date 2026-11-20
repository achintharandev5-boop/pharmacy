import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Two-column workstation: the action buttons always stay on the left; an action's own panel, with
 * its Enter / Done / Cancel buttons, opens on the right (ActionWorkspace).
 */
vi.mock('../../app/actions/inventory', () => ({ getDispensingBatches: vi.fn(() => new Promise(() => {})) }));

import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { useLabelStore } from '../../store/labelStore';
import { defaultEnt } from '../../lib/ent';

const s = () => useLabelStore.getState();
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const workspace = () => screen.queryByRole('region', { name: 'Action workspace' });

function Workstation() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div data-testid="left"><InstructionGrid /></div>
      <div data-testid="right"><ActionWorkspace /></div>
    </div>
  );
}

/** The 20 buttons of the left label options: Schedule, Instructions and Label actions. */
const gridTiles = () => Array.from(screen.getByTestId('left').querySelectorAll('[data-testid="action-grid"] button'));

beforeEach(() => {
  s().allClear();
  s().setReasonCatalogue(['කැස්සට', 'සෙමට']);
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe('every action button keeps the left grid and uses the right column', () => {
  it.each([
    // [button, open workspace on the right (null: immediate toggle, nothing to confirm)]
    ['Reasons', 'reasons'],
    ['Days', 'days'],
    ['5H', 'number_pad'],
    ['Evening', 'number_pad'],
    ['6H', 'number_pad'],
    ['Remove Address', null],
    ['Weekly', 'number_pad'],
    ['STAT', 'stat'],
    ['EOD', null],
    ['EXP Date', 'expiry'],
    ['Empty Stomach', null],
    ['With Food', null],
    ['Chewable', null],
    ['Daily', 'number_pad'],
    ['Delete Label', 'delete_label'],
    ['Add Label', null],
    ['Dissolve and Drink', null],
    ['Keep in Mouth', null],
    ['8H', 'number_pad'],
    ['Name of Days', 'days_of_week'],
  ])('%s', (name, expected) => {
    render(<Workstation />);
    expect(gridTiles()).toHaveLength(20);
    fireEvent.click(button(new RegExp(`^${name}`)));

    // The left grid is never replaced.
    expect(gridTiles()).toHaveLength(20);
    expect(within(screen.getByTestId('left')).getByLabelText('Selected instructions')).toBeInTheDocument();

    if (expected === 'reasons') {
      // Reasons already opened on the right, in place of the Dosage Schedule.
      expect(within(screen.getByTestId('right')).getByRole('button', { name: 'Omit reasons' })).toBeInTheDocument();
      expect(within(screen.getByTestId('right')).getByRole('button', { name: /Enter/ })).toBeInTheDocument();
    } else if (expected) {
      expect(workspace()).toHaveAttribute('data-workspace', expected);
      expect(screen.getByTestId('right')).toContainElement(workspace());
      // While it is open, the grid tiles are locked (faded), as when the panel replaced them.
      for (const tile of gridTiles()) expect(tile).toBeDisabled();
    } else {
      expect(workspace()).toBeNull();
      expect(within(screen.getByTestId('right')).getByLabelText('Morning dose')).toBeInTheDocument();
    }
  });
});

describe('right-hand panels', () => {
  it('STAT: quantity, X/Y, Done (Next) are on the right; the grid stays; Cancel restores the default view', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('STAT'));
    const right = within(screen.getByTestId('right'));
    expect(right.getByRole('button', { name: 'Done (Next)' })).toBeDisabled();
    expect(within(screen.getByTestId('left')).queryByRole('button', { name: 'Done (Next)' })).toBeNull();
    expect(right.getByRole('button', { name: 'Take medication' })).toBeDisabled(); // Administration stays, locked
    await user.click(right.getByRole('button', { name: 'Increase STAT quantity' }));
    expect(s().stat?.qty).toBe(1);
    expect(gridTiles()).toHaveLength(20);
    await user.click(right.getByRole('button', { name: /Cancel/ }));
    expect(workspace()).toBeNull();
    expect(s().stat).toBeNull();
    expect(button('STAT')).toBeEnabled(); // the grid is unlocked again
    expect(button('Weekly')).toBeEnabled();
    expect(right.getByLabelText('Morning dose')).toBeInTheDocument();
  });

  it('a dosage quantity keeps its row and live X/Y preview above the pad', async () => {
    const user = userEvent.setup();
    s().incrementDosage('morning');
    render(<Workstation />);
    await user.click(button(/Morning fraction: none/));
    const right = within(screen.getByTestId('right'));
    expect(workspace()).toHaveAttribute('data-workspace', 'number_pad');
    expect(right.getByText('Editing Morning fraction')).toBeInTheDocument();
    expect(right.queryByLabelText('Lunch dose')).toBeNull();
    await user.click(right.getByRole('button', { name: '1/2' }));
    expect(screen.getByTestId('morning-qty')).toHaveTextContent('1½');
    await user.click(screen.getByTestId('numpad-enter'));
    expect(workspace()).toBeNull();
    expect(s().dosage.morning).toEqual({ qty: 1.5, isFraction: true });
  });

  it('Weekly: its pad opens on the right and its Done stays in Administration on the right', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button('Weekly'));
    const right = within(screen.getByTestId('right'));
    expect(right.getByRole('button', { name: 'Done - Weekly' })).toBeDisabled();
    expect(screen.queryByTestId('numpad-enter')).toBeNull(); // compact quantity editor, not the number pad
    await user.click(within(workspace()!).getByRole('button', { name: 'Increase Weekly quantity' }));
    await user.click(right.getByRole('button', { name: /Done \(Next\)/ }));
    expect(workspace()).toBeNull();
    await user.click(right.getByRole('button', { name: 'Done - Weekly' }));
    expect(s().weeklyDosage.confirmed).toBe(true);
  });

  it('Name of Days: weekday selection and Done/Cancel are on the right', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button(/^Name of Days/));
    const right = within(screen.getByTestId('right'));
    await user.click(right.getByRole('button', { name: 'සඳුදා' }));
    await user.click(right.getByRole('button', { name: 'Cancel' }));
    expect(s().selectedDaysOfWeek).toEqual([]);
    expect(workspace()).toBeNull();
  });

  it('the workstation has no ENT button', () => {
    render(<Workstation />);
    expect(screen.queryByRole('button', { name: /^ENT/ })).toBeNull();
    expect(gridTiles()).toHaveLength(20);
  });

  it('ENT data already on a label stays visible and removable, and its panel still renders', () => {
    act(() => s().setEnt(defaultEnt('eye')));
    render(<Workstation />);
    const selected = within(screen.getByTestId('left')).getByLabelText('Selected instructions');
    expect(selected.textContent).toMatch(/eye/i);
    // The ENT workspace is kept for backward compatibility (no visible control opens it).
    act(() => s().setActiveControl('ent'));
    expect(workspace()).toHaveAttribute('data-workspace', 'ent');
    expect(screen.getByRole('region', { name: 'ENT administration' })).toBeInTheDocument();
  });

  it('Delete Label confirms on the right and closes when the label is switched', async () => {
    const user = userEvent.setup();
    s().addLabel();
    render(<Workstation />);
    await user.click(button('Delete Label'));
    const confirm = within(screen.getByTestId('right')).getByRole('alertdialog');
    expect(within(confirm).getByRole('button', { name: /Delete Label/ })).toBeInTheDocument();
    // Switching labels must never let the open confirmation delete the other label.
    act(() => s().selectLabel(0));
    expect(workspace()).toBeNull();
    expect(s().labels).toHaveLength(2);
  });

  it('EXP Date opens the batch lookup on the right; Cancel restores the default view', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(button(/EXP Date/));
    const dialog = within(screen.getByTestId('right')).getByRole('dialog');
    expect(within(dialog).getByRole('status')).toHaveTextContent('Loading batches');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(workspace()).toBeNull();
    expect(s().expiryDate).toBeNull();
  });

  it('each label keeps its own state while switching with a panel open', async () => {
    const user = userEvent.setup();
    s().addLabel();
    s().setProduct({ id: 'medicine-2', name: 'Medicine 2', product_type: 'Pethi' });
    render(<Workstation />);
    await user.click(button('STAT'));
    await user.click(button('Increase STAT quantity'));
    act(() => s().selectLabel(0)); // leaving mid-STAT abandons that entry (existing rule)
    expect(workspace()).toBeNull();
    expect(s().labels[1].stat).toBeNull();
    expect(s().labels[0].product?.name).toBe('Medicine');
  });
});
