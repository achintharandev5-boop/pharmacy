import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Audit P1 fixes: locked actions explain why (touch, keyboard, mouse and screen readers), the
 * Dosage Schedule states its lock, and the Expiry card has two separate, keyboard-reachable buttons.
 * Eligibility rules are not under test here; only how their result is presented.
 */
vi.mock('../../app/actions/inventory', () => ({ getDispensingBatches: vi.fn(() => new Promise(() => {})) }));

import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { BottomActionBar } from './BottomActionBar';
import { useLabelStore } from '../../store/labelStore';
import { STAT_LOCK_HINT, PANEL_LOCK_HINT } from './InstructionTile';

const s = () => useLabelStore.getState();
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const description = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');

function Workstation() {
  return <><InstructionGrid /><ActionWorkspace /><BottomActionBar onDone={() => {}} /></>;
}

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe('locked action tiles explain themselves', () => {
  it('a tile locked by a rule is focusable, described, marked with a lock and explains on tap without acting', async () => {
    const user = userEvent.setup();
    act(() => s().toggleAdditionalInstruction('CHEWABLE'));
    render(<Workstation />);
    const locked = screen.getAllByRole('button').find((b) => b.getAttribute('data-state') === 'locked')!;
    expect(locked).toBeDefined();
    expect(locked).not.toHaveAttribute('disabled');
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    const reason = description(locked);
    expect(reason.length).toBeGreaterThan(10);
    expect(locked).toHaveAttribute('title', reason);
    expect(within(locked).getByTestId('lock-glyph')).toBeInTheDocument();

    const before = structuredClone(s().additionalInstructions);
    await user.click(locked);
    expect(s().additionalInstructions).toEqual(before);
    expect(screen.getAllByTestId('lock-notice')[0]).toHaveTextContent(reason);
  });

  it('keyboard: Tab reaches a tile locked by an open panel and Enter explains it', async () => {
    const user = userEvent.setup();
    act(() => s().toggleAdditionalInstruction('5H')); // opens the quantity panel on the right
    render(<Workstation />);
    const reasons = button('Reasons');
    expect(reasons).toBeDisabled();
    expect(description(reasons)).toBe(PANEL_LOCK_HINT);
    reasons.focus();
    expect(reasons).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(s().activeControl).not.toBe('reasons');
    expect(screen.getAllByTestId('lock-notice')[0]).toHaveTextContent(`Reasons is unavailable: ${PANEL_LOCK_HINT}`);
    await user.click(button('Dismiss explanation'));
    expect(screen.getAllByTestId('lock-notice')[0]).toBeEmptyDOMElement();
  });

  it('Administration buttons locked during STAT say so and do not change administration', async () => {
    const user = userEvent.setup();
    act(() => s().startStat());
    render(<Workstation />);
    for (const name of ['Give medication', 'Take medication', 'Before meals', 'After meals']) {
      expect(button(name)).toBeDisabled();
      expect(description(button(name))).toContain(STAT_LOCK_HINT);
    }
    await user.click(button('Take medication'));
    expect(s().additionalInstructions).not.toContain('TAKE');
    expect(screen.getAllByTestId('lock-notice').some((n) => n.textContent?.includes(`TAKE is unavailable: ${STAT_LOCK_HINT}`))).toBe(true);
  });

  it('there is no ENT control to lock (removed from the workstation)', () => {
    render(<Workstation />);
    expect(screen.queryByRole('button', { name: 'ENT' })).toBeNull();
  });
});

describe('Dosage Schedule lock', () => {
  it('names the locking rule next to the heading and describes the locked rows', () => {
    act(() => { s().toggleAdditionalInstruction('EVENING'); s().cancelNumberPad(); });
    render(<Workstation />);
    const reason = screen.getByTestId('dosage-lock-reason');
    expect(reason).toHaveTextContent(/Morning, Lunch and Night are locked: .+/);
    expect(reason.closest('[role="status"]')).not.toBeNull();
    const rows = screen.getByRole('group', { name: 'Morning dose' }).closest('fieldset')!;
    expect(rows).toBeDisabled();
    expect(rows).toHaveAttribute('aria-describedby', 'dosage-lock-reason');
  });

  it('shows nothing while the rows are available', () => {
    render(<Workstation />);
    expect(screen.queryByTestId('dosage-lock-reason')).toBeNull();
  });
});

describe('Expiry Date card', () => {
  it('has two sibling buttons, none nested, both reachable by keyboard', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    const card = button(/Expiry date not added/);
    const chooser = button('Choose the batch for the expiry date');
    expect(card.querySelector('button')).toBeNull();
    expect(card.contains(chooser)).toBe(false);
    expect(chooser).not.toHaveAttribute('tabindex', '-1');
    chooser.focus();
    expect(chooser).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(s().expDateModalVisible).toBe(true);
  });

  it('returns focus to the batch chooser when the dialog is closed with Escape', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    const chooser = button('Choose the batch for the expiry date');
    await user.click(chooser);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(s().expDateModalVisible).toBe(false);
    expect(button('Choose the batch for the expiry date')).toHaveFocus();
  });

  it('is locked and explained during STAT; neither button acts', async () => {
    const user = userEvent.setup();
    act(() => s().startStat());
    render(<Workstation />);
    const card = button(/Expiry date not added/);
    const chooser = button('Choose the batch for the expiry date');
    for (const el of [card, chooser]) {
      expect(el).toBeDisabled();
      expect(description(el)).toBe(STAT_LOCK_HINT);
    }
    await user.click(chooser);
    await user.click(card);
    expect(s().expDateModalVisible).toBe(false);
    expect(button('Done — review and print labels')).toBeDisabled();
  });
});
