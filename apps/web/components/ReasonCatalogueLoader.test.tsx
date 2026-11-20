import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReasonCatalogueLoader } from './ReasonCatalogueLoader';
import { useLabelStore } from '@/store/labelStore';
import EditReasonsPage from '@/app/admin/reasons/page';
import { getReasons, createReason, editReason, deactivateReason } from '@/app/actions/reasons';
import { ReasonsPanel } from '@/app/label/ReasonsPanel';
import { buildFinalInstruction } from '@/lib/labelBuilder';
import { LabelCard } from './PrintableLabel';
import { readLocalReasons, writeLocalReasons, clearLocalReasons } from '@/lib/localReasons';
vi.mock('@/app/actions/reasons', () => ({ getReasons: vi.fn(), createReason: vi.fn(), editReason: vi.fn(), deactivateReason: vi.fn() }));
const row = { id: 'one', text: 'පරීක්ෂණය එක', is_active: true };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'false'); sessionStorage.clear(); useLabelStore.getState().setReasonCatalogue(null); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe('Reasons integration', () => {
  it('clears temporary catalogue on reset and never reads it outside UI testing mode', () => {
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
    writeLocalReasons([row]);
    expect(readLocalReasons()).toEqual([row]);
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'false');
    expect(readLocalReasons()).toEqual([]);
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
    clearLocalReasons();
    expect(readLocalReasons()).toEqual([]);
  });
  it('reports corrupt temporary catalogue data rather than inventing reasons', async () => {
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
    sessionStorage.setItem('pharmacy-ui-test-reasons-v1', JSON.stringify([null]));
    render(<ReasonCatalogueLoader />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load reasons');
    expect(useLabelStore.getState().reasonCatalogue).toBeNull();
    expect(getReasons).not.toHaveBeenCalled();
  });
  it('uses API-loaded multiple selections verbatim for Save and Print', async () => {
    useLabelStore.getState().allClear();
    const second = { ...row, id: 'two', text: 'පරීක්ෂණය දෙක' };
    vi.mocked(getReasons).mockResolvedValue({ ok: true, data: [row, second] });
    render(<ReasonCatalogueLoader />);
    await waitFor(() => expect(useLabelStore.getState().reasonCatalogue).toEqual([row.text, second.text]));
    useLabelStore.getState().openReasonsPanel();
    render(<ReasonsPanel />);
    for (const text of [row.text, second.text]) {
      const button = screen.getByRole('button', { name: text });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    const saved = buildFinalInstruction(useLabelStore.getState().labels[0]);
    expect(saved.reasons).toEqual([row.text, second.text]);
    expect(saved.finalInstructionText).toBe([row.text, second.text].join('\n'));
    const print = render(<LabelCard labelItem={saved} />);
    expect(Array.from(print.container.querySelectorAll('[data-reason-line]'), n => n.textContent)).toEqual(saved.reasons);
  });
  it('loads exact catalogue wording', async () => {
    vi.mocked(getReasons).mockResolvedValue({ ok: true, data: [row] });
    render(<ReasonCatalogueLoader />);
    await waitFor(() => expect(useLabelStore.getState().reasonCatalogue).toEqual([row.text]));
  });
  it('shows API errors, clears stale catalogue and retries', async () => {
    useLabelStore.getState().setReasonCatalogue(['stale']);
    vi.mocked(getReasons).mockResolvedValueOnce({ ok: false, error: 'Unavailable' }).mockResolvedValue({ ok: true, data: [] });
    render(<ReasonCatalogueLoader />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
    expect(useLabelStore.getState().reasonCatalogue).toBeNull();
    fireEvent.click(screen.getByText('Retry reasons'));
    await waitFor(() => expect(useLabelStore.getState().reasonCatalogue).toEqual([]));
  });
  it('shows empty Admin catalogue and validates entries', async () => {
    vi.mocked(getReasons).mockResolvedValue({ ok: true, data: [] });
    render(<EditReasonsPage />);
    expect(await screen.findByText(/No reasons configured/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add reason'));
    expect(screen.getByRole('alert')).toHaveTextContent('nonblank');
    expect(createReason).not.toHaveBeenCalled();
  });
  it('shows authorization failure without editing controls', async () => {
    vi.mocked(getReasons).mockResolvedValue({ ok: false, error: 'You do not have permission.' });
    render(<EditReasonsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('permission');
    expect(screen.queryByText('Add reason')).toBeNull();
  });
  it('retains entered wording and shows mutation errors', async () => {
    vi.mocked(getReasons).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(createReason).mockResolvedValue({ ok: false, error: 'Database unavailable' });
    render(<EditReasonsPage />);
    await screen.findByText(/No reasons configured/);
    fireEvent.change(screen.getByLabelText('Exact reason wording'), { target: { value: row.text } });
    fireEvent.click(screen.getByText('Add reason'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.getByLabelText('Exact reason wording')).toHaveValue(row.text);
    expect(screen.getByText(/No reasons configured/)).toBeInTheDocument();
  });
  it('creates, edits and deactivates through API actions', async () => {
    vi.mocked(getReasons).mockResolvedValue({ ok: true, data: [row] });
    vi.mocked(createReason).mockResolvedValue({ ok: true, data: row });
    vi.mocked(editReason).mockResolvedValue({ ok: true, data: row });
    vi.mocked(deactivateReason).mockResolvedValue({ ok: true, data: row });
    render(<EditReasonsPage />);
    await screen.findByText(row.text);
    fireEvent.change(screen.getByLabelText('Exact reason wording'), { target: { value: 'New' } });
    fireEvent.click(screen.getByText('Add reason'));
    await waitFor(() => expect(createReason).toHaveBeenCalledWith('New'));
    await waitFor(() => expect(screen.getByText('Edit')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Exact reason wording'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(editReason).toHaveBeenCalledWith('one', 'Changed'));
    await waitFor(() => expect(screen.getByText('Deactivate')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Deactivate'));
    await waitFor(() => expect(deactivateReason).toHaveBeenCalledWith('one'));
  });
  it('isolates explicitly entered UI test reasons without API operations', async () => {
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
    const admin = render(<EditReasonsPage />);
    await screen.findByText(/No reasons configured/);
    fireEvent.change(screen.getByLabelText('Exact reason wording'), { target: { value: row.text } });
    fireEvent.click(screen.getByText('Add reason'));
    await screen.findByText(row.text);
    expect(screen.getByText(/Not saved to the database/)).toBeInTheDocument();
    admin.unmount();
    render(<ReasonCatalogueLoader />);
    await waitFor(() => expect(useLabelStore.getState().reasonCatalogue).toEqual([row.text]));
    expect(getReasons).not.toHaveBeenCalled(); expect(createReason).not.toHaveBeenCalled();
  });
});

