import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReasonsPanel } from '../../app/label/ReasonsPanel';
import { useLabelStore } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { reasonsProblem, reasonStateProblem, reasonSelectionRefusal } from '../../lib/reasons';
import { LabelCard } from '../PrintableLabel';

// Synthetic catalogue fixtures, not PDF-approved clinical reason statements.
const catalogue = ['පරීක්ෂණය එක', 'පරීක්ෂණය දෙක'];
const state = () => useLabelStore.getState();
const label = () => state().labels[state().activeLabelIndex];
beforeEach(() => { state().allClear(); state().setReasonCatalogue(catalogue); });

describe('Reasons: PDF pp39–41', () => {
  it.each(['DAILY', 'WEEKLY', 'EOD', 'STAT', '8H', '6H', '5H', 'BD', 'TDS', 'EVENING', 'FOUR TIMES DAILY', 'NAME OF DAYS', 'TILL TO THE DAY', 'TAKE', 'GIVE', 'BEFORE', 'AFTER', 'WITH FOOD', 'EMPTY STOMACH', 'CHEWABLE', 'DISSOLVE AND DRINK', 'KEEP IN MOUTH', 'ENT'])('adds no reason-specific restriction to completed %s', code => {
    expect(reasonSelectionRefusal({ reasons: catalogue, reasonsConfirmed: true }, code)).toBeNull();
  });
  it('is optional and refuses unknown values and selection outside the panel', () => {
    expect(reasonsProblem(label(), null)).toBeNull();
    state().toggleReason(catalogue[0]); expect(label().reasons).toEqual([]);
    state().openReasonsPanel(); state().toggleReason('unknown'); expect(label().reasons).toEqual([]);
    state().setReasons([catalogue[0], catalogue[0]]); expect(label().reasons).toEqual([]);
    state().closeReasonsPanel(); expect(label().reasonsEditPending).toBe(true);
  });

  it('toggles multiple selections in blue and confirms with Enter', () => {
    state().openReasonsPanel(); render(<ReasonsPanel />);
    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
    for (const text of catalogue) fireEvent.click(screen.getByRole('button', { name: text }));
    expect(screen.getByRole('button', { name: catalogue[0] })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: catalogue[0] })).toHaveClass('bg-primary-soft', 'border-primary');
    fireEvent.click(screen.getByRole('button', { name: catalogue[0] }));
    expect(label().reasons).toEqual([catalogue[1]]);
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(reasonsProblem(label(), catalogue)).toBeNull(); expect(state().activeControl).toBe('idle');
  });

  it('locks direct Digital/USB/SAM changes until confirmation and restores edits on Back', () => {
    state().openReasonsPanel(); state().toggleReason(catalogue[0]);
    state().incrementDosage('morning'); state().toggleAdditionalInstruction('TAKE');
    expect(label().dosage.morning.qty).toBe(0); expect(label().additionalInstructions).not.toContain('TAKE');
    state().closeReasonsPanel(); state().incrementDosage('morning');
    expect(label().dosage.morning.qty).toBe(1);
    state().openReasonsPanel(); state().toggleReason(catalogue[1]); state().cancelReasonsPanel();
    expect(label().reasons).toEqual([catalogue[0]]); expect(label().reasonsConfirmed).toBe(true);
    state().clearReasons(); expect(reasonsProblem(label(), catalogue)).toBeNull();
    expect(label().dosage.morning.qty).toBe(1);
  });

  it('preserves exact statement text once in saved output and the designated print area', () => {
    state().openReasonsPanel(); catalogue.forEach(text => state().toggleReason(text)); state().closeReasonsPanel();
    const built = buildFinalInstruction(label());
    expect(built.finalInstructionText).toBe(catalogue.join('\n'));
    const view = render(<LabelCard labelItem={built} />);
    expect(Array.from(view.container.querySelectorAll('[data-reason-line]'), node => node.textContent)).toEqual(catalogue);
    act(() => state().clearReasons());
    view.rerender(<LabelCard labelItem={buildFinalInstruction(label())} />);
    expect(view.container.querySelector('[data-label-reasons]')).toBeNull();
  });

  it('blocks unconfirmed, unavailable, duplicate and malformed restored values', () => {
    expect(reasonStateProblem({ reasons: [catalogue[0]] })).toContain('confirm');
    expect(reasonsProblem({ reasons: ['unknown'], reasonsConfirmed: true }, catalogue)).toContain('unavailable');
    expect(reasonStateProblem({ reasons: [catalogue[0], catalogue[0]], reasonsConfirmed: true })).toContain('duplicate');
    expect(reasonStateProblem({ reasons: [null] as unknown as string[] })).toContain('invalid');
    expect(reasonStateProblem({ reasons: 'bad' as unknown as string[] })).toContain('invalid');
    const restored = JSON.parse(JSON.stringify({ ...label(), reasons: catalogue, reasonsConfirmed: true }));
    expect(reasonsProblem(restored, catalogue)).toBeNull();
    expect(reasonsProblem(restored, null)).toContain('catalogue');
  });
});
