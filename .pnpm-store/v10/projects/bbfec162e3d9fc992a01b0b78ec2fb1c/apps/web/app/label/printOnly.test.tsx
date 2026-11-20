import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LabelPage from './page';
import { useLabelStore, createDefaultLabel, type LabelData } from '../../store/labelStore';
import { createPrescriptionRecord, logPrescriptionPrint } from '../actions/prescriptions';
import { labelFitReport } from '../../lib/labelFit';
import type { ExpiryBatch } from '../../lib/batchExpiry';

/**
 * Print label only (not saved): a standalone 70 × 50 mm label without patient or medicine names.
 * It runs the label checks of Print & Save but never saves, deducts stock or records the print.
 */
vi.mock('../actions/prescriptions', () => ({ createPrescriptionRecord: vi.fn(), logPrescriptionPrint: vi.fn() }));
vi.mock('../actions/inventory', () => ({ getDispensingBatches: vi.fn() }));
vi.mock('../../lib/labelFit', () => ({ labelFitReport: vi.fn(() => []) }));
vi.mock('../../components/label/ProductToolbar', () => ({ ProductToolbar: () => null }));
vi.mock('../../components/CustomerSearchPanel', () => ({ CustomerSearchPanel: () => null }));
vi.mock('../../components/ReasonCatalogueLoader', () => ({ ReasonCatalogueLoader: () => null })); // catalogue set by the test
vi.mock('../../components/label/LabelActionPage', () => ({
  LabelActionPage: ({ onPrintAndSave, onSave, onPrintOnly }: { onPrintAndSave: () => void; onSave: () => void; onPrintOnly?: () => void }) => (
    <><button onClick={onPrintOnly}>Request print only</button><button onClick={onPrintAndSave}>Request print</button><button onClick={onSave}>Request save</button></>
  ),
}));

const state = () => useLabelStore.getState();
const MED = { id: 'manual', name: 'Typed Medicine', product_type: 'Karal' };
const BATCH: ExpiryBatch = { id: '66666666-6666-4666-8666-666666666661', productId: '11111111-1111-4111-8111-111111111111', batchNumber: 'A-1', expiryDate: '2099-08-31', source: 'inventory' };

/** A complete morning-only label (no product type needed); no patient, no medicine unless given. */
function draft(over: Partial<LabelData> = {}): LabelData {
  const d = createDefaultLabel();
  d.productQuantity = 10;
  d.dosage.morning = { qty: 1, isFraction: false };
  d.additionalInstructions = ['TAKE', 'AFTER'];
  return { ...d, ...over };
}

let printed: { labels: number; text: string[]; sections: string[][] } | null;
let print: ReturnType<typeof vi.spyOn>;
const done = () => fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
const printOnly = () => fireEvent.click(screen.getByRole('button', { name: 'Request print only' }));

beforeEach(() => {
  useLabelStore.setState(useLabelStore.getInitialState(), true);
  vi.mocked(createPrescriptionRecord).mockReset();
  vi.mocked(logPrescriptionPrint).mockReset();
  vi.mocked(labelFitReport).mockReturnValue([]);
  printed = null;
  // Capture the print copy at the moment the browser would print it.
  print = vi.spyOn(window, 'print').mockImplementation(() => {
    const labels = Array.from(document.querySelectorAll('.print-only [data-label]'));
    printed = {
      labels: labels.length,
      text: labels.map((l) => l.textContent ?? ''),
      sections: labels.map((l) => Array.from(l.querySelectorAll('[data-label-section]')).map((x) => x.getAttribute('data-label-section') ?? '')),
    };
  });
});
afterEach(() => { print.mockRestore(); vi.unstubAllEnvs(); });

async function printOnlyOk() {
  done();
  printOnly();
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(createPrescriptionRecord).not.toHaveBeenCalled();
  expect(logPrescriptionPrint).not.toHaveBeenCalled();
  expect(await screen.findByText(/Label printed only\. Nothing was saved, no stock was deducted and no print was recorded\./)).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector('.print-only [data-label]')).toBeNull()); // no stale print copy
}

