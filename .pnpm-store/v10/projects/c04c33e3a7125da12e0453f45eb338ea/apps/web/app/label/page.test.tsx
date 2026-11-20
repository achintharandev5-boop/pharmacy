import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LabelPage from './page';
import { useLabelStore, createDefaultLabel } from '../../store/labelStore';
import { createPrescriptionRecord } from '../actions/prescriptions';

vi.mock('../actions/prescriptions', () => ({ createPrescriptionRecord: vi.fn(), logPrescriptionPrint: vi.fn() }));
vi.mock('../../components/label/ProductToolbar', () => ({ ProductToolbar: () => null }));
vi.mock('../../components/CustomerSearchPanel', () => ({ CustomerSearchPanel: () => null }));
// Bypass the review component's disabled button to verify the final action has its own guard.
vi.mock('../../components/label/LabelActionPage', () => ({
  LabelActionPage: ({ onPrintAndSave, onSave }: { onPrintAndSave: () => void; onSave: () => void }) => <><button onClick={onPrintAndSave}>Request print</button><button onClick={onSave}>Request save</button></>,
}));

const state = () => useLabelStore.getState();
describe('Weekly final entry points', () => {
  it.each(['WEEKLY', 'DAILY', 'EVENING', 'EQUAL', 'UNEQUAL', 'STAT'])('saves %s with independent Weekly metadata and shared exact text', async pattern => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10;
    draft.additionalInstructions = [...(pattern === 'STAT' ? ['STAT'] : []), 'WEEKLY', ...(['DAILY', 'EVENING'].includes(pattern) ? [pattern] : []), 'EMPTY STOMACH', 'TAKE'];
    draft.weeklyDosage = { qty: 1.5, isFraction: true, confirmed: pattern !== 'WEEKLY' };
    if (pattern === 'DAILY' || pattern === 'EVENING') draft.frequencyDosage = { qty: 0.5, isFraction: true };
    if (pattern === 'EQUAL' || pattern === 'UNEQUAL') { draft.dosage.morning = { qty: 1, isFraction: false }; draft.dosage.night = { qty: pattern === 'EQUAL' ? 1 : 0.5, isFraction: pattern !== 'EQUAL' }; }
    if (pattern === 'STAT') draft.stat = { qty: 2, isFraction: false, followUp: 'WEEKLY' };
    state().restoreLabel(draft);
    const expected = pattern === 'WEEKLY' ? 'සතියකට වරක් 1½ හිස් බඩ ගන්න' : pattern === 'DAILY' ? 'සතියකට වරක් දිනකට ½ හිස් බඩ ගන්න' : pattern === 'EVENING' ? 'සතියකට වරක් ½ හවසට හිස් බඩ ගන්න' : pattern === 'EQUAL' ? 'කරල් 1 සතියකට වරක් හිස් බඩ ගන්න' : pattern === 'STAT' ? 'පළමුව පමණක් 2 ගන්න ඉන්පසු, සතියකට වරක් 1½ හිස් බඩ ගන්න' : 'සතියකට වරක් උදේට 1  |  රාත්‍රියට ½ හිස් බඩ ගන්න';
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ weekly: draft.weeklyDosage, finalInstructionText: expected, dosage: { morning: draft.dosage.morning.qty, lunch: 0, night: draft.dosage.night.qty } })] }), expect.any(String)));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });

  it.each(['Request save', 'Request print'].flatMap(action => ['QUANTITY', 'CONFIRMATION', 'ORDER', 'INTERVAL', 'EOD', 'ACTION', 'TYPE', 'SAM', 'PENDING'].map(problem => [action, problem])))('%s rejects Weekly %s changed after review before any API write', (action, problem) => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => {
      const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10;
      draft.weeklyDosage = { qty: 1, isFraction: false, confirmed: true };
      draft.additionalInstructions = ['WEEKLY', 'EMPTY STOMACH', 'TAKE'];
      if (problem === 'QUANTITY') draft.weeklyDosage.qty = NaN;
      if (problem === 'CONFIRMATION') { draft.weeklyDosage.confirmed = false; draft.dosage.morning.qty = 1; }
      if (problem === 'ORDER') { draft.additionalInstructions = ['DAILY', 'WEEKLY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage.qty = 1; }
      if (problem === 'INTERVAL') { draft.additionalInstructions.push('6H'); draft.frequencyDosage.qty = 1; }
      if (problem === 'EOD') draft.additionalInstructions.unshift('EOD');
      if (problem === 'ACTION') draft.additionalInstructions = ['WEEKLY', 'EMPTY STOMACH'];
      if (problem === 'TYPE') { draft.dosage.morning.qty = 1; draft.dosage.night.qty = 1; draft.product!.product_type = null; }
      if (problem === 'SAM') draft.additionalInstructions = ['WEEKLY', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
      state().restoreLabel(draft);
      if (problem === 'PENDING') { state().openNumberPad('weekly'); state().appendDigit('9'); }
    });
    fireEvent.click(screen.getByRole('button', { name: action })); expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity])('DONE rejects invalid Weekly quantity %s', qty => {
    state().restoreLabel({ ...createDefaultLabel(), product: state().product, productQuantity: 10, additionalInstructions: ['WEEKLY', 'EMPTY STOMACH', 'TAKE'], weeklyDosage: { qty, isFraction: false } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});
describe('Daily final entry points', () => {
  it.each(['DAILY', 'STAT', 'EOD', 'WEEKLY'])('saves %s with the independent Daily quantity and exact generated text', async modifier => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: [...(modifier === 'DAILY' ? [] : [modifier]), 'DAILY', 'EMPTY STOMACH', 'GIVE'],
      weeklyDosage: modifier === 'WEEKLY' ? { qty: 2, isFraction: false, confirmed: true } : undefined, stat: modifier === 'STAT' ? { qty: 2.5, isFraction: true, followUp: 'DAILY' } : null, frequencyDosage: { qty: 0.5, isFraction: true } });
    const expected = `${modifier === 'STAT' ? 'පළමුව පමණක් 2½ ගන්න ඉන්පසු, ' : modifier === 'EOD' ? 'දිනක් හැර දිනක්, ' : modifier === 'WEEKLY' ? 'සතියකට වරක් ' : ''}දිනකට ½ හිස් බඩ දෙන්න`;
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ frequency: 'DAILY', frequencyQty: 0.5, finalInstructionText: expected })] }), expect.any(String)));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'].flatMap(action => ['QUANTITY', 'INTERVAL', 'EVENING', 'DIGITAL', 'ORDER', 'ACTION', 'SAM'].map(problem => [action, problem])))('%s rejects Daily %s changed after review before API writes', (action, problem) => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => {
      const changed = structuredClone(state().labels[0]); changed.additionalInstructions = ['DAILY', 'EMPTY STOMACH', 'TAKE']; changed.frequencyDosage = { qty: 1, isFraction: false };
      if (problem === 'QUANTITY') changed.frequencyDosage.qty = Infinity;
      if (problem === 'INTERVAL') changed.additionalInstructions.push('8H');
      if (problem === 'EVENING') changed.additionalInstructions.push('EVENING');
      if (problem === 'DIGITAL') changed.dosage.morning.qty = 1;
      if (problem === 'ORDER') changed.additionalInstructions.push('EOD');
      if (problem === 'ACTION') changed.additionalInstructions = ['DAILY', 'EMPTY STOMACH'];
      if (problem === 'SAM') changed.additionalInstructions = ['DAILY', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
      state().restoreLabel(changed);
    });
    fireEvent.click(screen.getByRole('button', { name: action })); expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity])('DONE refuses Daily quantity %s', qty => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['DAILY', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: { qty, isFraction: false } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});
