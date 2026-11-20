import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { EntPanel } from './EntPanel';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore } from '../../store/labelStore';
import { ENT_PREFIX, defaultEnt, entInstructions, readEnt } from '../../lib/ent';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { analyseLabel, setWordingModeForTests } from '../../lib/instructionEngine';
const state = () => useLabelStore.getState();
beforeEach(() => { state().allClear(); setWordingModeForTests('current'); });
afterEach(() => { cleanup(); setWordingModeForTests(null); });

describe('ENT administration', () => {
  it('opens the compact panel and supports exclusive sites and directions', () => {
    // No workstation button opens ENT any more; the panel is kept for labels that already have ENT data.
    state().setActiveControl('ent');
    render(<><InstructionGrid /><ActionWorkspace /></>);
    expect(screen.queryByRole('button', { name: 'ENT' })).toBeNull();
    expect(screen.getByRole('region', { name: 'ENT administration' })).toBeTruthy();
    for (const site of ['Eye', 'Ear', 'Nose']) {
      fireEvent.click(screen.getByRole('button', { name: site }));
      expect(readEnt(state().additionalInstructions)?.site).toBe(site.toLowerCase());
    }
    fireEvent.click(screen.getByRole('button', { name: 'Eye' }));
    for (const direction of ['LEFT', 'RIGHT', 'BOTH']) {
      fireEvent.click(screen.getByRole('button', { name: direction }));
      expect(screen.getByRole('button', { name: direction }).getAttribute('aria-pressed')).toBe('true');
      expect(readEnt(state().additionalInstructions)?.direction).toBe(direction.toLowerCase());
    }
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('region', { name: 'ENT administration' })).toBeNull();
  });

  it.each([
    ['eye', 'left', 'morning', 2, 'Instill 2 drops into the left eye in the morning.'],
    ['eye', 'both', 'night', 1, 'Instill 1 drop into each eye at night.'],
    ['ear', 'right', 'morning', 3, 'Instill 3 drops into the right ear in the morning.'],
    ['ear', 'both', 'lunch', 2, 'Instill 2 drops into each ear at lunchtime.'],
  ] as const)('prints %s %s %s correctly', (site, direction, time, qty, expected) => {
    state().setEnt({ ...defaultEnt(site), direction });
    for (let i = 0; i < qty; i++) state().incrementDosage(time);
    const built = buildFinalInstruction(state().labels[0]);
    expect(built.instructionString).toContain(expected);
    expect(built.instructionString).not.toContain(ENT_PREFIX);
    const { container } = render(<LabelCard labelItem={built} />);
    expect(container.textContent).toContain(expected);
    cleanup();
    render(<><InstructionGrid /><ActionWorkspace /></>);
    expect(screen.getByLabelText('Selected instructions').textContent).toContain(expected);
    expect(screen.getByTestId('label-text-preview').textContent).toContain(expected);
  });

  it('uses configured spray units and templates for nose and throat', () => {
    for (const site of ['nose', 'throat'] as const) {
      const ent = { ...defaultEnt(site), unit: 'spray', pluralUnit: 'sprays', template: 'Spray {qty} {unit} into {location} {time}.' };
      expect(entInstructions(ent, { morning: { qty: 2 }, night: { qty: 1 } })).toEqual([
        `Spray 2 sprays into the ${site} in the morning.`, `Spray 1 spray into the ${site} at night.`,
      ]);
    }
  });

  it('preserves metadata through saved JSON and label switching, clears only the active label', () => {
    state().setEnt({ ...defaultEnt('ear'), direction: 'right' });
    const saved = JSON.parse(JSON.stringify({ instructions: state().additionalInstructions }));
    expect(readEnt(saved.instructions)).toEqual({ ...defaultEnt('ear'), direction: 'right' });
    state().addLabel();
    expect(readEnt(state().additionalInstructions)).toBeNull();
    state().selectLabel(0);
    expect(readEnt(state().additionalInstructions)?.direction).toBe('right');
    state().incrementDosage('morning');
    state().clearLabelInstructions();
    expect(readEnt(state().additionalInstructions)).toBeNull();
    expect(state().dosage.morning.qty).toBe(1);
  });

  it('validates units and dosage before review', () => {
    state().setEnt(defaultEnt('nose'));
    expect(analyseLabel(state().labels[0]).blocking).toContain('unit');
    state().setEnt(defaultEnt('eye'));
    expect(analyseLabel(state().labels[0]).blocking).toContain('quantity');
    state().incrementDosage('morning');
    expect(analyseLabel(state().labels[0]).blocking).toBeNull();
  });

  it('does not print the oral daily sentence for ENT in spec mode', () => {
    setWordingModeForTests('spec');
    state().setEnt(defaultEnt('eye'));
    for (const time of ['morning', 'lunch', 'night'] as const) state().incrementDosage(time);
    expect(buildFinalInstruction(state().labels[0]).additionalInstructions).toHaveLength(3);
  });
});

