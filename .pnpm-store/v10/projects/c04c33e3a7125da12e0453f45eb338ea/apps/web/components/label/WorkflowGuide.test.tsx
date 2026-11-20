import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { BottomActionBar } from './BottomActionBar';
import { useLabelStore } from '../../store/labelStore';
import { setWordingModeForTests } from '../../lib/instructionEngine';

/**
 * Guided workflows from the handwritten specifications, through the real buttons.
 * "spec" tests switch the wording on; "both modes" tests hold in either.
 */
function Workstation() {
  return (
    <>
      <InstructionGrid />
      <ActionWorkspace />
      <BottomActionBar onDone={() => {}} />
    </>
  );
}

const s = () => useLabelStore.getState();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const preview = () => screen.queryByTestId('label-text-preview')?.textContent ?? '';
const status = () => screen.getByTestId('admin-status');
const names: Record<string, string> = { TAKE: 'Take medication', GIVE: 'Give medication', BEFORE: 'Before meals', AFTER: 'After meals' };

beforeEach(() => {
  s().allClear();
  s().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Pethi' });
});
afterEach(() => setWordingModeForTests(null));

describe('guidance (both wordings)', () => {
  it('NAB: TAKE → asks for timing → AFTER completes', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn(names.TAKE));
    expect(status()).toHaveTextContent('Next: Choose BEFORE or AFTER');
    expect(btn(names.BEFORE)).toHaveAttribute('data-required', 'true');
    expect(btn(names.AFTER)).toHaveAttribute('data-required', 'true');
    expect(btn(names.GIVE)).not.toHaveAttribute('data-required');
    await user.click(btn(names.AFTER));
    expect(status()).toHaveTextContent('Complete');
    expect(status()).toHaveAttribute('data-status', 'complete');
  });

  it('a form tile shows "needs input" until its workflow is complete', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Chewable'));
    expect(btn('Chewable')).toHaveAttribute('data-state', 'requires-input');
    expect(screen.getByTestId('admin-workflow')).toHaveTextContent('Chewable');
    await user.click(btn(names.GIVE));
    await user.click(btn(names.BEFORE));
    expect(btn('Chewable')).not.toHaveAttribute('data-state');
  });

  it('correcting a choice: TAKE → GIVE swaps, never duplicates', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn(names.TAKE));
    await user.click(btn(names.BEFORE));
    await user.click(btn(names.GIVE));
    await user.click(btn(names.AFTER));
    expect(s().additionalInstructions).toEqual(['GIVE', 'AFTER']);
    expect(s().labels[0].additionalInstructions).toEqual(['GIVE', 'AFTER']);
  });
});