describe('Evening final entry points', () => {
  it.each(['ALONE', 'EQUAL', 'UNEQUAL'])('saves Evening %s with independent quantity columns and exact text', async pattern => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    const dosage = pattern === 'ALONE' ? [0, 0, 0] : pattern === 'EQUAL' ? [1.5, 1.5, 1.5] : [1, 2, 3];
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EVENING', 'EMPTY STOMACH', 'GIVE'],
      frequencyDosage: { qty: 1.5, isFraction: true, confirmed: pattern !== 'ALONE' },
      dosage: { morning: { qty: dosage[0], isFraction: true }, lunch: { qty: dosage[1], isFraction: true }, night: { qty: dosage[2], isFraction: true } } });
    const expected = pattern === 'ALONE' ? '1½ හවසට හිස් බඩ දෙන්න' : pattern === 'EQUAL' ? 'කරල් 1½ බැගින් දිනකට හතර වරක් හිස් බඩ දෙන්න' : 'උදේට 1  |  දවල් 2  |  හවසට 1½  |  රාත්‍රියට 3 | හිස් බඩ දෙන්න';
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ frequency: 'EVENING', frequencyQty: 1.5, dosage: { morning: dosage[0], lunch: dosage[1], night: dosage[2] }, finalInstructionText: expected })] }), expect.any(String)));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'].flatMap(action => ['QUANTITY', 'CONFIRMATION', 'INTERVAL', 'DAILY', 'TYPE', 'ACTION', 'SAM'].map(problem => [action, problem])))('%s rejects Evening %s changed after review', (action, problem) => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => {
      const changed = structuredClone(state().labels[0]); changed.additionalInstructions = ['EVENING', 'EMPTY STOMACH', 'TAKE']; changed.frequencyDosage = { qty: 1, isFraction: false, confirmed: true };
      changed.dosage = { morning: { qty: 1, isFraction: false }, lunch: { qty: 1, isFraction: false }, night: { qty: 1, isFraction: false } };
      if (problem === 'QUANTITY') changed.frequencyDosage.qty = Infinity;
      if (problem === 'CONFIRMATION') changed.frequencyDosage.confirmed = false;
      if (problem === 'INTERVAL') changed.additionalInstructions.push('6H');
      if (problem === 'DAILY') changed.additionalInstructions.push('DAILY');
      if (problem === 'TYPE') changed.product!.product_type = null;
      if (problem === 'ACTION') changed.additionalInstructions = ['EVENING', 'EMPTY STOMACH'];
      if (problem === 'SAM') changed.additionalInstructions = ['EVENING', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
      state().restoreLabel(changed);
    });
    fireEvent.click(screen.getByRole('button', { name: action })); expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity])('DONE rejects Evening quantity %s', qty => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EVENING', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: { qty, isFraction: false } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});
describe('Digital Label final entry points', () => {
  it.each([[1.5, 0, 0.5], [0.5, 1.5, 2], [0.5, 0.5, 0.5]])('saves structured %j/%j/%j quantities and matching generated text', async (morning, lunch, night) => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH', 'GIVE'], frequencyDosage: { qty: 0, isFraction: false },
      dosage: { morning: { qty: morning, isFraction: true }, lunch: { qty: lunch, isFraction: true }, night: { qty: night, isFraction: true } } });
    const expected = morning === lunch && lunch === night ? 'කරල් ½ බැගින් දිනකට 3 වරක් හිස් බඩ දෙන්න'
      : morning === 1.5 ? 'උදේට 1½  |  රාත්‍රියට ½ | හිස් බඩ දෙන්න' : 'උදේට ½  |  දවල් 1½  |  රාත්‍රියට 2 | හිස් බඩ දෙන්න';
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ dosage: { morning, lunch, night }, finalInstructionText: expected })] }), expect.any(String)));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'].flatMap(action => ['NEGATIVE', 'INFINITE', 'DAILY', 'INTERVAL', 'TYPE', 'ACTION', 'LEGACY', 'SAM'].map(problem => [action, problem])))('%s rejects latest invalid Digital Label %s before any API call', (action, problem) => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => {
      const changed = structuredClone(state().labels[0]); changed.additionalInstructions = ['EMPTY STOMACH', 'TAKE']; changed.frequencyDosage.qty = 0;
      changed.dosage = { morning: { qty: 1, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 1, isFraction: false } };
      if (problem === 'NEGATIVE') changed.dosage.night.qty = -1;
      if (problem === 'INFINITE') changed.dosage.night.qty = Infinity;
      if (problem === 'DAILY') changed.additionalInstructions.push('DAILY');
      if (problem === 'INTERVAL') changed.additionalInstructions.push('8H');
      if (problem === 'TYPE') changed.product!.product_type = null;
      if (problem === 'ACTION') changed.additionalInstructions = ['EMPTY STOMACH'];
      if (problem === 'LEGACY') changed.additionalInstructions.push('BD', 'TDS');
      if (problem === 'SAM') changed.additionalInstructions = ['CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
      state().restoreLabel(changed);
    });
    fireEvent.click(screen.getByRole('button', { name: action })); expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([-1, NaN, Infinity])('DONE rejects invalid Digital Label quantity %s', qty => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH', 'TAKE'], dosage: { morning: { qty, isFraction: false }, lunch: { qty: 0, isFraction: false }, night: { qty: 1, isFraction: false } } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});
describe('interval final entry points', () => {
  it.each(['8H', '6H', '5H'])('saves the exact %s instruction and mixed quantity', async code => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: [code, 'EMPTY STOMACH', 'GIVE'], frequencyDosage: { qty: 1.5, isFraction: true } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({
      frequency: code, frequencyQty: 1.5, finalInstructionText: `කරල් 1½ බැගින් පැය ${code[0]}කට වරක් හිස් බඩ දෙන්න`,
    })] }), expect.any(String)));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });

  it.each(['Request save', 'Request print'].flatMap(action => ['QUANTITY', 'DIGITAL', 'MULTIPLE', 'TYPE', 'ACTION', 'SAM'].map(problem => [action, problem])))('%s rechecks %s after review before any API write', (action, problem) => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => {
      const changed = structuredClone(state().labels[0]);
      if (problem === 'QUANTITY') changed.frequencyDosage.qty = Infinity;
      if (problem === 'DIGITAL') changed.dosage.morning.qty = 1;
      if (problem === 'MULTIPLE') changed.additionalInstructions.push('8H');
      if (problem === 'TYPE') changed.product!.product_type = null;
      if (problem === 'ACTION') changed.additionalInstructions = ['6H', 'AFTER'];
      if (problem === 'SAM') changed.additionalInstructions = ['6H', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'];
      state().restoreLabel(changed);
    });
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed: label 1:/)).toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each([0, NaN, Infinity])('DONE refuses interval quantity %s', qty => {
    state().restoreLabel({ ...state().labels[0], frequencyDosage: { qty, isFraction: false } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  state().allClear();
  state().restoreLabel({ ...createDefaultLabel(),
    product: { id: 'medicine', name: 'Medicine', product_type: 'Karal' },
    productQuantity: 10, frequencyDosage: { qty: 1, isFraction: false },
    additionalInstructions: ['6H', 'TAKE', 'AFTER'],
  });
});

describe('label validation at final entry points', () => {
  it('saves the quantity-bearing STAT prefix and independent follow-up text', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], stat: { qty: 2.5, isFraction: true, followUp: '8H' },
      additionalInstructions: ['STAT', '8H', 'EMPTY STOMACH', 'GIVE'], frequencyDosage: { qty: 0.5, isFraction: true } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ stat: expect.objectContaining({ qty: 2.5 }), frequencyQty: 0.5,
        finalInstructionText: 'පළමුව පමණක් 2½ ගන්න ඉන්පසු, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ දෙන්න',
      })] }), expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s refuses STAT quantity changed to zero after review', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], stat: { qty: 0, isFraction: false, followUp: '6H' } }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*positive STAT quantity/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s refuses STAT without a real follow-up', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['STAT'], stat: { qty: 2, isFraction: false, followUp: '8H' } }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*follow-up schedule/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s refuses reversed STAT order after review', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'STAT', 'TAKE', 'AFTER'], stat: { qty: 2, isFraction: false, followUp: '6H' } }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Select STAT before/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s refuses unconfirmed STAT editing after review', action => {
    state().restoreLabel({ ...state().labels[0], stat: { qty: 2, isFraction: false, followUp: '6H' } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => { state().startStat(); state().incrementDosage('stat'); });
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Confirm or cancel the STAT quantity/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([0, 2])('DONE refuses STAT quantity %s without an approved follow-up', qty => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['STAT'], stat: { qty, isFraction: false, followUp: null } });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([false, true])('saves EOD with interval=%s using the shared text and no EOD frequency', async interval => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: interval ? ['EOD', '8H', 'EMPTY STOMACH', 'GIVE'] : ['EOD'],
      frequencyDosage: { qty: interval ? 0.5 : 0, isFraction: interval } });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({
        frequency: interval ? '8H' : undefined, frequencyQty: interval ? 0.5 : undefined,
        finalInstructionText: interval ? expect.stringContaining('දිනක් හැර දිනක්, කරල් ½ බැගින් පැය 8කට වරක් හිස් බඩ දෙන්න') : 'දිනක් හැර දිනක්',
      })] }), expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s rejects EOD added after an interval, before an API write', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'EOD', 'TAKE', 'AFTER'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Select EOD before/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s rejects unsupported EOD + Weekly after review', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD', 'WEEKLY', 'TAKE', 'AFTER'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*EOD cannot be combined/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s rejects legacy EOD-only quantity after review', action => {
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EOD'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*EOD has no quantity/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it('DONE rejects reversed EOD order', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'EOD', 'TAKE', 'AFTER'] });
    render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([['TAKE', 'කෑමට පසු ගන්න'], ['GIVE', 'කෑමට පසු දෙන්න']])('saves the exact ordinary %s instruction', async (action, sentence) => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', action, 'AFTER'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ finalInstructionText: expect.stringContaining(`කරල් 1 බැගින් පැය 6කට වරක් ${sentence}`) })] }),
      expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s refuses missing ordinary timing after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'GIVE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose BEFORE or AFTER/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s refuses missing ordinary USB after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'AFTER'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose TAKE or GIVE/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s refuses conflicting legacy actions after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'TAKE', 'GIVE', 'AFTER'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose either TAKE or GIVE/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each([['6H'], ['6H', 'TAKE'], ['6H', 'TAKE', 'GIVE', 'AFTER']])('DONE refuses incomplete/conflicting USB %j', (...codes) => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: codes });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('sends the same Keep in Mouth instruction to the prescription save boundary', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'EMPTY STOMACH', 'KEEP IN MOUTH', 'GIVE'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ finalInstructionText: expect.stringContaining('කරල් 1 බැගින් පැය 6කට වරක් හිස් බඩ දිව මත තබන්න') })] }),
      expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s refuses incomplete Keep in Mouth after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'KEEP IN MOUTH'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose TAKE or GIVE/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each(['Request save', 'Request print'])('%s refuses incompatible restored Keep in Mouth after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'KEEP IN MOUTH', 'EMPTY STOMACH', 'TAKE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Keep in Mouth then Empty Stomach/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('DONE refuses incomplete Keep in Mouth', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['KEEP IN MOUTH'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it('sends the same Empty Stomach instruction to the prescription save boundary', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'EMPTY STOMACH', 'GIVE'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ finalInstructionText: expect.stringContaining('කරල් 1 බැගින් පැය 6කට වරක් හිස් බඩ දෙන්න') })] }),
      expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s refuses incomplete Empty Stomach after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'EMPTY STOMACH'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose TAKE or GIVE/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each(['Request save', 'Request print'])('%s refuses incompatible restored Empty Stomach after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Chewable then Empty Stomach/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('DONE refuses incomplete Empty Stomach', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['EMPTY STOMACH'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it('sends the same With Food instruction to the prescription save boundary', async () => {
    vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'WITH FOOD', 'GIVE'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
    await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ finalInstructionText: expect.stringContaining('කරල් 1 බැගින් පැය 6කට වරක් කෑමත් සමඟ දෙන්න') })] }),
      expect.any(String),
    ));
    expect(await screen.findByText(/Simulated save failure/)).toBeInTheDocument();
  });
  it.each(['Request save', 'Request print'])('%s refuses incomplete With Food after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'WITH FOOD'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose TAKE or GIVE/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each(['Request save', 'Request print'])('%s refuses incompatible restored With Food after review', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'WITH FOOD', 'KEEP IN MOUTH', 'TAKE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*With Food cannot be combined/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('DONE refuses incomplete With Food', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['WITH FOOD'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it.each(['Request save', 'Request print'])('%s rejects incomplete Dissolve after review before any API call', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'DISSOLVE AND DRINK', 'TAKE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Choose BEFORE or AFTER/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each(['Request save', 'Request print'])('%s rejects reversed Dissolve after review before any API call', action => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: ['6H', 'DISSOLVE AND DRINK', 'EMPTY STOMACH', 'TAKE'] }));
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByText(/Not saved, nothing printed:.*Dissolve and Drink then Empty Stomach/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('DONE refuses incomplete Dissolve', () => {
    state().restoreLabel({ ...state().labels[0], additionalInstructions: ['DISSOLVE AND DRINK', 'TAKE'] });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
  it('DONE refuses a product-type-dependent label with a missing type', () => {
    state().setProduct({ id: 'medicine', name: 'Medicine', product_type: null });
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.queryByRole('button', { name: 'Request print' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('Product type is missing'))).toBe(true);
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it('the final print action refuses a type invalidated after review, before any save', () => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    expect(screen.getByRole('button', { name: 'Request print' })).toBeInTheDocument();
    act(() => state().setProduct({ id: 'medicine', name: 'Medicine', product_type: 'Unknown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    expect(screen.getByText(/Not saved, nothing printed:.*Unsupported product type/)).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });

  it.each([
    [['6H', 'CHEWABLE', 'TAKE'], 'Choose BEFORE or AFTER'],
    [['6H', 'CHEWABLE', 'EMPTY STOMACH', 'TAKE'], 'Chewable then Empty Stomach'],
  ])('the final print action rejects invalidated Chewing %j before saving', (instructions, message) => {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
    act(() => state().restoreLabel({ ...state().labels[0], additionalInstructions: instructions }));
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    expect(screen.getByText(new RegExp(`Not saved, nothing printed:.*${message}`))).toBeInTheDocument();
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
  });
});


describe('Name of Days final boundaries', () => {
 it.each(['Request save', 'Request print'].flatMap(action => ['UNKNOWN', 'DUPLICATE', 'WEEKLY', 'NO_SCHEDULE', 'UNCONFIRMED', 'NO_ACTION', 'NO_QUANTITY', 'PENDING'].map(problem => ({ action, problem }))))('$action refuses weekday $problem changed after review before an API write', ({ action, problem }) => {
  render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
  act(() => {
   const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10;
   draft.selectedDaysOfWeek = ['MONDAY']; draft.daysConfirmed = true;
   draft.additionalInstructions = ['DAILY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage.qty = 1;
   if (problem === 'UNKNOWN') draft.selectedDaysOfWeek = ['BAD'];
   if (problem === 'DUPLICATE') draft.selectedDaysOfWeek.push('MONDAY');
   if (problem === 'WEEKLY') draft.additionalInstructions.unshift('WEEKLY');
   if (problem === 'NO_SCHEDULE') draft.additionalInstructions = ['EMPTY STOMACH', 'TAKE'];
   if (problem === 'UNCONFIRMED') draft.daysConfirmed = false;
   if (problem === 'NO_ACTION') draft.additionalInstructions = ['DAILY', 'EMPTY STOMACH'];
   if (problem === 'NO_QUANTITY') draft.frequencyDosage.qty = 0;
   state().restoreLabel(draft); if (problem === 'PENDING') state().openDaysOfWeekPanel();
  });
  fireEvent.click(screen.getByRole('button', { name: action })); expect(createPrescriptionRecord).not.toHaveBeenCalled();
 });
 it('saves the exact Sinhala days prefix and existing selected-day payload', async () => {
  vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
  const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10;
  draft.selectedDaysOfWeek = ['SUNDAY', 'WEDNESDAY', 'FRIDAY']; draft.daysConfirmed = true;
  draft.additionalInstructions = ['DAILY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage.qty = 0.5; draft.frequencyDosage.isFraction = true;
  state().restoreLabel(draft); render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
  await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ selectedDaysOfWeek: draft.selectedDaysOfWeek, finalInstructionText: 'ඉරිදා, බදාදා සහ සිකුරාදා දිනකට ½ හිස් බඩ ගන්න' })] }), expect.any(String)));
 });
});

it('UI testing previews the real label without prescription or print-log writes', async () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  try {
    render(<LabelPage />);
    fireEvent.click(screen.getByRole('button', { name: /Done .* review and print labels/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Request print' }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(createPrescriptionRecord).not.toHaveBeenCalled();
    const { logPrescriptionPrint } = await import('../actions/prescriptions');
    expect(logPrescriptionPrint).not.toHaveBeenCalled();
    expect(screen.getByText(/Operation was not saved or submitted/)).toBeInTheDocument();
  } finally { print.mockRestore(); vi.unstubAllEnvs(); }
});


describe('Till to the Day final entry points', () => {
 it.each(['Request save', 'Request print'].flatMap(action => ['START', 'END', 'UNKNOWN', 'CONFIRMATION', 'MARKER', 'DUPLICATE', 'ORDER', 'INDIVIDUAL_DAYS', 'WEEKLY', 'STAT', 'EOD', 'INTERVAL', 'ACTION', 'QUANTITY', 'PENDING', 'LEGACY'].map(problem => ({ action, problem }))))('$action rejects range $problem changed after review before any API write', ({ action, problem }) => {
  render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' }));
  act(() => {
   const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10; draft.weekdayRange = { start: 'MONDAY', end: 'FRIDAY', confirmed: true }; draft.additionalInstructions = ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage.qty = 1;
   if (problem === 'START') draft.weekdayRange.start = null;
   if (problem === 'END') draft.weekdayRange.end = null;
   if (problem === 'UNKNOWN') draft.weekdayRange.end = 'BAD';
   if (problem === 'CONFIRMATION') draft.weekdayRange.confirmed = false;
   if (problem === 'MARKER') draft.additionalInstructions.shift();
   if (problem === 'DUPLICATE') draft.additionalInstructions.push('TILL TO DAY');
   if (problem === 'ORDER') draft.additionalInstructions = ['DAILY', 'TILL TO DAY', 'EMPTY STOMACH', 'TAKE'];
   if (problem === 'INDIVIDUAL_DAYS') draft.selectedDaysOfWeek = ['SUNDAY'];
   if (problem === 'WEEKLY') draft.additionalInstructions.push('WEEKLY');
   if (problem === 'STAT') { draft.additionalInstructions.unshift('STAT'); draft.stat = { qty: 1, isFraction: false, followUp: 'DAILY' }; }
   if (problem === 'EOD') draft.additionalInstructions.unshift('EOD');
   if (problem === 'INTERVAL') draft.additionalInstructions.push('6H');
   if (problem === 'ACTION') draft.additionalInstructions = ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH'];
   if (problem === 'QUANTITY') draft.frequencyDosage.qty = 0;
   if (problem === 'LEGACY') draft.additionalInstructions.push('TILL DATE');
   state().restoreLabel(draft); if (problem === 'PENDING') state().openDaysOfWeekPanel();
  });
  fireEvent.click(screen.getByRole('button', { name: action })); expect(createPrescriptionRecord).not.toHaveBeenCalled();
 });
 it.each(['FRIDAY', 'MONDAY'])('saves exact range text and separate %s endpoint metadata without writing live data', async end => {
  vi.mocked(createPrescriptionRecord).mockResolvedValue({ ok: false, error: 'Simulated save failure' });
  const draft = createDefaultLabel(); draft.product = state().product; draft.productQuantity = 10; draft.weekdayRange = { start: 'MONDAY', end, confirmed: true }; draft.additionalInstructions = ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH', 'TAKE']; draft.frequencyDosage = { qty: 0.5, isFraction: true };
  state().restoreLabel(draft); render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); fireEvent.click(screen.getByRole('button', { name: 'Request save' }));
  await waitFor(() => expect(createPrescriptionRecord).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ weekdayRange: draft.weekdayRange, selectedDaysOfWeek: [], finalInstructionText: `සඳුදා සිට ${end === 'FRIDAY' ? 'සිකුරාදා' : 'සඳුදා'} දක්වා දිනකට ½ හිස් බඩ ගන්න` })] }), expect.any(String)));
 });
 it.each([null, { start: 'MONDAY', end: null, confirmed: false }, { start: null, end: 'FRIDAY', confirmed: true }])('DONE rejects incomplete range %j', weekdayRange => {
  state().restoreLabel({ ...createDefaultLabel(), product: state().product, productQuantity: 10, weekdayRange, additionalInstructions: ['TILL TO DAY', 'DAILY', 'EMPTY STOMACH', 'TAKE'], frequencyDosage: { qty: 1, isFraction: false } });
  render(<LabelPage />); fireEvent.click(screen.getByRole('button', { name: 'Done — review and print labels' })); expect(screen.queryByRole('button', { name: 'Request save' })).not.toBeInTheDocument(); expect(createPrescriptionRecord).not.toHaveBeenCalled();
 });
});
