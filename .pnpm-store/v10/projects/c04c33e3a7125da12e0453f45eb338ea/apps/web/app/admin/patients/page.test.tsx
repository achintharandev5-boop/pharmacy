import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PatientsPage from './page';
import { listPatients } from '@/app/actions/customers';
import { ToastProvider } from '@/components/ui';

const renderPage = () => render(<ToastProvider><PatientsPage /></ToastProvider>);

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/app/actions/customers', () => ({
  listPatients: vi.fn(),
  createNewPerson: vi.fn(),
  updatePatient: vi.fn(),
  findDuplicatePatients: vi.fn(),
}));

const patient = (i: number) => ({ id: `id-${i}`, name: `Patient ${i}`, phone_number: `07700000${String(i).padStart(2, '0')}` });
const pageOf = (page: number, total: number, size = 25) => ({
  ok: true as const,
  data: {
    items: Array.from({ length: Math.max(0, Math.min(size, total - (page - 1) * size)) }, (_, i) => patient((page - 1) * size + i)),
    total,
    page,
    pageSize: size,
  },
});

beforeEach(() => vi.clearAllMocks());

describe('patient register list', () => {
  it('loads one page from the server and pages through the register', async () => {
    vi.mocked(listPatients).mockImplementation(async ({ page = 1 }) => pageOf(page, 60));
    renderPage();
    expect(await screen.findByText('Patient 0')).toBeInTheDocument();
    expect(screen.getByText('60 patients')).toBeInTheDocument();
    expect(listPatients).toHaveBeenLastCalledWith({ q: '', page: 1, pageSize: 25 });

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('Patient 25')).toBeInTheDocument();
    expect(listPatients).toHaveBeenLastCalledWith({ q: '', page: 2, pageSize: 25 });
  });

  it('searches on the server after typing pauses, from the first page', async () => {
    vi.mocked(listPatients).mockImplementation(async ({ q = '', page = 1 }) => (q ? pageOf(1, 1) : pageOf(page, 60)));
    renderPage();
    await screen.findByText('Patient 0');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await screen.findByText('Patient 25');

    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'nimal' } });
    await waitFor(() => expect(listPatients).toHaveBeenLastCalledWith({ q: 'nimal', page: 1, pageSize: 25 }));
    expect(await screen.findByText('1 matching patient')).toBeInTheDocument();
  });

  it('distinguishes an empty register from a search with no matches', async () => {
    vi.mocked(listPatients).mockImplementation(async () => ({ ok: true as const, data: { items: [], total: 0, page: 1, pageSize: 25 } }));
    renderPage();
    expect(await screen.findByText('No patients registered yet')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search patients'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No patients match your search')).toBeInTheDocument();
  });

  it('shows a failed load as an error with Retry, never as an empty register', async () => {
    vi.mocked(listPatients).mockResolvedValueOnce({ ok: false, error: 'The pharmacy server is unreachable.' });
    vi.mocked(listPatients).mockResolvedValue(pageOf(1, 3));
    renderPage();
    expect(await screen.findByText('Could not load patients')).toBeInTheDocument();
    expect(screen.queryByText('No patients registered yet')).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Retry/ })));
    expect(await screen.findByText('Patient 0')).toBeInTheDocument();
  });
});