describe('ENT panel controls', () => {
  it('reuses frequency selection and the existing quantity pad', () => {
    state().setEnt(defaultEnt('eye'));
    state().setActiveControl('ent');
    render(<EntPanel />);
    fireEvent.click(screen.getByRole('button', { name: '6H' }));
    expect(state().additionalInstructions).toContain('6H');
    expect(state().numberPad.visible).toBe(true);
    expect(state().numberPad.targetControl).toBe('frequency');
    expect(readEnt(state().additionalInstructions)?.site).toBe('eye');
    fireEvent.click(screen.getByRole('button', { name: 'Evening' }));
    expect(state().additionalInstructions).not.toContain('6H');
    expect(state().additionalInstructions).toContain('EVENING');
  });

  it('reuses add and delete label handlers', () => {
    state().setEnt(defaultEnt('ear'));
    render(<EntPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Label' }));
    expect(state().deleteLabelModalVisible).toBe(true);
    expect(state().labels).toHaveLength(1);
    state().closeDeleteLabelModal();
    fireEvent.click(screen.getByRole('button', { name: 'Add Label' }));
    expect(state().labels).toHaveLength(2);
    expect(readEnt(state().labels[0].additionalInstructions)?.site).toBe('ear');
  });

  it('Done preserves configured medication units without dose settings', () => {
    state().setEnt({ ...defaultEnt('nose'), unit: 'spray', pluralUnit: 'sprays' });
    render(<EntPanel />);
    expect(screen.queryByRole('button', { name: 'Dose Settings' })).toBeNull();
    expect(screen.queryByLabelText('Unit')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(state().activeControl).toBe('idle');
    expect(readEnt(state().additionalInstructions)?.unit).toBe('spray');
  });
});


describe('sketch scheduling controls', () => {
  it('selects 4H and reuses the frequency quantity pad', () => {
    state().setEnt(defaultEnt('eye'));
    render(<EntPanel />);
    fireEvent.click(screen.getByRole('button', { name: '4H' }));
    expect(state().additionalInstructions).toContain('4H');
    expect(state().numberPad.targetControl).toBe('frequency');
    state().incrementFrequencyDosage();
    const built = buildFinalInstruction(state().labels[0]);
    expect(built.instructionString).toContain('Instill 1 drop into the left eye every 4 hours.');
    expect(analyseLabel(state().labels[0], 'spec').blocking).toBeNull();
    cleanup();
    const { container } = render(<LabelCard labelItem={built} />);
    expect(container.textContent).toContain('every 4 hours');
    expect(container.textContent).not.toContain('????');
  });

  it('configures custom hours, validates the range, and replaces preset frequencies', () => {
    state().setEnt(defaultEnt('ear'));
    render(<EntPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize Hours' }));
    fireEvent.change(screen.getByLabelText('Custom interval (hours)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Hours' }));
    expect(screen.getByRole('alert').textContent).toContain('1 to 24');
    fireEvent.change(screen.getByLabelText('Custom interval (hours)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Hours' }));
    expect(readEnt(state().additionalInstructions)?.customHours).toBe(3);
    expect(state().additionalInstructions).toContain('CUSTOM');
    state().incrementFrequencyDosage();
    expect(buildFinalInstruction(state().labels[0]).instructionString).toContain('every 3 hours');
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    expect(state().additionalInstructions).not.toContain('CUSTOM');
    expect(state().additionalInstructions).toContain('DAILY');
    expect(buildFinalInstruction(state().labels[0]).instructionString).toContain('daily');
  });

  it('preserves start/end dates through JSON, label switching, and print text', () => {
    state().setEnt(defaultEnt('eye'));
    render(<EntPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Day' }));
    fireEvent.change(screen.getByLabelText('Start Day'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'End Day' }));
    fireEvent.change(screen.getByLabelText('End Day'), { target: { value: '2026-11-04' } });
    state().incrementDosage('morning');
    const label = JSON.parse(JSON.stringify(state().labels[0]));
    expect(buildFinalInstruction(label).instructionString).toContain('Start on 2026-11-01.');
    expect(buildFinalInstruction(label).instructionString).toContain('End on 2026-11-04.');
    state().addLabel(); state().selectLabel(0);
    expect(readEnt(state().additionalInstructions)?.endDay).toBe('2026-11-04');
  });

  it('blocks reversed dates, missing custom hours, missing quantities and mixed schedules', () => {
    state().setEnt({ ...defaultEnt('eye'), startDay: '2026-11-05', endDay: '2026-11-01' });
    expect(analyseLabel(state().labels[0]).blocking).toContain('End Day');
    state().setEnt(defaultEnt('eye'));
    state().toggleAdditionalInstruction('CUSTOM');
    expect(analyseLabel(state().labels[0]).blocking).toContain('custom');
    state().setEnt({ ...defaultEnt('eye'), customHours: 3 });
    expect(analyseLabel(state().labels[0]).blocking).toContain('per dose');
    state().incrementFrequencyDosage();
    expect(analyseLabel(state().labels[0], 'spec').blocking).toBeNull();
    state().incrementDosage('morning');
    expect(analyseLabel(state().labels[0]).blocking).toContain('either');
    state().setEnt(null);
    expect(state().additionalInstructions).not.toContain('CUSTOM');
    expect(state().frequencyDosage.qty).toBe(0);
  });
});


describe('compact ENT panel', () => {
  it('exposes only Eye, Nose and Ear and disables directions for Nose', () => {
    render(<EntPanel />);
    expect(screen.queryByRole('button', { name: 'Throat' })).toBeNull();
    expect(screen.queryByText(/Units & administration/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nose' }));
    for (const direction of ['LEFT', 'BOTH', 'RIGHT']) {
      expect(screen.getByRole('button', { name: direction })).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Ear' }));
    expect(screen.getByRole('button', { name: 'LEFT' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Dose Settings' })).toBeNull();
  });
});


it('lays out the ENT controls in the requested five-column reading order', () => {
  render(<EntPanel />);
  const grid = screen.getByLabelText('ENT administration controls');
  expect(Array.from(grid.children).map(tile => tile.textContent?.trim())).toEqual([
    'LEFT', 'BOTH', 'RIGHT', '5H', '6H',
    'Eye', 'Nose', 'Ear', '4H', 'Daily',
    'Add Label', 'Delete Label', 'Start Day', 'End Day', '8H',
    'Customize Hours', 'Evening',
  ]);
});


it('removes all icons and dose settings from ENT only', () => {
  state().setEnt(defaultEnt('eye'));
  const { container } = render(<EntPanel />);
  expect(container.querySelector('svg')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Dose Settings' })).toBeNull();
  expect(screen.queryByLabelText('Unit')).toBeNull();
  cleanup();
  state().setActiveControl('idle');
  const pharmacy = render(<><InstructionGrid /><ActionWorkspace /></>);
  expect(pharmacy.container.querySelector('svg')).not.toBeNull();
});
