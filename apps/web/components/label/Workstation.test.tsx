import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { BottomActionBar } from './BottomActionBar';
import { useLabelStore } from '../../store/labelStore';

/**
 * The label workstation as laid out on /label (without the product toolbar, which needs the
 * API). Every interaction goes through the real buttons. See docs/BUTTON_LOGIC_AUDIT.md.
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
const tile = (name: string | RegExp) => screen.getByRole('button', { name });
const preview = () => screen.queryByTestId('label-text-preview')?.textContent ?? '';

beforeEach(() => {
  s().allClear();
  s().setReasonCatalogue(['කැස්සට', 'සෙමට']);
});

describe('instruction tiles', () => {
  it.each([
    ['Weekly', 'WEEKLY'],
    ['Empty Stomach', 'EMPTY STOMACH'],
    ['With Food', 'WITH FOOD'],
    ['Chewable', 'CHEWABLE'],
    ['Dissolve and Drink', 'DISSOLVE AND DRINK'],
    ['Keep in Mouth', 'KEEP IN MOUTH'],
  ])('%s: selects, shows as selected and as a chip, and deselects', async (name, code) => {
    const user = userEvent.setup();
    render(<Workstation />);

    let button = tile(name);
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    if (code === 'WEEKLY') { await user.click(screen.getByRole('button', { name: 'Cancel' })); button = tile(name); }
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(s().additionalInstructions).toEqual([code]);
    expect(screen.getByRole('button', { name: `Remove ${code}` })).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(s().additionalInstructions).toEqual([]);
  });

  it.each([
    ['5H', '5H'],
    ['6H', '6H'],
    ['8H', '8H'],
    ['Daily', 'DAILY'],
    ['Evening', 'EVENING'],
  ])('%s: selects, asks for the quantity per dose, shows it, and deselects', async (name, code) => {
    const user = userEvent.setup();
    render(<Workstation />);

    await user.click(tile(name));
    expect(s().additionalInstructions).toEqual([code]);
    // Compact quantity editor on the right (no number pad): + twice, then Done (Next).
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.queryByTestId('numpad-enter')).toBeNull();
    await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ }));
    await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ }));
    await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));

    expect(s().frequencyDosage).toEqual({ qty: 2, isFraction: false });
    expect(tile(new RegExp(`^${name} 2 each$`))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: `Remove ${code}: 2 each` })).toBeInTheDocument();
    expect(preview()).toContain(code === 'EVENING' ? '2 හවසට' : code === 'DAILY' ? 'දිනකට 2' : `${code}: 2`);

    await user.click(tile(new RegExp(`^${name} 2 each$`)));
    expect(s().additionalInstructions).toEqual([]);
    // No quantity is left behind to print against no interval
    expect(s().frequencyDosage.qty).toBe(0);
  });

  it.each(['5H', '6H', '8H'])('an incomplete %s interval can be reopened from the keyboard without changing its instructions', async (interval) => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile(interval));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('admin-status')).toHaveTextContent(`Next: Enter the quantity for ${interval}`);
    const recovery = screen.getByRole('button', { name: `Enter the quantity for ${interval}` });
    recovery.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: interval })).toBeInTheDocument();
    expect(s().additionalInstructions).toEqual([interval]);
    expect(s().frequencyDosage.qty).toBe(0);
    expect(screen.getByRole('button', { name: /Done \(Next\)/ })).toBeDisabled();
  });

  it('refuses switching 6H → 8H until the selected interval is removed, retaining its quantity', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('6H'));
    await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ }));
    await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    await user.click(tile('8H'));
    expect(tile('8H')).toBeDisabled();
    expect(s().additionalInstructions).toEqual(['6H']);
    expect(s().frequencyDosage.qty).toBe(1);
  });

  it('double click leaves the tile off', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.dblClick(tile('Empty Stomach'));
    expect(s().additionalInstructions).toEqual([]);
  });

  it('works from the keyboard (Enter and Space)', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    tile('Chewable').focus();
    await user.keyboard('{Enter}');
    expect(s().additionalInstructions).toEqual(['CHEWABLE']);
    await user.keyboard(' ');
    expect(s().additionalInstructions).toEqual([]);
  });

  it('works with touch input', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.pointer({ keys: '[TouchA]', target: tile('Evening') });
    expect(s().additionalInstructions).toEqual(['EVENING']);
  });

  it('Remove Address toggles the address and shows its state', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Remove Address'));
    expect(s().showAddress).toBe(false);
    expect(tile('Address Hidden')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Remove ADDRESS HIDDEN' }));
    expect(s().showAddress).toBe(true);
  });

  it('removing a chip deselects the tile', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Weekly'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Remove WEEKLY' }));
    expect(tile('Weekly')).toHaveAttribute('aria-pressed', 'false');
  });

  it('requires Weekly quantity and Done before Daily and does not show a false conflict', async () => {
    const user = userEvent.setup(); render(<Workstation />);
    await user.click(tile('Weekly')); await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    expect(tile('Daily')).toBeDisabled(); await user.click(screen.getByRole('button', { name: 'Done - Weekly' })); await user.click(tile('Daily'));
    expect(s().additionalInstructions).toEqual(['WEEKLY', 'DAILY']); expect(s().weeklyDosage.qty).toBe(1);
    expect(screen.queryByText(/WEEKLY and DAILY are both selected/)).not.toBeInTheDocument();
  });

  it('Clear All asks for a second tap', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Daily'));
    await user.click(screen.getByRole('button', { name: /Clear All/ }));
    expect(s().additionalInstructions).toEqual(['DAILY']);
    await user.click(screen.getByRole('button', { name: /Tap again to clear/ }));
    expect(s().additionalInstructions).toEqual([]);
  });
});

describe('Sinhala label text follows the buttons', () => {
  it.each([
    [['TAKE', 'BEFORE'], 'කෑමට පෙර ගන්න'],
    [['GIVE', 'AFTER'], 'කෑමට පසු දෙන්න'],
    [['Chewable', 'TAKE', 'BEFORE'], 'සපලා කන්න කෑමට පෙර'],
    [['Dissolve and Drink', 'GIVE', 'AFTER'], 'දිය කර බොන්න දෙන්න කෑමට පසු'],
    [['With Food', 'TAKE'], 'කෑමත් සමඟ ගන්න'],
    [['Empty Stomach', 'GIVE'], 'හිස් බඩ දෙන්න'],
  ])('%j → %s', async (buttons, sinhala) => {
    const user = userEvent.setup();
    render(<Workstation />);
    const names: Record<string, string> = { TAKE: 'Take medication', GIVE: 'Give medication', BEFORE: 'Before meals', AFTER: 'After meals' };
    for (const b of buttons) await user.click(tile(names[b] ?? b));
    expect(preview()).toContain(sinhala);
  });
});

describe('administration buttons', () => {
  it('BEFORE/AFTER are locked with a reason while WITH FOOD is selected', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Before meals'));
    await user.click(tile('With Food'));
    expect(s().additionalInstructions).toEqual(['WITH FOOD']);
    expect(tile('Before meals')).toBeDisabled();
    expect(tile('After meals')).toBeDisabled();
    // The reason is on the locked buttons; the status line shows the next required step.
    expect(tile('Before meals')).toHaveAttribute('title', 'Before/After not used with with food');
    expect(screen.getByTestId('admin-status')).toHaveTextContent('Next: Choose TAKE or GIVE');
    await user.click(tile('Take medication'));
    expect(screen.getByTestId('admin-status')).toHaveTextContent('Complete');
  });

  it('GIVE replaces TAKE, and the selection shows', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Take medication'));
    await user.click(tile('Give medication'));
    expect(tile('Give medication')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Take medication')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('dosage rows', () => {
  it('+ and − change only their own row; − is disabled at 0', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    expect(tile('Decrease LUNCH dosage')).toBeDisabled();

    await user.click(tile('Increase LUNCH dosage'));
    await user.click(tile('Increase LUNCH dosage'));
    expect(screen.getByTestId('lunch-qty')).toHaveTextContent('2');
    expect(screen.getByTestId('morning-qty')).toHaveTextContent('0');
    expect(preview()).toContain('දවල් 2');

    await user.click(tile('Decrease LUNCH dosage'));
    expect(screen.getByTestId('lunch-qty')).toHaveTextContent('1');
  });

  it('rapid taps are all counted', async () => {
    render(<Workstation />);
    for (let i = 0; i < 25; i++) fireEvent.click(tile('Increase NIGHT dosage'));
    expect(screen.getByTestId('night-qty')).toHaveTextContent('25');
  });

  it('X/Y shows only the fraction and keeps the whole number', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Increase MORNING dosage'));
    expect(tile(/Morning fraction: none/)).toHaveTextContent('—');

    await user.click(tile(/Morning fraction: none/));
    expect(screen.getByText('MORNING FRACTION (X/Y)')).toBeInTheDocument();
    expect(screen.getByText('Editing Morning fraction')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1/2' }));
    await user.click(screen.getByTestId('numpad-enter'));

    expect(screen.getByTestId('morning-qty')).toHaveTextContent('1½');
    expect(tile(/Morning fraction: ½/)).toHaveTextContent('½');
    expect(preview()).toContain('උදේට 1½');
  });

  it('QTY opens the pad; AC clears only the entry; an invalid entry is refused', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    s().addLabel();
    s().selectLabel(0);

    await user.click(tile(/Night quantity: 0/));
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(tile('Clear entry'));
    expect(s().labels).toHaveLength(2);
    expect(s().numberPad.visible).toBe(true);

    await user.click(screen.getByRole('button', { name: '/' }));
    await user.click(screen.getByTestId('numpad-enter'));
    expect(screen.getByRole('alert')).toHaveTextContent('Not a number');
    expect(s().dosage.night.qty).toBe(0);
  });

  it('there is no unit selector that changes nothing', () => {
    render(<Workstation />);
    expect(screen.queryByRole('button', { name: 'Tablets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ML' })).not.toBeInTheDocument();
  });
});

describe('Reasons, STAT, days, expiry, labels', () => {
  it('Reasons opens its panel, Enter confirms it, and other instructions survive', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Chewable'));
    await user.click(tile('Reasons'));
    await user.click(screen.getByRole('button', { name: 'කැස්සට' }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(screen.queryByText('Reason for Use')).not.toBeInTheDocument();
    expect(s().additionalInstructions).toEqual(['CHEWABLE']);
    expect(tile(/Reasons 1 selected/)).toBeInTheDocument();
  });

  it('STAT: Done is disabled until a quantity is entered; re-opening keeps the dose', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile(/^STAT$/));
    expect(tile(/Done \(Next\)/)).toBeDisabled();
    await user.click(tile('Increase STAT quantity'));
    await user.click(tile(/Done \(Next\)/));
    await user.click(tile('6H'));
    await user.click(within(screen.getByRole('region', { name: 'Action workspace' })).getByRole('button', { name: /^Increase .* quantity$/ })); await user.click(screen.getByRole('button', { name: /Done \(Next\)/ }));
    await user.click(tile(/^STAT$/));
    expect(screen.getByTestId('stat-qty')).toHaveTextContent('1');
    await user.click(tile('Cancel'));
    expect(s().stat).toMatchObject({ qty: 1, isFraction: false, followUp: '6H' });
    expect(screen.getByRole('button', { name: 'Remove STAT: 1 TAKE (6H)' })).toBeInTheDocument();
  });

  it('while STAT is being entered, chips and Clear All cannot change it', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile(/^STAT$/));
    expect(screen.getByRole('button', { name: 'Remove STAT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Clear All/ })).toBeDisabled();
  });

  it('days show — until entered, then count from 1', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    // Days is an action button; its −/+ are in the panel on the right.
    await user.click(tile(/^Days/));
    expect(tile(/Days: not set/)).toHaveTextContent('—');
    expect(tile('Decrease days quantity')).toBeDisabled();
    await user.click(tile('Increase days quantity'));
    expect(tile(/Days: 1/)).toHaveTextContent('1');
    await user.click(tile('Done'));
    expect(s().days).toBe(1);
    expect(tile(/^Days 1 day/)).toHaveAttribute('data-selected', 'true');
  });

  it('days-of-week Cancel undoes the changes', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile(/^Name of Days/));
    await user.click(screen.getByRole('button', { name: 'සඳුදා' }));
    await user.click(tile('Cancel'));
    expect(s().selectedDaysOfWeek).toEqual([]);
  });

  it('EXP Date has no typed entry: without a catalogue medicine it explains why and adds nothing', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile(/EXP Date/));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Select a medicine from the catalogue first');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(s().expiryDate).toBeNull();
    expect(tile(/EXP Date/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('tapping the expiry card again removes the printed expiry (Document 5: deselect)', async () => {
    const user = userEvent.setup();
    s().setProduct({ id: 'p1', name: 'Medicine A' });
    s().setExpiryBatch({ id: 'b1', productId: 'p1', batchNumber: 'B1', expiryDate: '2099-12-31', source: 'inventory' });
    render(<Workstation />);
    await user.click(tile(/Expiry date 2099-12-31 will be printed/));
    expect(s().expiryDate).toBeNull();
    expect(tile(/EXP Date/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('Add Label and Delete Label (with confirmation) keep the other labels intact', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('Weekly'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(tile('Add Label'));
    expect(screen.getByText('Label 2 / 2')).toBeInTheDocument();
    expect(tile('Weekly')).toHaveAttribute('aria-pressed', 'false');

    await user.click(tile('Keep in Mouth'));
    await user.click(tile('Delete Label'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Label 2 of 2?');
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete Label' }));

    expect(screen.getByText('Label 1 / 1')).toBeInTheDocument();
    expect(s().labels[0].additionalInstructions).toEqual(['WEEKLY']);
    expect(tile('Weekly')).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching labels shows each label’s own selections', async () => {
    const user = userEvent.setup();
    render(<Workstation />);
    await user.click(tile('With Food'));
    await user.click(tile('Add Label'));
    await user.click(tile('Chewable'));
    await user.click(tile('Previous label'));
    expect(tile('With Food')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Chewable')).toHaveAttribute('aria-pressed', 'false');
    await user.click(tile('Next label'));
    expect(tile('Chewable')).toHaveAttribute('aria-pressed', 'true');
  });
});