describe('spec wording', () => {
  beforeEach(() => setWordingModeForTests('spec'));

  it.each([
    [['TAKE', 'AFTER'], 'ගන්න කෑමට පසු'],
    [['GIVE', 'BEFORE'], 'දෙන්න කෑමට පෙර'],
    [['Keep in Mouth', 'TAKE', 'BEFORE'], 'දිව මත තබා ගන්න කෑමට පෙර'],
    [['Chewable', 'GIVE', 'AFTER'], 'හපලා කන්න දෙන්න කෑමට පසු'],
    [['Dissolve and Drink', 'TAKE', 'AFTER'], 'දිය කර බොන්න කෑමට පසු'],
    [['Empty Stomach', 'GIVE'], 'හිස් බඩ දෙන්න'],
    [['With Food', 'TAKE'], 'කෑමත් සමඟ ගන්න'],
    [['With Food', 'Chewable', 'GIVE'], 'කෑමත් සමඟ හපලා කන්න දෙන්න'],
  ])('%j → label text %s', async (taps, sinhala) => {
    const user = userEvent.setup();
    render(<Workstation />);
    for (const t of taps) await user.click(btn(names[t] ?? t));
    expect(preview()).toContain(sinhala);
    // Exactly once
    expect(preview().split(sinhala).length - 1).toBe(1);
  });

  it('an incomplete workflow shows no sentence in the label text', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Keep in Mouth'));
    await user.click(btn(names.TAKE));
    expect(preview()).not.toMatch(/[඀-෿]/);
    expect(status()).toHaveTextContent('Next: Choose BEFORE or AFTER');
  });

  it('With Food → Chewable keeps both and locks BEFORE/AFTER', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('With Food'));
    await user.click(btn('Chewable'));
    expect(s().additionalInstructions).toEqual(['WITH FOOD', 'CHEWABLE']);
    expect(screen.getByTestId('admin-workflow')).toHaveTextContent('With Food + Chewable');
    expect(btn(names.BEFORE)).toBeDisabled();
    expect(status()).toHaveTextContent('Next: Choose TAKE or GIVE');
  });

  it('Chewable → With Food is refused with a reason; Chewable is kept', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Chewable'));
    await user.click(btn(names.TAKE));
    expect(btn('With Food')).toBeDisabled();
    await user.click(btn('With Food'));
    expect(s().additionalInstructions).toEqual(['CHEWABLE', 'TAKE']);
    expect(btn('With Food')).toHaveAttribute('data-state', 'locked');
    // A native disabled button does not activate its handler.
    await user.click(btn(names.AFTER));
    expect(screen.queryByTestId('workflow-notice')).not.toBeInTheDocument();
    expect(preview()).toContain('හපලා කන්න කෑමට පසු');
  });

  it('correcting the order: remove Chewable, then With Food → Chewable works', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Chewable'));
    await user.click(btn('With Food'));
    await user.click(btn('Chewable')); // deselect
    await user.click(btn('With Food'));
    await user.click(btn('Chewable'));
    await user.click(btn(names.TAKE));
    expect(preview()).toContain('කෑමත් සමඟ හපලා කන්න');
  });

  it('incompatible schedules are natively locked while a dose row is set', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Increase MORNING dosage'));
    for (const code of ['5H', '6H', '8H', 'Daily']) {
      expect(btn(code)).toHaveAttribute('data-state', 'locked');
      expect(btn(code)).toBeDisabled();
      await user.click(btn(code));
      expect(s().additionalInstructions).toEqual([]);
    }
    expect(btn('Evening')).toBeDisabled();
    await user.click(btn('Evening'));
    expect(s().additionalInstructions).toEqual([]);
  });

  it('an interval chosen before a dose locks Digital Label without changing either schedule', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('8H'));
    await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ }));
    await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    await user.click(btn(names.TAKE));
    await user.click(btn(names.AFTER));
    await user.click(btn('Increase NIGHT dosage'));
    expect(btn('Increase NIGHT dosage')).toBeDisabled();
    expect(s().dosage.night.qty).toBe(0);
    expect(status()).toHaveAttribute('data-status', 'complete');
    expect(s().additionalInstructions).toEqual(['8H', 'TAKE', 'AFTER']);
    expect(preview()).toContain('ගන්න කෑමට පසු');
  });

  it('each label keeps its own workflow', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('With Food'));
    await user.click(btn('Chewable'));
    await user.click(btn('Add Label'));
    await user.click(btn('Keep in Mouth'));
    expect(screen.getByTestId('admin-workflow')).toHaveTextContent('Keep in Mouth');
    await user.click(btn('Previous label'));
    expect(screen.getByTestId('admin-workflow')).toHaveTextContent('With Food + Chewable');
    expect(s().labels[1].additionalInstructions).toEqual(['KEEP IN MOUTH']);
  });

  it('rapid repeated taps on a form tile end in a consistent state', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    for (let i = 0; i < 7; i++) await user.click(btn('Dissolve and Drink'));
    expect(s().additionalInstructions).toEqual(['DISSOLVE AND DRINK']);
  });
});

