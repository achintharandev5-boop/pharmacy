import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Feature #22, Add Expiry Date (Document 5 pp. 41–43 and 54–55): the GRN batch expiry is
 * retrieved, never typed, appears only when selected, and its space is reclaimed when not.
 */
const lookup = vi.fn();
vi.mock('../../app/actions/inventory', () => ({ getDispensingBatches: (id: string) => lookup(id) }));
vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));

import { InstructionGrid } from './InstructionGrid';
import { ActionWorkspace } from './ActionWorkspace';
import { BottomActionBar } from './BottomActionBar';
import { LabelActionPage } from './LabelActionPage';
import { LabelCard } from '../PrintableLabel';
import { useLabelStore, createDefaultLabel } from '../../store/labelStore';
import { buildFinalInstruction } from '../../lib/labelBuilder';
import { expiryPrintError, type ExpiryBatch } from '../../lib/batchExpiry';

const s = () => useLabelStore.getState();
const tile = () => screen.getByRole('button', { name: /EXP Date/ });
const MED_A = { id: 'pa', name: 'Medicine A' };
const MED_B = { id: 'pb', name: 'Medicine B' };
const batchA = (over: Partial<ExpiryBatch> = {}): ExpiryBatch => ({ id: 'ba1', productId: 'pa', batchNumber: 'A-1', expiryDate: '2099-08-31', source: 'inventory', ...over });
const response = (productId: string, batches: { id: string; batchNumber: string; expiryDate: string; quantityAvailable: number }[], excluded = 0) =>
  ({ ok: true, data: { productId, batches, excludedBatchCount: excluded } });

function Workstation() {
  return (
    <>
      <InstructionGrid />
      <ActionWorkspace />
      <BottomActionBar onDone={() => {}} />
    </>
  );
}

