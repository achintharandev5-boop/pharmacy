import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { dosageText } from '../../lib/dosageQuantity';

const state = () => useLabelStore.getState();
beforeEach(() => state().allClear());

describe('Document 5 dosage controls', () => {
  it('previews X/Y live, waits for Enter, restores the pad, and preserves the printed mixed dose', async () => {
    const user = userEvent.setup();
    render(<><ActionWorkspace /><InstructionGrid /></>);
    const plus = screen.getByRole('button', { name: 'Increase MORNING dosage' });
    const minus = screen.getByRole('button', { name: 'Decrease MORNING dosage' });
    expect(minus).toBeDisabled();
    await user.click(minus);
    expect(state().dosage.morning.qty).toBe(0);
    await user.click(plus);
    await user.click(plus);
    await user.click(minus);
    expect(screen.getByTestId('morning-qty')).toHaveTextContent('1');
    expect(minus).toHaveAttribute('aria-pressed', 'true'); expect(minus).toHaveClass('ring-2');
    await user.click(screen.getByRole('button', { name: /Morning fraction: none/ }));
    await user.click(screen.getByRole('button', { name: '1/2' }));
    expect(screen.getByRole('button', { name: '1/2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('morning-qty')).toHaveTextContent('1½');
    expect(screen.getByRole('button', { name: /Morning fraction: 1\/2/ })).toHaveTextContent('1/2');
    expect(state().dosage.morning.qty).toBe(1);
    await user.click(screen.getByTestId('numpad-enter'));
    expect(screen.queryByTestId('numpad-enter')).not.toBeInTheDocument();
    expect(state().activeControl).toBe('idle');
    expect(screen.getByTestId('label-text-preview')).toHaveTextContent('උදේට 1½');
    expect(screen.getByLabelText('Selected instructions')).toHaveTextContent('MORNING: 1½');
    await user.click(plus);
    expect(plus).toHaveAttribute('aria-pressed', 'true'); expect(plus).toHaveClass('ring-2');
    expect(state().dosage.morning.qty).toBe(2.5);
    const built = buildFinalInstruction(state().labels[0]);
    expect(built.dosage?.morning).toBe('2½');
    const printed = render(<LabelCard labelItem={built} />);
    expect(printed.container.textContent).toContain('2½');
    await user.click(minus);
    await user.click(minus);
    expect(state().dosage.morning.qty).toBe(0.5);
    await user.click(minus);
    expect(state().dosage.morning.qty).toBe(0);
    expect(minus).toBeDisabled();
  });

  it('typed thirds survive repeated whole-unit changes and print as a fraction', () => {
    state().openNumberPad('night_fraction');
    state().appendDigit('1/3');
    state().confirmNumberPad();
    for (let i = 0; i < 30; i++) state().incrementDosage('night');
    for (let i = 0; i < 29; i++) state().decrementDosage('night');
    expect(dosageText(state().dosage.night.qty, true)).toBe('1 1/3');
    const built = buildFinalInstruction(state().labels[0]);
    expect(built.dosage?.night).toBe('1 1/3');
    expect(render(<LabelCard labelItem={built} />).container.textContent).toContain('1 1/3');
  });

  it.each(['stat', 'frequency'] as const)('%s preserves mixed quantities and clamps subtraction at zero', (target) => {
    if (target === 'stat') state().startStat();
    state().openNumberPad(`${target}_fraction`);
    state().appendDigit('3/4');
    state().confirmNumberPad();
    const increment = () => target === 'stat' ? state().incrementDosage('stat') : state().incrementFrequencyDosage();
    const decrement = () => target === 'stat' ? state().decrementDosage('stat') : state().decrementFrequencyDosage();
    const quantity = () => target === 'stat' ? state().stat?.qty : state().frequencyDosage.qty;
    increment(); increment(); decrement();
    expect(quantity()).toBe(1.75);
    decrement();
    expect(quantity()).toBe(0.75);
    decrement(); decrement();
    expect(quantity()).toBe(0);
  });

  it('Back cancels a pending fraction without changing the confirmed quantity', async () => {
    const user = userEvent.setup();
    state().incrementDosage('lunch');
    render(<><ActionWorkspace /><InstructionGrid /></>);
    await user.click(screen.getByRole('button', { name: /Lunch fraction: none/ }));
    await user.click(screen.getByRole('button', { name: '3/4' }));
    await user.click(screen.getByRole('button', { name: 'BACK' }));
    expect(state().dosage.lunch).toEqual({ qty: 1, isFraction: false });
    expect(screen.getByTestId('lunch-qty')).toHaveTextContent('1');
  });
});
