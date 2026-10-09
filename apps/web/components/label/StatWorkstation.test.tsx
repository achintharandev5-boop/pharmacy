import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { InstructionGrid } from './InstructionGrid';
import { useLabelStore } from '../../store/labelStore';

/**
 * The STAT flow on the real workstation grid (finding W6): tapping STAT must open the
 * quantity panel, DONE must open the follow-up panel, and choosing a follow-up must return
 * to the instruction grid with the dose recorded.
 */
describe('STAT dose on the label workstation', () => {
  beforeEach(() => {
    useLabelStore.getState().allClear();
  });

  it('goes from the STAT tile through quantity and follow-up back to the grid', async () => {
    const user = userEvent.setup();
    render(<InstructionGrid />);

    await user.click(screen.getByRole('button', { name: /^STAT$/ }));
    expect(screen.getByText('STAT Dose')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Increase STAT quantity' }));
    await user.click(screen.getByRole('button', { name: 'Increase STAT quantity' }));
    await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    expect(screen.getByText('STAT Follow-Up')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '8H' }));
    expect(screen.queryByText('STAT Follow-Up')).not.toBeInTheDocument();
    expect(useLabelStore.getState().activeControl).toBe('idle');
    expect(useLabelStore.getState().stat).toEqual({ qty: 2, isFraction: false, followUp: '8H' });
    expect(useLabelStore.getState().labels[0].stat).toEqual({ qty: 2, isFraction: false, followUp: '8H' });
  });

  it('Cancel leaves no STAT dose and returns to the grid', async () => {
    const user = userEvent.setup();
    render(<InstructionGrid />);

    await user.click(screen.getByRole('button', { name: /^STAT$/ }));
    await user.click(screen.getByRole('button', { name: 'Increase STAT quantity' }));
    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    expect(screen.queryByText('STAT Dose')).not.toBeInTheDocument();
    expect(useLabelStore.getState().stat).toBeNull();
    expect(useLabelStore.getState().activeControl).toBe('idle');
  });
});

describe('number pad opened from the STAT panel', () => {
  beforeEach(() => {
    useLabelStore.getState().allClear();
  });

  it('returns to the STAT panel after a fraction is confirmed, keeping the whole number', () => {
    const s = useLabelStore.getState();
    s.startStat();
    s.incrementDosage('stat');
    s.openNumberPad('stat_fraction');
    useLabelStore.setState((st) => ({ numberPad: { ...st.numberPad, buffer: '1/2' } }));
    useLabelStore.getState().confirmNumberPad();

    expect(useLabelStore.getState().activeControl).toBe('stat');
    expect(useLabelStore.getState().stat).toMatchObject({ qty: 1.5, isFraction: true });
  });

  it('returns to the STAT panel when the pad is cancelled', () => {
    const s = useLabelStore.getState();
    s.startStat();
    s.openNumberPad('stat_fraction');
    useLabelStore.getState().cancelNumberPad();
    expect(useLabelStore.getState().activeControl).toBe('stat');
  });

  it('still returns to the grid for other targets', () => {
    const s = useLabelStore.getState();
    s.openNumberPad('days');
    useLabelStore.getState().cancelNumberPad();
    expect(useLabelStore.getState().activeControl).toBe('idle');
  });
});
