import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { quantityEntry } from './ActionQuantityPanel';
import { useLabelStore, createDefaultLabel } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';

/**
 * Every action that asks for a quantity uses the compact STAT-style editor on the right (no large
 * number pad). The value is applied through the number pad's existing validation, so the label is
 * identical to what the pad produced.
 */
const s = () => useLabelStore.getState();
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const panel = () => within(screen.getByRole('region', { name: 'Action workspace' }));
const plus = () => fireEvent.click(panel().getByRole('button', { name: /^Increase .* quantity$/ }));
const minus = () => fireEvent.click(panel().getByRole('button', { name: /^Decrease .* quantity$/ }));
const xy = () => fireEvent.click(panel().getByRole('button', { name: /^Enter .* fraction$/ }));
const done = () => fireEvent.click(panel().getByRole('button', { name: /Done \(Next\)/ }));
const cancel = () => fireEvent.click(panel().getByRole('button', { name: 'Cancel' }));
const shown = () => screen.getByTestId('action-qty').textContent;

function Workstation() {
  return <><InstructionGrid /><ActionWorkspace /></>;
}

/** The label the old number-pad path produced for `entry` (store API unchanged). */
function viaPad(tile: string, entry: string) {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
  s().toggleAdditionalInstruction(tile);
  s().appendDigit(entry);
  s().confirmNumberPad();
  s().toggleAdditionalInstruction('TAKE');
  s().toggleAdditionalInstruction('AFTER');
  return { freq: { ...s().labels[0].frequencyDosage }, weekly: { ...s().labels[0].weeklyDosage }, text: buildFinalInstruction(s().labels[0]).finalInstructionText };
}

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
});