describe('owner-approved phrases through the real buttons (spec wording)', () => {
  beforeEach(() => setWordingModeForTests('spec'));

  it('Morning, Lunch, Night + once each → දිනපතා 3 වරක් ගන්න in the label text, immediately', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(btn('Increase MORNING dosage'));
    await user.click(btn('Increase LUNCH dosage'));
    expect(preview()).not.toContain('දිනපතා 3 වරක් ගන්න');
    expect(screen.getByTestId('label-notice')).toHaveTextContent('No approved Sinhala wording for Morning 1, Lunch 1');
    await user.click(btn('Increase NIGHT dosage'));
    expect(preview()).toContain('පෙති 1 බැගින් දිනකට 3 වරක්');
    expect(screen.queryByTestId('label-notice')).not.toBeInTheDocument();
    // Each row keeps its own quantity
    expect(s().dosage).toEqual({
      morning: { qty: 1, isFraction: false },
      lunch: { qty: 1, isFraction: false },
      night: { qty: 1, isFraction: false },
    });
    // Making the quantities unequal removes the phrase rather than mis-stating it
    await user.click(btn('Increase MORNING dosage'));
    expect(preview()).not.toContain('පෙති 1 බැගින් දිනකට 3 වරක්');
  });

  it('rapid + / − on a row ends on the right quantity and phrase', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    for (let i = 0; i < 5; i++) await user.click(btn('Increase MORNING dosage'));
    for (let i = 0; i < 4; i++) await user.click(btn('Decrease MORNING dosage'));
    await user.click(btn('Increase LUNCH dosage'));
    await user.click(btn('Increase NIGHT dosage'));
    expect(s().dosage.morning.qty).toBe(1);
    expect(preview()).toContain('පෙති 1 බැගින් දිනකට 3 වරක්');
  });

  it('STAT quantity confirms directly to the Function Pad before digital dosing', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Done (Next)'));
    expect(s().activeControl).toBe('idle');
    await user.click(btn('Increase MORNING dosage')); await user.click(btn('Take medication')); await user.click(btn('After meals'));
    expect(s().stat).toMatchObject({ qty: 1, administration: ['TAKE'] }); expect(s().dosage.morning.qty).toBe(1);
    expect(preview()).not.toContain('STAT 1');
  });
  it('follow-up GIVE never changes the intrinsic initial TAKE', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Done (Next)'));
    await user.click(btn('8H')); await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    await user.click(btn('Give medication')); await user.click(btn('After meals'));
    expect(s().stat?.administration).toEqual(['TAKE']); expect(s().additionalInstructions).toContain('GIVE');
  });
  it('STAT fraction retains its whole part after confirmation', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Enter STAT fraction'));
    await user.click(btn('1/2')); await user.click(btn('Done (Next)'));
    await user.click(btn('EOD')); expect(s().stat?.qty).toBe(1.5); expect(s().activeControl).toBe('idle');
  });
  it('STAT quantity Back returns to quantity, then Cancel removes a new initial dose', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Enter STAT fraction')); await user.click(btn('Enter STAT fraction')); // X/Y closes again without a change
    expect(screen.getByText('STAT Dose')).toBeInTheDocument(); await user.click(btn('Cancel'));
    expect(s().stat).toBeNull(); expect(s().additionalInstructions).not.toContain('STAT');
  });
  it('editing and cancelling STAT preserves the committed dose and removing it clears the prefix', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Done (Next)')); await user.click(btn('EOD'));
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Cancel'));
    expect(s().stat?.qty).toBe(1); await user.click(btn(/^Remove STAT/)); expect(s().stat).toBeNull();
  });
});
describe('current-mode STAT follows the approved initial-dose structure', () => {
  it('Done returns to the Function Pad and EOD remains a text-only follow-up', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(btn(/^STAT$/)); await user.click(btn('Increase STAT quantity')); await user.click(btn('Done (Next)')); await user.click(btn('EOD'));
    expect(s().activeControl).toBe('idle'); expect(s().frequencyDosage.qty).toBe(0); expect(preview()).not.toContain('STAT 1');
  });
});
