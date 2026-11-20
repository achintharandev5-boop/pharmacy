import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLabelStore } from '../store/labelStore';
import React from 'react';

// Wrapper for testing STAT flows
function StatTestWrapper() {
  const { 
    activeControl, 
    startStat, 
    cancelStat, 
    doneStat, 
    incrementDosage, 
    stat,
    setStatFollowUp
  } = useLabelStore();

  const isStatActive = activeControl === 'stat';

  return (
    <div>
      <div data-testid="active-control">{activeControl}</div>
      <div data-testid="stat-qty">{stat?.qty || 0}</div>
      <div data-testid="stat-followup">{stat?.followUp || 'none'}</div>

      <button onClick={startStat}>Start STAT</button>
      
      {activeControl === 'stat' && (
        <>
          <button onClick={() => incrementDosage('stat')}>Stat Plus</button>
          <button onClick={doneStat}>Done STAT</button>
          <button onClick={cancelStat}>Back STAT</button>
        </>
      )}

      {activeControl === 'idle' && stat && (
        <>
          <button onClick={() => setStatFollowUp('8H')}>FollowUp 8H</button>
          {/* Method 1: Tapping Morning directly */}
          <button onClick={() => setStatFollowUp('MORNING')}>Morning Row</button>
        </>
      )}

      <button disabled={isStatActive} data-testid="outside-btn">Outside Button</button>
    </div>
  );
}

describe('STAT Flow Logic', () => {
  beforeEach(() => {
    // Reset the labels too: STAT is stored on the active label, and re-opening STAT edits it.
    useLabelStore.getState().allClear();
  });

  it('enters STAT dose end-to-end', async () => {
    const user = userEvent.setup();
    render(<StatTestWrapper />);
    
    // 1. Enter STAT
    await user.click(screen.getByText('Start STAT'));
    expect(screen.getByTestId('active-control').textContent).toBe('stat');
    
    // 2. Set qty
    await user.click(screen.getByText('Stat Plus'));
    expect(screen.getByTestId('stat-qty').textContent).toBe('1');
    
    // 3. DONE
    await user.click(screen.getByText('Done STAT'));
    expect(screen.getByTestId('active-control').textContent).toBe('idle');
    
    // 4. Pick followUp
    await user.click(screen.getByText('FollowUp 8H'));
    
    // 5. The follow-up has its own quantity pad.
    expect(screen.getByTestId('active-control').textContent).toBe('frequency');
    expect(useLabelStore.getState().stat?.qty).toBe(1);
    expect(useLabelStore.getState().stat?.followUp).toBe('8H');
  });

  it('BACK abandons STAT entry without mutating store.stat permanently', async () => {
    const user = userEvent.setup();
    render(<StatTestWrapper />);
    
    // 1. Enter STAT
    await user.click(screen.getByText('Start STAT'));
    
    // 2. Set qty
    await user.click(screen.getByText('Stat Plus'));
    
    // 3. BACK
    await user.click(screen.getByText('Back STAT'));
    
    // Verify cancelled
    expect(screen.getByTestId('active-control').textContent).toBe('idle');
    expect(useLabelStore.getState().stat).toBeNull();
  });

  it('outside controls are disabled only while activeControl === "stat"', async () => {
    const user = userEvent.setup();
    render(<StatTestWrapper />);
    
    const outsideBtn = screen.getByTestId('outside-btn');
    
    // Idle -> enabled
    expect(outsideBtn).not.toBeDisabled();
    
    // Stat -> disabled
    await user.click(screen.getByText('Start STAT'));
    expect(outsideBtn).toBeDisabled();
    
    // Stat FollowUp -> enabled
    await user.click(screen.getByText('Stat Plus'));
    await user.click(screen.getByText('Done STAT'));
    expect(outsideBtn).not.toBeDisabled();
  });

  it('allows setting followup via Method 1 (tapping dosage row)', async () => {
    const user = userEvent.setup();
    render(<StatTestWrapper />);
    
    await user.click(screen.getByText('Start STAT'));
    // A STAT dose needs a quantity before DONE moves on (a 0 dose would print nothing).
    await user.click(screen.getByText('Done STAT'));
    expect(screen.getByTestId('active-control').textContent).toBe('stat');
    await user.click(screen.getByText('Stat Plus'));
    await user.click(screen.getByText('Done STAT'));

    // Pick using Morning Row
    await user.click(screen.getByText('Morning Row'));
    
    expect(useLabelStore.getState().stat?.followUp).toBe('MORNING');
    expect(screen.getByTestId('active-control').textContent).toBe('morning');
  });
});
