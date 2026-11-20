import React from 'react';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLogPage from './page';
import { getAuditEvent, listAuditEvents } from '@/app/actions/audit';
import { getCurrentUser } from '@/app/actions/auth';
import { EMPTY_FILTERS, type AuditEvent } from '@/lib/auditLog';

// The full suite runs many files in parallel; the 1 s default is too short under that load.
configure({ asyncUtilTimeout: 5000 });

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/app/actions/audit', () => ({ listAuditEvents: vi.fn(), getAuditEvent: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ getCurrentUser: vi.fn() }));

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PATIENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const event = (i: number, over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: String(i),
  occurred_at: '2026-10-30T08:00:00+00:00',
  action: 'UPDATE',
  entity_type: 'customers',
  module: 'Patients',
  entity_id: PATIENT_ID,
  changed_fields: ['name', 'phone_number'],
  withheld_fields: 0,
  actor: null,
  ...over,
});
const pageOf = (page: number, total: number, size = 25) => ({
  ok: true as const,
  data: {
    items: Array.from({ length: Math.max(0, Math.min(size, total - (page - 1) * size)) }, (_, i) => event(total - ((page - 1) * size + i))),
    total,
    page,
    pageSize: size,
  },
});
const as = (role: 'admin' | 'pharmacist' | 'staff' | 'cashier' | null) =>
  vi.mocked(getCurrentUser).mockResolvedValue({ ok: true, data: { id: 'u1', email: 'u@pharmacy.local', role } });

const table = () => screen.getByRole('table', { name: 'Audit events, newest first' });
const lastFilters = () => vi.mocked(listAuditEvents).mock.lastCall![0];

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = '';
  as('admin');
  vi.mocked(listAuditEvents).mockImplementation(async (_f, page) => pageOf(page, 3));
});

describe('access', () => {
  it.each([
    ['pharmacist', 'pharmacist'],
    ['staff', 'staff'],
    ['cashier', 'cashier'],
    ['an account without a role', null],
  ] as const)('shows %s an administrators-only message and never requests the log', async (_label, role) => {
    as(role);
    render(<AuditLogPage />);
    expect(await screen.findByText('Administrators only')).toBeInTheDocument();
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with Retry when the account cannot be confirmed', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ ok: false, status: 401, error: 'Your session has expired. Please sign in again.' });
    render(<AuditLogPage />);
    expect(await screen.findByText('Could not confirm your access')).toBeInTheDocument();
    expect(listAuditEvents).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows the API refusal if the server denies an administrator', async () => {
    vi.mocked(listAuditEvents).mockResolvedValue({ ok: false, status: 403, error: 'You do not have permission to perform this action.' });
    render(<AuditLogPage />);
    expect(await screen.findByText('Could not load the audit log')).toBeInTheDocument();
    expect(screen.getByText('You do not have permission to perform this action.')).toBeInTheDocument();
  });
});

describe('list', () => {
  it('shows a loading state, then the events with every column', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof listAuditEvents>>) => void;
    vi.mocked(listAuditEvents).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<AuditLogPage />);
    expect(await screen.findByText('Loading audit log…')).toBeInTheDocument();
    resolve({
      ok: true,
      data: {
        items: [
          event(2, { actor: { id: ADMIN_ID, name: 'Nimal Admin' } }),
          event(1, { action: 'INSERT', entity_type: 'pharmacy_settings', module: 'Pharmacy settings', entity_id: 'true', changed_fields: null }),
        ],
        total: 2,
        page: 1,
        pageSize: 25,
      },
    });
    const t = await screen.findByRole('table');
    const headers = within(t).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Date and time', 'Action', 'Module', 'User', 'Record', 'Changed fields', 'Details']);
    const rows = within(t).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Updated')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Patients')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Nimal Admin')).toBeInTheDocument();
    expect(within(rows[0]).getByText('cccccccc')).toBeInTheDocument();
    expect(within(rows[0]).getByText('name, phone_number')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Created')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Not recorded')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Pharmacy settings record')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
    expect(listAuditEvents).toHaveBeenCalledWith(EMPTY_FILTERS, 1, 25);
  });

  it('pages through the log on the server', async () => {
    vi.mocked(listAuditEvents).mockImplementation(async (_f, page) => pageOf(page, 60));
    render(<AuditLogPage />);
    await screen.findByRole('table');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(listAuditEvents).toHaveBeenLastCalledWith(EMPTY_FILTERS, 2, 25));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(within(table()).getAllByRole('row')).toHaveLength(26);
  });

  it('caps paging at the API limit and explains how to reach older events', async () => {
    vi.mocked(listAuditEvents).mockImplementation(async (_f, page) => ({ ...pageOf(page, 25), data: { ...pageOf(page, 25).data, total: 6000 } }));
    render(<AuditLogPage />);
    expect(await screen.findByText('Page 1 of 200')).toBeInTheDocument();
    expect(screen.getByText(/Only the newest 5,000 matching events/)).toBeInTheDocument();
  });

  it('shows an empty log as empty, not as an error', async () => {
    vi.mocked(listAuditEvents).mockResolvedValue({ ok: true, data: { items: [], total: 0, page: 1, pageSize: 25 } });
    render(<AuditLogPage />);
    expect(await screen.findByText('No audit events recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a failed load with Retry, never an empty log', async () => {
    vi.mocked(listAuditEvents).mockResolvedValueOnce({ ok: false, status: 503, error: 'The pharmacy server reported an error (status 503).' });
    render(<AuditLogPage />);
    expect(await screen.findByText('Could not load the audit log')).toBeInTheDocument();
    expect(screen.queryByText('No audit events recorded yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('treats a thrown request as a failure', async () => {
    vi.mocked(listAuditEvents).mockRejectedValueOnce(new Error('network'));
    render(<AuditLogPage />);
    expect(await screen.findByText('Could not load the audit log')).toBeInTheDocument();
  });

  it('offers no way to edit or delete an event', async () => {
    render(<AuditLogPage />);
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /edit|delete|remove/i })).not.toBeInTheDocument();
  });
});