describe('patient and medicine names are optional for print-only labels', () => {
  it('neither name: prints the instructions; no patient or medicine row, no placeholder', async () => {
    state().restoreLabel(draft());
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.labels).toBe(1);
    expect(printed!.sections[0]).toEqual(['product', 'instructions', 'footer']); // quantity only in the header
    expect(printed!.text[0]).toContain('කෑමට පසු ගන්න');
    expect(printed!.text[0]).not.toMatch(/Patient|Pt:|MEDICINE|Walk-in|_{2,}/);
    expect(state().labels[0].dosage.morning.qty).toBe(1); // the draft is kept
  });

  it('patient only', async () => {
    useLabelStore.setState({ customerName: 'Nimal Perera' });
    state().restoreLabel(draft());
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.text[0]).toContain('Patient: Nimal Perera');
    expect(printed!.text[0]).not.toContain('Typed Medicine');
  });

  it('medicine only', async () => {
    state().restoreLabel(draft({ product: MED }));
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.text[0]).toContain('Typed Medicine');
    expect(printed!.text[0]).not.toContain('Patient');
  });

  it('both names', async () => {
    useLabelStore.setState({ customerName: 'Nimal Perera' });
    state().restoreLabel(draft({ product: MED }));
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.text[0]).toContain('Typed Medicine');
    expect(printed!.text[0]).toContain('Patient: Nimal Perera');
  });

  it('several labels each print on their own', async () => {
    state().restoreLabel(draft());
    state().addLabel();
    state().restoreLabel(draft({ product: MED, dosage: { morning: { qty: 0, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 2, isFraction: false } } }));
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.labels).toBe(2);
    expect(printed!.text[1]).toContain('Typed Medicine');
    expect(printed!.text[0]).not.toContain('Typed Medicine');
  });
});

describe('print-only keeps every label safety check', () => {
  it.each([
    ['missing product quantity', { productQuantity: null }, /label 1 needs an explicitly entered product quantity/],
    ['STAT without its quantity', { additionalInstructions: ['STAT', 'TAKE', 'AFTER'], stat: { qty: 0, isFraction: false, followUp: null } }, /label 1:/],
    ['5H without a product type (no medicine)', { additionalInstructions: ['5H', 'TAKE', 'AFTER'], frequencyDosage: { qty: 1, isFraction: false }, dosage: { morning: { qty: 0, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 0, isFraction: false } } }, /Product type is missing/],
    ['expiry selected without a retrieved batch', { additionalInstructions: ['TAKE', 'AFTER', 'ADD EXP DATE'] }, /no batch expiry date has been retrieved/],
  ] as const)('%s: nothing printed, nothing saved', async (_name, over, message) => {
    state().restoreLabel(draft(over as Partial<LabelData>));
    render(<LabelPage />);
    // DONE refuses some of these first; the final print-only action re-checks the latest state on its own.
    done();
    if (!screen.queryByRole('button', { name: 'Request print only' })) {
      state().restoreLabel(draft());
      done();
      state().restoreLabel(draft(over as Partial<LabelData>));
    }
    printOnly();
    expect(await screen.findByText(new RegExp(`Nothing printed: .*${message.source}`))).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('a label that does not fit 70 × 50 mm is not printed', async () => {
    state().restoreLabel(draft());
    render(<LabelPage />);
    done();
    vi.mocked(labelFitReport).mockReturnValue([{ index: 0, problems: ['instructions (dose rows and Sinhala lines)'] }]);
    printOnly();
    expect(await screen.findByText('Nothing printed: label text does not fit the 70 × 50 mm label.')).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
  });

  it('5H with a typed medicine and its product type, reasons and a GRN expiry all print', async () => {
    state().setReasonCatalogue(['කැස්සට']);
    state().restoreLabel(draft({
      product: { ...MED, id: BATCH.productId! },
      additionalInstructions: ['5H', 'TAKE', 'AFTER', 'REASONS', 'ADD EXP DATE'],
      frequencyDosage: { qty: 1, isFraction: false },
      dosage: { morning: { qty: 0, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 0, isFraction: false } },
      reasons: ['කැස්සට'], reasonsConfirmed: true,
      expiryDate: BATCH.expiryDate, expiryBatch: BATCH,
    }));
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.text[0]).toContain('පැය 5කට වරක්');
    expect(printed!.text[0]).toContain('කැස්සට');
    expect(printed!.text[0]).toContain('EXP DATE : 2099-08-31');
  });
});

describe('saving and dispensing are unchanged', () => {
  it('Print & Save still saves first and prints nothing when the server refuses a label without a medicine', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Label 1: select a medicine or enter its name.' });
    state().restoreLabel(draft());
    render(<LabelPage />);
    done();
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    expect(await screen.findByText(/Not saved, nothing printed: Label 1: select a medicine or enter its name\./)).toBeInTheDocument();
    expect(createPrescriptionRecord).toHaveBeenCalledTimes(1);
    const item = vi.mocked(createPrescriptionRecord).mock.calls[0][0].items[0];
    expect(item.productId).toBeUndefined(); // no invented medicine is sent
    expect(item.alternativeProductName).toBeUndefined();
    expect(print).not.toHaveBeenCalled();
  });

  it('Save keeps its quantity check', async () => {
    state().restoreLabel(draft());
    render(<LabelPage />);
    done();
    state().restoreLabel(draft({ productQuantity: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    expect(await screen.findByText(/Not saved: label 1 needs an explicitly entered product quantity/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});

describe('database-free UI testing mode', () => {
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true'); });

  it('print-only works without names and without any API call', async () => {
    state().restoreLabel(draft());
    render(<LabelPage />);
    await printOnlyOk();
    expect(printed!.labels).toBe(1);
  });
});