describe.each([
  ['5H', '5H', '5H'],
  ['6H', '6H', '6H'],
  ['8H', '8H', '8H'],
  ['Daily', 'DAILY', 'Daily'],
  ['Evening', 'EVENING', 'Evening'],
  ['Weekly', 'WEEKLY', 'Weekly'],
])('%s quantity', (tile, code, title) => {
  const value = () => (code === 'WEEKLY' ? s().weeklyDosage : s().frequencyDosage);

  it('opens the compact editor on the right, not the number pad; the grid stays', () => {
    render(<Workstation />);
    fireEvent.click(button(new RegExp(`^${tile}`)));
    expect(panel().getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByTestId('numpad-enter')).toBeNull();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(button(/^Reasons/)).toBeInTheDocument();
    expect(shown()).toBe('0');
    expect(panel().getByRole('button', { name: /Done \(Next\)/ })).toBeDisabled();
  });

  it('+, −, X/Y (quick, typed, None) edit a draft; Cancel applies nothing', () => {
    render(<Workstation />);
    fireEvent.click(button(new RegExp(`^${tile}`)));
    plus(); plus(); expect(shown()).toBe('2');
    minus(); expect(shown()).toBe('1');
    xy(); fireEvent.click(panel().getByRole('button', { name: '1/2' })); expect(shown()).toBe('1½');
    xy(); fireEvent.change(panel().getByLabelText('X'), { target: { value: '1' } }); fireEvent.change(panel().getByLabelText('Y'), { target: { value: '3' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply X/Y' })); expect(shown()).toBe('1 1/3');
    xy(); fireEvent.change(panel().getByLabelText('X'), { target: { value: '3' } }); fireEvent.change(panel().getByLabelText('Y'), { target: { value: '2' } });
    fireEvent.click(panel().getByRole('button', { name: 'Apply X/Y' }));
    expect(panel().getByRole('alert')).toHaveTextContent('X/Y must be a fraction smaller than 1');
    expect(shown()).toBe('1 1/3');
    fireEvent.click(panel().getByRole('button', { name: 'None' })); expect(shown()).toBe('1');
    // Nothing reaches the label until Done (Next).
    expect(value()?.qty ?? 0).toBe(0);
    cancel();
    expect(screen.queryByRole('region', { name: 'Action workspace' })).toBeNull();
    expect(value()?.qty ?? 0).toBe(0);
    expect(s().additionalInstructions).toEqual([code]);
  });

  it.each([['1', ['plus']], ['2', ['plus', 'plus']], ['1/2', ['half']], ['1 1/2', ['plus', 'half']], ['1/3', ['third']]])(
    'Done (Next) with %s gives exactly the label the number pad gave', (entry, steps) => {
      const expected = viaPad(code, entry);
      s().allClear();
      s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Karal' });
      render(<Workstation />);
      fireEvent.click(button(new RegExp(`^${tile}`)));
      for (const step of steps) {
        if (step === 'plus') plus();
        else { xy(); if (step === 'half') fireEvent.click(panel().getByRole('button', { name: '1/2' })); else { fireEvent.change(panel().getByLabelText('X'), { target: { value: '1' } }); fireEvent.change(panel().getByLabelText('Y'), { target: { value: '3' } }); fireEvent.click(panel().getByRole('button', { name: 'Apply X/Y' })); } }
      }
      done();
      expect(screen.queryByRole('region', { name: 'Action workspace' })).toBeNull();
      act(() => { s().toggleAdditionalInstruction('TAKE'); s().toggleAdditionalInstruction('AFTER'); });
      expect(s().labels[0].frequencyDosage).toEqual(expected.freq);
      expect(s().labels[0].weeklyDosage).toEqual(expected.weekly);
      expect(buildFinalInstruction(s().labels[0]).finalInstructionText).toBe(expected.text);
    });
});

describe('STAT uses the same compact editor', () => {
  it('X/Y applies through the STAT fraction rule without the number pad', () => {
    render(<Workstation />);
    fireEvent.click(button(/^STAT/));
    expect(screen.getByRole('heading', { name: 'STAT Dose' })).toBeInTheDocument();
    fireEvent.click(button('Increase STAT quantity'));
    fireEvent.click(button('Enter STAT fraction'));
    fireEvent.click(button('1/2'));
    expect(screen.queryByTestId('numpad-enter')).toBeNull();
    expect(screen.getByTestId('stat-qty')).toHaveTextContent('1½');
    expect(s().stat).toMatchObject({ qty: 1.5, isFraction: true });
    expect(s().activeControl).toBe('stat');
    fireEvent.click(button('Enter STAT fraction'));
    fireEvent.click(button('None'));
    expect(s().stat).toMatchObject({ qty: 1, isFraction: false });
  });

  it('STAT and interval quantities stay separate', () => {
    render(<Workstation />);
    fireEvent.click(button(/^STAT/));
    fireEvent.click(button('Increase STAT quantity')); fireEvent.click(button('Increase STAT quantity'));
    fireEvent.click(button(/Done \(Next\)/));
    fireEvent.click(button(/^8H/));
    plus(); done();
    expect(s().stat).toMatchObject({ qty: 2, followUp: '8H' });
    expect(s().frequencyDosage).toEqual({ qty: 1, isFraction: false });
  });
});

describe('ENT custom hours and label isolation', () => {
  it('ENT custom hours asks for its quantity in the compact editor', () => {
    const label = createDefaultLabel();
    label.additionalInstructions = ['CUSTOM'];
    act(() => { s().restoreLabel(label); s().openNumberPad('frequency'); });
    render(<Workstation />);
    expect(panel().getByRole('heading', { name: 'ENT custom hours' })).toBeInTheDocument();
    plus(); done();
    expect(s().frequencyDosage).toEqual({ qty: 1, isFraction: false });
  });

  it('switching labels closes the editor without applying the draft; each label keeps its own value', () => {
    s().addLabel();
    s().setProduct({ id: 'medicine-2', name: 'Medicine 2', product_type: 'Pethi' });
    s().selectLabel(0);
    render(<Workstation />);
    fireEvent.click(button(/^5H/));
    plus(); plus();
    act(() => s().selectLabel(1));
    expect(screen.queryByRole('region', { name: 'Action workspace' })).toBeNull();
    expect(s().labels[0].frequencyDosage.qty).toBe(0);
    expect(s().labels[1].frequencyDosage.qty).toBe(0);
    expect(s().labels[1].additionalInstructions).toEqual([]);
  });

  it('writes quantities in the number pad notation exactly', () => {
    expect(quantityEntry({ qty: 2, isFraction: false })).toBe('2');
    expect(quantityEntry({ qty: 0.5, isFraction: true })).toBe('1/2');
    expect(quantityEntry({ qty: 1.5, isFraction: true })).toBe('1 1/2');
    expect(quantityEntry({ qty: 1 + 1 / 3, isFraction: true })).toBe('1 1/3');
    expect(quantityEntry({ qty: 2, isFraction: true })).toBe('2');
  });
});