beforeEach(() => {
  s().allClear();
  s().setReasonCatalogue(['කැස්සට']);
  lookup.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('Add Expiry Date button', () => {
  it('is available, not selected by default, and has no typed date entry', () => {
    render(<Workstation />);
    expect(tile()).toBeEnabled();
    expect(tile()).toHaveAttribute('aria-pressed', 'false');
    expect(tile()).not.toHaveAttribute('data-selected');
  });

  it('retrieves the single dispensable batch expiry at once and shows it selected (blue)', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    lookup.mockResolvedValue(response('pa', [{ id: 'ba1', batchNumber: 'A-1', expiryDate: '2099-08-31', quantityAvailable: 30 }]));
    render(<Workstation />);
    await user.click(tile());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(lookup).toHaveBeenCalledWith('pa');
    expect(s().expiryDate).toBe('2099-08-31');
    expect(s().expiryBatch).toEqual(batchA());
    expect(tile()).toHaveAttribute('aria-pressed', 'true');
    expect(tile()).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: /Remove EXP: 2099-08-31 · Batch A-1/ })).toBeInTheDocument();

    // Deselect: tapping again removes the date.
    await user.click(tile());
    expect(s().expiryDate).toBeNull();
    expect(s().expiryBatch).toBeNull();
    expect(tile()).toHaveAttribute('aria-pressed', 'false');
  });

  it('works from the keyboard', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    lookup.mockResolvedValue(response('pa', [{ id: 'ba1', batchNumber: 'A-1', expiryDate: '2099-08-31', quantityAvailable: 30 }]));
    render(<Workstation />);
    tile().focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(s().expiryDate).toBe('2099-08-31'));
  });

  it('with several batches the pharmacist chooses; no batch is picked for them', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    lookup.mockResolvedValue(response('pa', [
      { id: 'ba1', batchNumber: 'A-1', expiryDate: '2099-08-31', quantityAvailable: 5 },
      { id: 'ba2', batchNumber: 'A-2', expiryDate: '2099-12-31', quantityAvailable: 50 },
    ]));
    render(<Workstation />);
    await user.click(tile());
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('list', { name: 'Dispensable batches' });
    expect(s().expiryDate).toBeNull();
    expect(within(dialog).getByText(/Choose the batch you are dispensing from/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Batch A-2/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(s().expiryDate).toBe('2099-12-31');
    expect(s().expiryBatch?.id).toBe('ba2');
  });

  it('shows loading, then empty with the excluded count, and adds nothing', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    let resolve!: (v: unknown) => void;
    lookup.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<Workstation />);
    await user.click(tile());
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Loading batches');
    await act(async () => resolve(response('pa', [], 2)));
    expect(screen.getByRole('alert')).toHaveTextContent('No dispensable batch with a recorded expiry date (2 batches are expired, quarantined or undated)');
    expect(s().expiryDate).toBeNull();
    expect(s().additionalInstructions).not.toContain('ADD EXP DATE');
  });

  it('reports a server error, adds nothing, and can retry', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    lookup.mockResolvedValueOnce({ ok: false, error: 'Could not reach the pharmacy server.' })
      .mockResolvedValueOnce(response('pa', [{ id: 'ba1', batchNumber: 'A-1', expiryDate: '2099-08-31', quantityAvailable: 3 }]));
    render(<Workstation />);
    await user.click(tile());
    expect(await screen.findByRole('alert')).toHaveTextContent('No expiry date added: Could not reach the pharmacy server.');
    expect(s().expiryDate).toBeNull();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(s().expiryDate).toBe('2099-08-31'));
  });

  it('refuses a response for another medicine and never offers an invalid or missing date', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    lookup.mockResolvedValueOnce(response('pb', [{ id: 'bb1', batchNumber: 'B-1', expiryDate: '2099-01-01', quantityAvailable: 1 }]));
    render(<Workstation />);
    await user.click(tile());
    expect(await screen.findByRole('alert')).toHaveTextContent('different medicine');
    expect(s().expiryDate).toBeNull();
    await user.keyboard('{Escape}');

    lookup.mockResolvedValueOnce(response('pa', [{ id: 'ba1', batchNumber: 'A-1', expiryDate: '2099-02-30', quantityAvailable: 1 }]));
    await user.click(tile());
    expect(await screen.findByRole('alert')).toHaveTextContent('No dispensable batch');
    expect(s().expiryDate).toBeNull();
  });

  it('is faded and locked while a STAT dose is being entered', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    s().startStat();
    render(<Workstation />);
    // The STAT panel is open on the right; the EXP Date tile stays on the left, faded and locked,
    // and the expiry card in the bottom bar is faded and inert.
    expect(tile()).toBeDisabled();
    expect(tile().className).toContain('opacity-45');
    expect(screen.getByRole('region', { name: 'Action workspace' })).toHaveAttribute('data-workspace', 'stat');
    const card = screen.getByRole('button', { name: /Expiry date not added/ });
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card.className).toContain('opacity-40');
    s().toggleAdditionalInstruction('ADD EXP DATE');
    await user.click(card).catch(() => {});
    expect(s().expDateModalVisible).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('expiry state per label', () => {
  it('changing the medicine removes the previous batch expiry; the same medicine keeps it', () => {
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    s().setProduct({ ...MED_A });
    expect(s().expiryDate).toBe('2099-08-31');
    s().setProduct(MED_B);
    expect(s().expiryDate).toBeNull();
    expect(s().expiryBatch).toBeNull();
    expect(s().additionalInstructions).not.toContain('ADD EXP DATE');
  });

  it('refuses a batch of a different medicine (late lookup after a switch)', () => {
    s().setProduct(MED_B);
    expect(s().setExpiryBatch(batchA())).toBe(false);
    expect(s().expiryDate).toBeNull();
    expect(s().workflowNotice).toContain('not a batch of the medicine');
  });

  it('a later batch choice replaces the earlier one', () => {
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    s().setExpiryBatch(batchA({ id: 'ba2', batchNumber: 'A-2', expiryDate: '2099-12-31' }));
    expect(s().expiryBatch?.id).toBe('ba2');
    expect(s().expiryDate).toBe('2099-12-31');
    expect(s().additionalInstructions.filter((c) => c === 'ADD EXP DATE')).toHaveLength(1);
  });

  it('keeps each label its own expiry across add, switch and remove', () => {
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    s().addLabel();
    expect(s().expiryDate).toBeNull();
    s().setProduct(MED_B);
    s().selectLabel(0);
    expect(s().expiryDate).toBe('2099-08-31');
    s().selectLabel(1);
    expect(s().expiryDate).toBeNull();
    s().confirmDeleteActiveLabel();
    expect(s().labels).toHaveLength(1);
    expect(s().expiryBatch?.id).toBe('ba1');
  });

  it('Reset, Clear All and All Clear remove it; the number pad does not', () => {
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    s().openNumberPad('days');
    s().cancelNumberPad();
    expect(s().expiryDate).toBe('2099-08-31');
    s().resetActiveLabel();
    expect(s().expiryDate).toBeNull();

    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    s().clearLabelInstructions();
    expect(s().expiryBatch).toBeNull();
    expect(s().expiryDate).toBeNull();

    s().setExpiryBatch(batchA());
    s().allClear();
    expect(s().expiryBatch).toBeNull();
  });

  it('switching labels closes an open batch lookup', () => {
    s().addLabel();
    s().toggleAdditionalInstruction('ADD EXP DATE');
    expect(s().expDateModalVisible).toBe(true);
    s().selectLabel(0);
    expect(s().expDateModalVisible).toBe(false);
  });

  it('a restored draft keeps its batch reference, which is checked again before Save/Print', () => {
    const draft = createDefaultLabel();
    draft.product = MED_B;
    draft.additionalInstructions = ['ADD EXP DATE'];
    draft.expiryDate = '2099-08-31';
    draft.expiryBatch = batchA(); // batch of Medicine A: stale
    s().restoreLabel(draft);
    expect(s().expiryBatch?.id).toBe('ba1');
    expect(expiryPrintError(s().labels[0])).toContain('different medicine or batch');
  });
});

