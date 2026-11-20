import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { DosagePanel } from './DosagePanel';
import { ActionWorkspace } from './ActionWorkspace';
import { InstructionGrid } from './InstructionGrid';
import { useLabelStore } from '../../store/labelStore';

/** Dosage Schedule visual redesign: soft selected state, same controls and behaviour. */
const s = () => useLabelStore.getState();
const row = (name: 'Morning' | 'Lunch' | 'Night') => screen.getByRole('group', { name: `${name} dose` });
const qtyButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} quantity`) });

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe('Dosage Schedule rows', () => {
  it('quantity 0 is neutral: no selection, no indicator, minus disabled', () => {
    render(<DosagePanel />);
    for (const name of ['Morning', 'Lunch', 'Night'] as const) {
      expect(row(name)).not.toHaveAttribute('data-selected');
      expect(row(name)).toHaveClass('border-border');
      expect(screen.getByTestId(`${name.toUpperCase().toLowerCase()}-qty`)).toHaveTextContent('0');
      expect(screen.queryByTestId(`${name.toLowerCase()}-selected`)).toBeNull();
      expect(screen.queryByTestId(`${name.toLowerCase()}-accent`)).toBeNull();
      // Neutral: the time-of-day tint, never the blue selected fill.
      expect(row(name)).not.toHaveClass('bg-primary-soft/40');
      expect(qtyButton(name)).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: `Decrease ${name.toUpperCase()} dosage` })).toBeDisabled();
    }
  });

  it('+ selects softly: light-blue card, stronger border, left accent bar, "Active" text and blue number; no checkmark, never solid blue', async () => {
    const user = userEvent.setup();
    render(<DosagePanel />);
    await user.click(screen.getByRole('button', { name: 'Increase MORNING dosage' }));
    expect(s().dosage.morning).toEqual({ qty: 1, isFraction: false });
    expect(row('Morning')).toHaveAttribute('data-selected', 'true');
    expect(row('Morning')).toHaveClass('border-primary', 'bg-primary-soft/40');
    expect(row('Morning')).not.toHaveClass('bg-primary');
    expect(qtyButton('Morning')).not.toHaveClass('bg-primary');
    expect(qtyButton('Morning')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('morning-qty')).toHaveClass('text-primary');
    expect(screen.getByTestId('morning-selected')).toHaveTextContent('Active'); // text cue, not colour alone
    expect(screen.getByTestId('morning-accent')).toBeInTheDocument(); // left accent bar
    expect(row('Morning').querySelector('.lucide-check')).toBeNull(); // the decorative checkmark is gone
    // The other rows stay neutral.
    expect(row('Lunch')).not.toHaveAttribute('data-selected');
  });

  it('multiple increments and decrement back to 0 return to neutral', async () => {
    const user = userEvent.setup();
    render(<DosagePanel />);
    const plus = screen.getByRole('button', { name: 'Increase NIGHT dosage' });
    const minus = screen.getByRole('button', { name: 'Decrease NIGHT dosage' });
    await user.click(plus); await user.click(plus); await user.click(plus);
    expect(screen.getByTestId('night-qty')).toHaveTextContent('3');
    await user.click(minus); await user.click(minus); await user.click(minus);
    expect(s().dosage.night).toEqual({ qty: 0, isFraction: false });
    expect(row('Night')).not.toHaveAttribute('data-selected');
    expect(minus).toBeDisabled();
  });

  it('X/Y shows the fraction with the same arithmetic', async () => {
    const user = userEvent.setup();
    s().incrementDosage('lunch');
    render(<><InstructionGrid /><ActionWorkspace /></>);
    await user.click(screen.getByRole('button', { name: /Lunch fraction: none/ }));
    await user.click(screen.getByRole('button', { name: '1/2' }));
    await user.click(screen.getByTestId('numpad-enter'));
    expect(s().dosage.lunch).toEqual({ qty: 1.5, isFraction: true });
    const xy = screen.getByRole('button', { name: /Lunch fraction: ½/ });
    expect(xy).toHaveTextContent('½');
    expect(xy).toHaveClass('border-purple', 'text-purple-strong'); // subtle purple accent on the light-blue selected card
    expect(screen.getByTestId('lunch-qty')).toHaveTextContent('1½');
  });

  it('keyboard: the controls are focusable buttons and Enter/Space work', async () => {
    const user = userEvent.setup();
    render(<DosagePanel />);
    screen.getByRole('button', { name: 'Increase LUNCH dosage' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(s().dosage.lunch.qty).toBe(2);
    await user.tab({ shift: true }); // Decrease LUNCH
    expect(document.activeElement).toHaveAccessibleName('Decrease LUNCH dosage');
    await user.keyboard('{Enter}');
    expect(s().dosage.lunch.qty).toBe(1);
  });

  it('STAT mode and interval mode keep the rows disabled (faded), as before', () => {
    act(() => s().startStat());
    const view = render(<DosagePanel />);
    expect(within(view.container).getByRole('button', { name: 'Increase MORNING dosage' })).toBeDisabled();
    view.unmount();
    act(() => { s().cancelStat(); s().toggleAdditionalInstruction('8H'); s().appendDigit('1'); s().confirmNumberPad(); });
    render(<DosagePanel />);
    expect(screen.getByRole('button', { name: 'Increase MORNING dosage' })).toBeDisabled();
  });
});

describe('larger controls', () => {
  it('dosage X/Y, − and + fill the row at a shared minimum size in every row', () => {
    render(<DosagePanel />);
    for (const name of ['Morning', 'Lunch', 'Night'] as const) {
      expect(row(name)).toHaveClass('lg:grid-cols-2');
      for (const label of [`Increase ${name.toUpperCase()} dosage`, `Decrease ${name.toUpperCase()} dosage`, new RegExp(`${name} fraction`)]) {
        expect(screen.getByRole('button', { name: label })).toHaveClass('w-full', 'h-full', 'min-h-(--dose-ctl)');
      }
    }
  });

  it('has no panel heading', () => {
    render(<DosagePanel />);
    expect(screen.queryByText('Dosage / Quantity')).toBeNull();
    expect(screen.queryByText('Set the quantity for each dose time.')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('+ is solid green, − neutral graphite, in every row', () => {
    render(<DosagePanel />);
    for (const name of ['MORNING', 'LUNCH', 'NIGHT']) {
      expect(screen.getByRole('button', { name: `Increase ${name} dosage` })).toHaveClass('bg-green-solid', 'text-on-tone-solid');
      expect(screen.getByRole('button', { name: `Decrease ${name} dosage` })).toHaveClass('bg-page', 'border-border-strong', 'text-graphite');
    }
  });

  it('a disabled − is grey, not red', () => {
    render(<DosagePanel />);
    expect(screen.getByRole('button', { name: 'Decrease MORNING dosage' })).toHaveClass('disabled:bg-surface-2', 'disabled:text-disabled');
  });

  it('the STAT panel uses the same larger controls and the pressed state is a ring, not a fill', async () => {
    const user = userEvent.setup();
    act(() => s().startStat());
    render(<ActionWorkspace />);
    const plus = screen.getByRole('button', { name: 'Increase STAT quantity' });
    const minus = screen.getByRole('button', { name: 'Decrease STAT quantity' });
    const xy = screen.getByRole('button', { name: 'Enter STAT fraction' });
    for (const control of [plus, minus, xy]) expect(control).toHaveClass('h-(--ws-ctl)');
    expect(minus).toBeDisabled();
    await user.click(plus);
    expect(s().stat?.qty).toBe(1);
    expect(plus).toHaveAttribute('aria-pressed', 'true');
    expect(plus).toHaveClass('ring-2', 'bg-green-solid');
    expect(plus).not.toHaveClass('bg-primary-solid');
    expect(minus).toBeEnabled();
    expect(minus).toHaveClass('bg-page', 'text-graphite'); // neutral, not red
  });
});