describe('filters', () => {
  it('applies all filters together and starts again from the first page', async () => {
    vi.mocked(listAuditEvents).mockImplementation(async (_f, page) => pageOf(page, 60));
    render(<AuditLogPage />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await screen.findByText('Page 2 of 3');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-30' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'UPDATE' } });
    fireEvent.change(screen.getByLabelText('Module'), { target: { value: 'pharmacy_settings' } });
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'none' } });
    fireEvent.change(screen.getByLabelText('Record reference'), { target: { value: '  true ' } });
    expect(listAuditEvents).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(listAuditEvents).toHaveBeenLastCalledWith(
        { from: '2026-10-01', to: '2026-10-30', action: 'UPDATE', entity: 'pharmacy_settings', actor: 'none', record: 'true' },
        1,
        25,
      ),
    );
  });

  it('applies filters with the Enter key', async () => {
    render(<AuditLogPage />);
    await screen.findByRole('table');
    const record = screen.getByLabelText('Record reference');
    fireEvent.change(record, { target: { value: PATIENT_ID } });
    fireEvent.submit(record.closest('form')!);
    await waitFor(() => expect(lastFilters().record).toBe(PATIENT_ID));
  });

  it('explains invalid filters and sends no request', async () => {
    render(<AuditLogPage />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-30' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Record reference'), { target: { value: 'Kamal Perera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('The end date must be on or after the start date.')).toBeInTheDocument();
    expect(screen.getByText(/Enter a record id/)).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');
    expect(listAuditEvents).toHaveBeenCalledTimes(1);
  });

  it('shows a filtered empty result with a way to clear the filters', async () => {
    vi.mocked(listAuditEvents).mockImplementation(async (f) =>
      f.action ? { ok: true, data: { items: [], total: 0, page: 1, pageSize: 25 } } : pageOf(1, 3),
    );
    render(<AuditLogPage />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('No audit events match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(lastFilters()).toEqual(EMPTY_FILTERS);
    expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
  });

  it('starts from valid filters in the page address', async () => {
    nav.search = `entity=customers&record=${PATIENT_ID}&action=bogus`;
    render(<AuditLogPage />);
    await screen.findByRole('table');
    expect(listAuditEvents).toHaveBeenCalledWith({ ...EMPTY_FILTERS, entity: 'customers', record: PATIENT_ID }, 1, 25);
    expect((screen.getByLabelText('Module') as HTMLSelectElement).value).toBe('customers');
  });
});

describe('event details', () => {
  const openDetails = async (detail: AuditEvent) => {
    vi.mocked(getAuditEvent).mockResolvedValue({ ok: true, data: detail });
    render(<AuditLogPage />);
    await screen.findByRole('table');
    const opener = screen.getByRole('button', { name: 'Details of audit event 3' });
    opener.focus();
    fireEvent.click(opener);
    return screen.findByRole('dialog', { name: 'Audit event #3' });
  };

  it('shows only what the record holds, read-only', async () => {
    const dialog = await openDetails(
      event(3, {
        entity_type: 'pharmacy_settings',
        module: 'Pharmacy settings',
        entity_id: 'true',
        changed_fields: ['address', 'phone', 'updated_by'],
        actor: { id: ADMIN_ID, name: 'Nimal Admin' },
      }),
    );
    expect(getAuditEvent).toHaveBeenCalledWith('3');
    const d = within(dialog);
    await d.findByText('Nimal Admin');
    expect(d.getByText(ADMIN_ID)).toBeInTheDocument();
    expect(d.getByText('2026-10-30T08:00:00+00:00')).toBeInTheDocument();
    expect(d.getByText('pharmacy_settings')).toBeInTheDocument();
    expect(d.getByRole('link', { name: 'Pharmacy settings record' })).toHaveAttribute('href', '/admin/settings');
    const fields = d.getByRole('list', { name: 'Changed fields' });
    expect(within(fields).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['address', 'phone', 'updated_by']);
    expect(d.getByText('Previous and new values are not recorded')).toBeInTheDocument();
    expect(d.getByText(/cannot be edited or deleted/)).toBeInTheDocument();
    expect(d.queryByRole('textbox')).not.toBeInTheDocument();
    expect(d.queryByRole('button', { name: /edit|delete|remove|save/i })).not.toBeInTheDocument();
  });

  it('says so when the user was not recorded and when entries were withheld', async () => {
    const dialog = await openDetails(event(3, { withheld_fields: 2, changed_fields: ['name'] }));
    const d = within(dialog);
    expect(await d.findByText(/saved this change without a user/)).toBeInTheDocument();
    expect(d.getByText(/2 entries were withheld/)).toBeInTheDocument();
    expect(d.getByRole('link', { name: PATIENT_ID })).toHaveAttribute('href', `/admin/patients/${PATIENT_ID}`);
  });

  it('describes creations without inventing field values', async () => {
    const dialog = await openDetails(event(3, { action: 'INSERT', changed_fields: null }));
    expect(await within(dialog).findByText(/The record was created/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('list', { name: 'Changed fields' })).not.toBeInTheDocument();
  });

  it('shows a failed detail load with Retry', async () => {
    vi.mocked(getAuditEvent).mockResolvedValueOnce({ ok: false, status: 404, error: 'The audit event was not found.' });
    const dialog = await openDetails(event(3));
    expect(await within(dialog).findByText('Could not load this audit event')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Retry/ }));
    expect(await within(dialog).findByText('Previous and new values are not recorded')).toBeInTheDocument();
  });

  it('filters to every change of the same record', async () => {
    const dialog = await openDetails(event(3));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'All changes to this record' }));
    await waitFor(() => expect(lastFilters()).toEqual({ ...EMPTY_FILTERS, entity: 'customers', record: PATIENT_ID }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Record reference') as HTMLInputElement).value).toBe(PATIENT_ID);
  });

  it('filters to every change by the same user', async () => {
    const dialog = await openDetails(event(3, { actor: { id: ADMIN_ID, name: null } }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'All changes by this user' }));
    await waitFor(() => expect(lastFilters()).toEqual({ ...EMPTY_FILTERS, actor: ADMIN_ID }));
    expect((screen.getByLabelText('User') as HTMLSelectElement).selectedOptions[0].textContent).toBe('User aaaaaaaa');
  });

  it('closes with Escape and returns focus to the Details button', async () => {
    const dialog = await openDetails(event(3));
    const opener = screen.getByRole('button', { name: 'Details of audit event 3' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

describe('responsive and touch layout', () => {
  it('keeps the essential columns on phones and hides the secondary ones', async () => {
    render(<AuditLogPage />);
    const t = await screen.findByRole('table');
    const header = (name: string) => within(t).getByRole('columnheader', { name });
    for (const name of ['Date and time', 'Action', 'Module', 'Details']) expect(header(name)).not.toHaveClass('hidden');
    for (const name of ['User', 'Record', 'Changed fields']) expect(header(name)).toHaveClass('hidden', 'md:table-cell');
  });

  it('uses 40 px touch targets for row and filter actions', async () => {
    render(<AuditLogPage />);
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Details of audit event 3' })).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Apply filters' })).toHaveClass('h-11');
    expect(screen.getByLabelText('From')).toHaveClass('h-11');
  });

  it('stacks the filters in one column on phones', async () => {
    render(<AuditLogPage />);
    await screen.findByRole('table');
    expect(screen.getByRole('form', { name: 'Audit log filters' })).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
  });
});
