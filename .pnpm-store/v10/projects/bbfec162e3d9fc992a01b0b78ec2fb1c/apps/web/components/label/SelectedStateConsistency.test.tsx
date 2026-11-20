import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Audit P2: selection is never shown by colour alone. A selected grid tile fills with its own tone
 * (multi-colour button system); its Selected Instructions chip uses the same tone's tint.
 */
vi.mock('../../app/actions/inventory', () => ({ getDispensingBatches: vi.fn(() => new Promise(() => {})) }));

import { InstructionGrid } from './InstructionGrid';
import { LabelActions } from './LabelActions';
import { useLabelStore } from '../../store/labelStore';
import { CATEGORY_STYLE, instructionCategory } from './instructionCategories';

const s = () => useLabelStore.getState();
const chip = (code: string) => screen.getByRole('button', { name: new RegExp(`^Remove ${code}`) }).parentElement!;
const classes = (value: string) => value.split(' ');

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe('tile and chip agree', () => {
  it.each([
    ['5H', '5H'], ['6H', '6H'], ['8H', '8H'], ['EVENING', 'Evening'], ['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['EOD', 'EOD'],
    ['WITH FOOD', 'With Food'], ['EMPTY STOMACH', 'Empty Stomach'], ['CHEWABLE', 'Chewable'],
    ['DISSOLVE AND DRINK', 'Dissolve and Drink'], ['KEEP IN MOUTH', 'Keep in Mouth'],
  ])('%s', (code, label) => {
    act(() => { s().toggleAdditionalInstruction(code); s().cancelNumberPad(); });
    render(<InstructionGrid />);
    const style = CATEGORY_STYLE[instructionCategory(code)];
    const tile = screen.getByRole('button', { name: new RegExp(`^${label}`) });
    expect(tile).toHaveAttribute('data-selected', 'true');
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(within(tile).getByTestId('selected-badge')).toHaveClass(...classes(style.onSolid));
    expect(tile).toHaveClass('border-2', ...classes(style.solid));
    expect(chip(code)).toHaveClass(...classes(style.chip));
  });

  it('Reasons is solid teal when selected; its reason chip uses the same tone', () => {
    act(() => { s().setReasonCatalogue(['කැස්සට']); s().openReasonsPanel(); s().toggleReason('කැස්සට'); s().closeReasonsPanel(); });
    render(<InstructionGrid />);
    expect(screen.getByRole('button', { name: /^Reasons/ })).toHaveClass(...classes(CATEGORY_STYLE.teal.solid));
    expect(chip('කැස්සට')).toHaveClass(...classes(CATEGORY_STYLE.teal.chip));
  });

  it('tones follow meaning', () => {
    const tones = {
      blue: ['5H', '6H', '8H', 'DISSOLVE AND DRINK'], teal: ['REASONS', 'WEEKLY', 'CHEWABLE', 'KEEP IN MOUTH', 'reason_x'],
      green: ['DAILY', 'WITH FOOD'], purple: ['DAYS', 'NAME OF DAYS', 'EOD', 'EMPTY STOMACH'],
      amber: ['EVENING', 'ADD EXP DATE', 'exp'], coral: ['STAT'], neutral: ['REMOVE ADDRESS'],
    };
    for (const [tone, codes] of Object.entries(tones)) for (const code of codes) expect(instructionCategory(code), code).toBe(tone);
  });

  it('Add Label is solid green and Delete Label outlined coral', () => {
    render(<InstructionGrid />);
    expect(screen.getByRole('button', { name: 'Add Label' })).toHaveClass('bg-green-solid', 'text-on-tone-solid');
    expect(screen.getByRole('button', { name: 'Delete Label' })).toHaveClass('bg-page', 'border-coral', 'text-coral-strong');
  });

  it('an unselected tile has no badge and no pressed state', () => {
    render(<InstructionGrid />);
    const tile = screen.getByRole('button', { name: /^Weekly/ });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(within(tile).queryByTestId('selected-badge')).toBeNull();
  });
});

describe('Administration buttons', () => {
  it('are neutral when idle and use the shared selected treatment', () => {
    render(<LabelActions />);
    for (const name of ['Give medication', 'Take medication', 'Before meals', 'After meals']) {
      expect(screen.getByRole('button', { name })).toHaveClass('bg-page', 'border-border-strong', 'text-fg');
    }
    act(() => s().toggleAdditionalInstruction('TAKE'));
    const take = screen.getByRole('button', { name: 'Take medication' });
    expect(take).toHaveAttribute('aria-pressed', 'true');
    expect(take).toHaveClass('bg-primary-soft', 'border-primary');
    expect(within(take).getByTestId('selected-badge')).toBeInTheDocument();
  });

  it('carry a subtle icon accent each, never a coloured fill', () => {
    render(<LabelActions />);
    const accents = { 'Give medication': 'text-teal', 'Take medication': 'text-primary', 'Before meals': 'text-amber', 'After meals': 'text-purple' };
    for (const [name, accent] of Object.entries(accents)) {
      const button = screen.getByRole('button', { name });
      expect(button.querySelector('svg')).toHaveClass(accent);
      expect(button.className).not.toMatch(/bg-(teal|amber|purple)/);
    }
  });
});
