import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLabelStore } from '../store/labelStore';
import React from 'react';

// Wrapper to test the dosage logic (simulating the page.tsx UI)
function DosageTestWrapper({ time }: { time: 'morning' | 'lunch' | 'night' }) {
  const dosage = useLabelStore(state => state.dosage);
  const incrementDosage = useLabelStore(state => state.incrementDosage);
  const decrementDosage = useLabelStore(state => state.decrementDosage);
  
  const currentQty = dosage[time].qty;
  const currentIsFrac = dosage[time].isFraction;
  
  let displayQty = currentQty.toString();
  if (currentIsFrac) {
    const whole = Math.floor(currentQty);
    const frac = currentQty - whole;
    let fracStr = '';
    if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
    else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
    else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
    
    if (whole === 0) displayQty = fracStr || '0';
    else displayQty = `${whole}${fracStr}`;
  }

  return (
    <div>
      <div data-testid="qty-display">{displayQty || '0'}</div>
      <button onClick={() => incrementDosage(time)}>+</button>
      <button onClick={() => decrementDosage(time)}>-</button>
      {/* Simulate confirming a fraction from the numpad */}
      <button onClick={() => {
        useLabelStore.setState(state => {
          const currentWhole = Math.floor(state.dosage[time].qty);
          return {
            dosage: {
              ...state.dosage,
              [time]: { qty: currentWhole + 0.5, isFraction: true }
            }
          };
        });
      }}>XY(1/2)</button>
    </div>
  );
}

describe('Dosage Row Logic & Constraints', () => {
  beforeEach(() => {
    useLabelStore.setState({
      dosage: {
        morning: { qty: 0, isFraction: false },
        lunch: { qty: 0, isFraction: false },
        night: { qty: 0, isFraction: false },
      }
    });
  });

  it('Plus-only increments by 1', async () => {
    const user = userEvent.setup();
    render(<DosageTestWrapper time="morning" />);
    
    await user.click(screen.getByText('+'));
    expect(screen.getByTestId('qty-display').textContent).toBe('1');
    
    await user.click(screen.getByText('+'));
    expect(screen.getByTestId('qty-display').textContent).toBe('2');
  });

  it('Minus floors at 0', async () => {
    const user = userEvent.setup();
    render(<DosageTestWrapper time="morning" />);
    
    // Attempt minus from 0
    await user.click(screen.getByText('-'));
    expect(screen.getByTestId('qty-display').textContent).toBe('0');
    
    // Plus then minus
    await user.click(screen.getByText('+'));
    await user.click(screen.getByText('-'));
    expect(screen.getByTestId('qty-display').textContent).toBe('0');
  });

  it('X/Y-only applies fraction', async () => {
    const user = userEvent.setup();
    render(<DosageTestWrapper time="morning" />);
    
    await user.click(screen.getByText('XY(1/2)'));
    expect(screen.getByTestId('qty-display').textContent).toBe('½');
  });

  it('valid Plus -> X/Y combination produces 1½', async () => {
    const user = userEvent.setup();
    render(<DosageTestWrapper time="morning" />);
    
    await user.click(screen.getByText('+')); // 1
    await user.click(screen.getByText('XY(1/2)')); // + 1/2
    
    expect(screen.getByTestId('qty-display').textContent).toBe('1½');
  });

  it('invalid X/Y -> Plus ordering resets the fraction', async () => {
    const user = userEvent.setup();
    render(<DosageTestWrapper time="morning" />);
    
    await user.click(screen.getByText('XY(1/2)')); // Gives ½
    expect(screen.getByTestId('qty-display').textContent).toBe('½');
    
    // SRS Rule 20: X/Y -> Plus must NOT be allowed to produce a combined dosage.
    // Our implementation resets the fraction to enforce the Plus -> X/Y sequence.
    await user.click(screen.getByText('+')); 
    
    // Instead of 1½, it should discard the fraction and increment the whole number floor (0) -> 1
    expect(screen.getByTestId('qty-display').textContent).toBe('1');
  });
});
