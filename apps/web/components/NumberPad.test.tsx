import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { NumberPad } from './NumberPad';
import { useLabelStore } from '../store/labelStore';
import React from 'react';

// Wrapper component to observe the store's buffer and simulate preview panel
function TestWrapper() {
  const { numberPad, openNumberPad } = useLabelStore();
  
  return (
    <div>
      <div data-testid="preview-panel">BUFFER:{numberPad.buffer}</div>
      <button onClick={() => openNumberPad('morning')}>Open Pad</button>
      {numberPad.visible && <NumberPad />}
    </div>
  );
}

describe('NumberPad Component', () => {
  beforeEach(() => {
    useLabelStore.setState({
      activeControl: 'idle',
      numberPad: { visible: false, buffer: '', targetControl: null },
      dosage: {
        morning: { qty: 0, isFraction: false },
        lunch: { qty: 0, isFraction: false },
        night: { qty: 0, isFraction: false },
      }
    });
  });

  it('renders correctly and shows target control', () => {
    useLabelStore.setState({ numberPad: { visible: true, buffer: '', targetControl: 'morning' } });
    render(<NumberPad />);
    // Header shows "Entering" above the target name.
    expect(screen.getByText('Entering')).toBeInTheDocument();
    expect(screen.getByText('MORNING')).toBeInTheDocument();
  });

  it('digit entry updates the preview live', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    
    await user.click(screen.getByText('Open Pad'));
    
    await user.click(screen.getByText('1'));
    await user.click(screen.getByText('2'));
    await user.click(screen.getByText('3'));

    expect(screen.getByTestId('preview-panel').textContent).toBe('BUFFER:123');
  });

  it('produces a fraction string and allows only one slash', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    
    await user.click(screen.getByText('Open Pad'));
    
    await user.click(screen.getByText('1'));
    await user.click(screen.getByText('/'));
    await user.click(screen.getByText('2'));
    await user.click(screen.getByText('/')); // Second slash should be ignored

    expect(screen.getByTestId('preview-panel').textContent).toBe('BUFFER:1/2');
  });

  it('Backspace removes last character, AC clears everything', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    
    await user.click(screen.getByText('Open Pad'));
    
    // Type 456
    await user.click(screen.getByText('4'));
    await user.click(screen.getByText('5'));
    await user.click(screen.getByText('6'));
    expect(screen.getByTestId('preview-panel').textContent).toBe('BUFFER:456');

    // Backspace (icon key, found by its accessible name) removes 6
    await user.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(screen.getByTestId('preview-panel').textContent).toBe('BUFFER:45');

    // AC clears
    await user.click(screen.getByText('AC'));
    expect(screen.getByTestId('preview-panel').textContent).toBe('BUFFER:');
  });

  it('Enter commits the value to store', async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    
    await user.click(screen.getByText('Open Pad'));
    await user.click(screen.getByText('1'));
    
    await user.click(screen.getByTestId('numpad-enter'));

    // Should close pad
    expect(screen.queryByTestId('numpad-enter')).not.toBeInTheDocument();
    
    // Check if store committed to morning qty
    expect(useLabelStore.getState().dosage.morning.qty).toBe(1);
  });

  it('Back reverts without committing', async () => {
    // Initial state = 5
    useLabelStore.setState({ dosage: { ...useLabelStore.getState().dosage, morning: { qty: 5, isFraction: false } } });
    
    const user = userEvent.setup();
    render(<TestWrapper />);
    
    await user.click(screen.getByText('Open Pad'));
    await user.click(screen.getByText('9')); // Buffer is now 9
    
    await user.click(screen.getByText('BACK'));

    // Should close pad
    expect(screen.queryByTestId('numpad-enter')).not.toBeInTheDocument();
    
    // Morning should still be 5
    expect(useLabelStore.getState().dosage.morning.qty).toBe(5);
  });
});