describe('printed 70 × 50 mm label', () => {
  const labelFor = (withExpiry: boolean) => {
    const l = { ...createDefaultLabel('l1'), product: MED_A, productQuantity: 10, additionalInstructions: ['TAKE', 'AFTER', ...(withExpiry ? ['ADD EXP DATE'] : [])], dosage: { morning: { qty: 1, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 1, isFraction: false } } };
    return withExpiry ? { ...l, expiryDate: '2099-08-31', expiryBatch: batchA() } : l;
  };

  it('prints the exact GRN date in the expiry row when selected', () => {
    const { container } = render(<LabelCard labelItem={buildFinalInstruction(labelFor(true))} />);
    expect(container.querySelector('[data-label-expiry]')).toHaveTextContent('EXP DATE : 2099-08-31');
    // The expiry row sits between the instructions and the footer; no hardcoded "DISPENSED BY" text.
    const sections = Array.from(container.querySelectorAll('[data-label-section]')).map((el) => el.getAttribute('data-label-section'));
    expect(sections.slice(-3)).toEqual(['instructions', 'expiry', 'footer']);
    expect(container.textContent).not.toContain('DISPENSED BY');
  });

  it('prints no expiry row or placeholder when not selected and gives its 3.5 mm to the instructions', () => {
    const { container } = render(<LabelCard labelItem={buildFinalInstruction(labelFor(false))} />);
    expect(container.querySelector('[data-label-section="expiry"]')).toBeNull();
    expect(container.textContent).not.toContain('EXP DATE');
    expect(container.textContent).not.toMatch(/EXP[^]*_{3,}/);
    // The instruction area takes all height the optional rows leave free; the label stays 70 × 50 mm.
    const body = container.querySelector('[data-label-body]') as HTMLElement;
    expect(body).toHaveClass('flex-1');
    const sections = Array.from(container.querySelectorAll('[data-label-section]')).map((el) => el.getAttribute('data-label-section'));
    expect(sections).toEqual(['product', 'instructions', 'footer']);
    expect(container.querySelector('[data-label]')!.className).toContain('h-[50mm]');
  });

  it('an expiry left on a label without the selection is never printed', () => {
    const { container } = render(<LabelCard labelItem={buildFinalInstruction({ ...labelFor(false), expiryDate: '2099-08-31', expiryBatch: batchA() })} />);
    expect(container.textContent).not.toContain('2099-08-31');
  });

  it('keeps unequal-dose circled rows and reasons with the expiry row', () => {
    const l = { ...labelFor(true), additionalInstructions: ['TAKE', 'AFTER', 'REASONS', 'ADD EXP DATE'], reasons: ['කැස්සට'], reasonsConfirmed: true, dosage: { morning: { qty: 1, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 0.5, isFraction: true } } };
    const built = buildFinalInstruction(l);
    const { container } = render(<LabelCard labelItem={built} />);
    expect(container.querySelector('[data-label-reasons]')).toHaveTextContent('කැස්සට');
    expect(container.querySelector('[data-label-expiry]')).toHaveTextContent('2099-08-31');
    expect(built.finalInstructionText).toBe(buildFinalInstruction({ ...l, additionalInstructions: ['TAKE', 'AFTER', 'REASONS'] }).finalInstructionText);
  });
});

describe('review page', () => {
  const renderReview = () => {
    const onSave = vi.fn();
    const onPrintAndSave = vi.fn();
    render(<LabelActionPage onSave={onSave} onDelete={vi.fn()} onPrintAndSave={onPrintAndSave} onBack={vi.fn()} />);
    return { onSave, onPrintAndSave };
  };

  it('shows the printed date with its batch and allows saving', async () => {
    const user = userEvent.setup();
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    const { onSave } = renderReview();
    expect(screen.getAllByText(/EXP: 2099-08-31/)[0].closest('[data-review-expiry]')).toHaveTextContent('Batch A-1');
    await user.click(screen.getByRole('button', { name: 'Save without printing' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('blocks Save and Print for a selected expiry that was never retrieved, naming the label', async () => {
    s().addLabel();
    s().setProduct(MED_A);
    useLabelStore.setState((st) => {
      const labels = [...st.labels];
      labels[1] = { ...labels[1], additionalInstructions: ['ADD EXP DATE'] };
      return { labels };
    });
    const { onSave, onPrintAndSave } = renderReview();
    expect(screen.getByTestId('expiry-validation-blocked')).toHaveTextContent('Label 2: Add Expiry Date is selected but no batch expiry date has been retrieved');
    expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save without printing' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onPrintAndSave).not.toHaveBeenCalled();
  });

  it('re-checks the latest state when Print & Save is pressed (changed after review)', async () => {
    s().setProduct(MED_A);
    s().setExpiryBatch(batchA());
    const { onPrintAndSave } = renderReview();
    const print = screen.getByRole('button', { name: /Print & Save/ });
    // The draft changes underneath the open review (e.g. restored with another medicine's batch).
    useLabelStore.setState((st) => ({ labels: [{ ...st.labels[0], product: MED_B }] }), false);
    print.click();
    expect(onPrintAndSave).not.toHaveBeenCalled();
  });
});
