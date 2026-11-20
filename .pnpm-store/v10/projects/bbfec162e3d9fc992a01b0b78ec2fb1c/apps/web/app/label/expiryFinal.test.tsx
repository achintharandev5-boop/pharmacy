import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LabelPage from './page';
import { useLabelStore, createDefaultLabel, type LabelData } from '../../store/labelStore';
import { createPrescriptionRecord } from '../actions/prescriptions';
import { UI_TEST_NOT_SAVED } from '../../lib/uiTestMode';
import type { ExpiryBatch } from '../../lib/batchExpiry';

/** Feature #22: DONE, final Save and final Print each check the batch expiry on the latest state. */
vi.mock('../actions/prescriptions', () => ({ createPrescriptionRecord: vi.fn(), logPrescriptionPrint: vi.fn() }));
vi.mock('../actions/inventory', () => ({ getDispensingBatches: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => [] }));
vi.mock('../../components/label/ProductToolbar', () => ({ ProductToolbar: () => null }));
vi.mock('../../components/CustomerSearchPanel', () => ({ CustomerSearchPanel: () => null }));
// Bypass the review component's disabled buttons to verify the final actions have their own guard.
vi.mock('../../components/label/LabelActionPage', () => ({
  LabelActionPage: ({ onPrintAndSave, onSave }: { onPrintAndSave: () => void; onSave: () => void }) => <><button onClick={onPrintAndSave}>Request print</button><button onClick={onSave}>Request save</button></>,
}));

const state = () => useLabelStore.getState();
const MED = { id: '11111111-1111-4111-8111-111111111111', name: 'Medicine A', product_type: 'Karal' };
const BATCH: ExpiryBatch = { id: '66666666-6666-4666-8666-666666666661', productId: MED.id, batchNumber: 'A-1', expiryDate: '2099-08-31', source: 'inventory' };

function draft(over: Partial<LabelData> = {}): LabelData {
  const d = createDefaultLabel();
  d.product = MED;
  d.productQuantity = 10;
  d.dosage.morning = { qty: 1, isFraction: false };
  d.dosage.night = { qty: 1, isFraction: false };
  d.additionalInstructions = ['TAKE', 'AFTER'];
  return { ...d, ...over };
}
const withExpiry = (over: Partial<LabelData> = {}) => draft({ additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'], expiryDate: BATCH.expiryDate, expiryBatch: BATCH, ...over });
const done = () => fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));

beforeEach(() => {
  useLabelStore.setState(useLabelStore.getInitialState(), true);
  vi.mocked(createPrescriptionRecord).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('DONE', () => {
  it('stops at the affected label when Add Expiry Date has no retrieved batch', () => {
    state().restoreLabel(draft());
    state().addLabel();
    state().restoreLabel(draft({ additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'] }));
    state().selectLabel(0);
    render(<LabelPage />);
    done();
    expect(screen.getByText(/Label 2: Add Expiry Date is selected but no batch expiry date has been retrieved/)).toBeInTheDocument();
    expect(state().activeLabelIndex).toBe(1);
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
  });
});

describe('final Save and Print', () => {
  it('sends the exact printed date with its GRN batch, and the same instruction text as without it', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel(draft());
    render(<LabelPage />);
    done();
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledTimes(1));
    const without = vi.mocked(createPrescriptionRecord).mock.calls[0][0].items[0];
    expect(without.expiryDate).toBeUndefined();
    expect(without.expiryBatchId).toBeUndefined();

    act(() => state().restoreLabel(withExpiry()));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledTimes(2));
    const item = vi.mocked(createPrescriptionRecord).mock.calls[1][0].items[0];
    expect(item).toMatchObject({ expiryDate: '2099-08-31', expiryBatchId: BATCH.id, productId: MED.id });
    expect(item.finalInstructionText).toBe(without.finalInstructionText);
    expect(item.instructions).toContain('ADD EXP DATE');
    // The backend refused: nothing is reported as saved.
    expect(await screen.findByText(/Not saved: Simulated save failure/)).toBeInTheDocument();
  });

  it.each(['Request save', 'Request print'].flatMap((action) => [
    [action, 'NOT RETRIEVED', { expiryDate: null, expiryBatch: null }],
    [action, 'MEDICINE CHANGED', { product: { id: '22222222-2222-4222-8222-222222222222', name: 'Medicine B', product_type: 'Karal' } }],
    [action, 'BATCH EDITED', { expiryDate: '2099-09-30' }],
    [action, 'INVALID DATE', { expiryDate: '2099-02-30', expiryBatch: { ...BATCH, expiryDate: '2099-02-30' } }],
    [action, 'PASSED', { expiryDate: '2020-01-31', expiryBatch: { ...BATCH, expiryDate: '2020-01-31' } }],
    [action, 'UI TEST VALUE', { expiryBatch: { ...BATCH, id: null, source: 'ui-test' as const } }],
    [action, 'DESELECTED BUT LEFT', { additionalInstructions: ['TAKE', 'AFTER'] }],
  ] as const))('%s rejects an expiry %s after review before any API write', (action, _problem, change) => {
    state().restoreLabel(withExpiry());
    render(<LabelPage />);
    done();
    act(() => state().restoreLabel(withExpiry(change as Partial<LabelData>)));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
    expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument();
  });

  it('reports an unreachable server as not saved and prints nothing', async () => {
    vi.mocked(createPrescriptionRecord).mockRejectedValue(new Error('offline'));
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    state().restoreLabel(withExpiry());
    render(<LabelPage />);
    done();
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    expect(await screen.findByText(/Not saved, nothing printed: the pharmacy server could not be reached/)).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
  });
});

describe('database-free UI testing mode', () => {
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true'); });

  it('previews a tester-entered temporary expiry without saving or contacting the API', async () => {
    let printed: string | null | undefined;
    const print = vi.spyOn(window, 'print').mockImplementation(() => { printed = document.querySelector('[data-label-expiry]')?.textContent; });
    state().restoreLabel(withExpiry({ expiryBatch: { id: null, productId: null, batchNumber: null, expiryDate: '2099-08-31', source: 'ui-test' } }));
    render(<LabelPage />);
    done();
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    expect(await screen.findByText(new RegExp(UI_TEST_NOT_SAVED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
    expect(print).toHaveBeenCalledTimes(1);
    expect(printed).toContain('EXP DATE : 2099-08-31');
    // No stale print-only copy remains to be printed after later edits.
    await waitFor(() => expect(document.querySelector('[data-label-expiry]')).toBeNull());
    print.mockRestore();
  });

  it('offers only a clearly marked temporary test date, never a generated batch', () => {
    state().restoreLabel(draft());
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: /EXP Date/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('UI testing mode: inventory batches are not loaded. No GRN expiry is available.');
    expect(screen.getByLabelText(/Temporary local test expiry \(not a GRN batch, never saved\)/)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Temporary local test expiry/), { target: { value: '31/08/2099' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use test date' }));
    expect(screen.getByText('Enter a real date as YYYY-MM-DD.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Temporary local test expiry/), { target: { value: '2099-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use test date' }));
    expect(state().expiryBatch).toEqual({ id: null, productId: MED.id, batchNumber: null, expiryDate: '2099-08-31', source: 'ui-test' });
    expect(screen.getByRole('button', { name: /Remove EXP: 2099-08-31 \(UI test value, not GRN\)/ })).toBeInTheDocument();
  });
});
