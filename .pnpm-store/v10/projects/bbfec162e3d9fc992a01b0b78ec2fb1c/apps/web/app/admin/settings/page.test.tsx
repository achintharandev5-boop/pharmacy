import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './page';
import { getPharmacySettings, updatePharmacySettings } from '@/app/actions/settings';
import { getCurrentUser } from '@/app/actions/auth';
import { ToastProvider } from '@/components/ui';
import type { PharmacySettings } from '@/lib/pharmacySettings';

vi.mock('@/app/actions/settings', () => ({ getPharmacySettings: vi.fn(), updatePharmacySettings: vi.fn() }));
vi.mock('@/app/actions/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/app/actions/system', () => ({
  getSystemStatus: vi.fn(async () => ({
    checkedAt: '2026-10-30T08:00:00Z',
    api: { status: 'ok' },
    database: { status: 'ok' },
    smsConfigured: false,
  })),
}));

const LOADED_AT = '2026-10-30T08:00:00+00:00';
const settings = (over: Partial<PharmacySettings> = {}): PharmacySettings => ({
  pharmacy_name: 'Sample Pharmacy',
  address: 'No. 1, Main Street',
  phone: '0112345678',
  printer_name: null,
  timezone: 'Asia/Colombo',
  label_width_mm: null,
  label_height_mm: null,
  low_stock_alerts_enabled: true,
  expiry_alert_days: 45,
  updated_at: LOADED_AT,
  updated_by: null,
  ...over,
});
const as = (role: 'admin' | 'pharmacist' | 'staff' | null) =>
  vi.mocked(getCurrentUser).mockResolvedValue({ ok: true, data: { id: 'u1', email: 'u@pharmacy.local', role } });

const renderPage = () => render(<ToastProvider><SettingsPage /></ToastProvider>);
const profile = () => document.getElementById('profile')!;
const printer = () => document.getElementById('printer')!;
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  as('admin');
  vi.mocked(getPharmacySettings).mockResolvedValue({ ok: true, data: settings() });
});
afterEach(() => vi.restoreAllMocks());

async function loaded() {
  await waitFor(() => expect(field('Pharmacy name').value).toBe('Sample Pharmacy'));
  await screen.findByRole('button', { name: 'Check again' });
}

describe('loading', () => {
  it('shows the saved pharmacy settings', async () => {
    renderPage();
    expect(screen.getAllByText('Loading settings…').length).toBeGreaterThan(0);
    await loaded();
    expect(field('Address').value).toBe('No. 1, Main Street');
    expect(field('Contact number').value).toBe('0112345678');
    expect(field('Label printer name').value).toBe('');
    expect(screen.getByText('45 days')).toBeInTheDocument();
    expect(screen.getByText('30 days, fixed')).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Colombo/)).toBeInTheDocument();
  });

  it('shows a failed load with Retry, never an empty form', async () => {
    vi.mocked(getPharmacySettings).mockResolvedValueOnce({ ok: false, error: 'The pharmacy server reported an error (status 503).' });
    renderPage();
    const errors = await screen.findAllByText('Could not load the pharmacy settings');
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Pharmacy name')).not.toBeInTheDocument();
    fireEvent.click(within(profile()).getByRole('button', { name: /Retry/ }));
    await loaded();
    expect(getPharmacySettings).toHaveBeenCalledTimes(2);
  });

  it('offers only navigation links to the sections', async () => {
    renderPage();
    await loaded();
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#profile', '#label', '#printer', '#inventory', '#system']);
  });
});

describe('authorization', () => {
  it.each(['pharmacist', 'staff'] as const)('shows the settings read-only to %s', async (role) => {
    as(role);
    renderPage();
    await loaded();
    expect(await screen.findByText(/Only an administrator can change these settings/)).toBeInTheDocument();
    expect(field('Pharmacy name')).toHaveAttribute('readonly');
    expect(field('Label printer name')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('keeps the form read-only for an account without a role', async () => {
    as(null);
    renderPage();
    await loaded();
    expect(field('Contact number')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});

describe('updating', () => {
  it('sends only the changed field with the loaded version, then confirms', async () => {
    vi.mocked(updatePharmacySettings).mockResolvedValue({ ok: true, data: { settings: settings({ phone: '011 234 5679', updated_at: 'later' }), changed: ['phone'] } });
    renderPage();
    await loaded();
    fireEvent.change(field('Contact number'), { target: { value: '011 234 5679' } });
    expect(within(profile()).getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(within(profile()).getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Pharmacy profile saved.');
    expect(updatePharmacySettings).toHaveBeenCalledWith({ phone: '011 234 5679' }, LOADED_AT);
    expect(within(profile()).getByText('All changes saved')).toBeInTheDocument();
    expect(field('Contact number').value).toBe('011 234 5679');
  });

  it('saves with the Enter key', async () => {
    vi.mocked(updatePharmacySettings).mockResolvedValue({ ok: true, data: { settings: settings({ pharmacy_name: 'New' }), changed: ['pharmacy_name'] } });
    renderPage();
    await loaded();
    fireEvent.change(field('Pharmacy name'), { target: { value: 'New' } });
    fireEvent.submit(field('Pharmacy name').closest('form')!);
    await waitFor(() => expect(updatePharmacySettings).toHaveBeenCalledWith({ pharmacy_name: 'New' }, LOADED_AT));
  });

  it('saves the printer name without sending unsaved profile edits', async () => {
    vi.mocked(updatePharmacySettings).mockResolvedValue({ ok: true, data: { settings: settings({ printer_name: 'Counter', updated_at: 'later' }), changed: ['printer_name'] } });
    renderPage();
    await loaded();
    fireEvent.change(field('Pharmacy name'), { target: { value: 'Draft name' } });
    fireEvent.change(field('Label printer name'), { target: { value: 'Counter' } });
    fireEvent.click(within(printer()).getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Printer name saved.');
    expect(updatePharmacySettings).toHaveBeenCalledWith({ printer_name: 'Counter' }, LOADED_AT);
    // The unsaved profile edit is kept, still marked unsaved.
    expect(field('Pharmacy name').value).toBe('Draft name');
    expect(within(profile()).getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('disables Save until something changes, and Discard restores the saved values', async () => {
    renderPage();
    await loaded();
    const save = within(profile()).getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    fireEvent.change(field('Address'), { target: { value: 'Elsewhere' } });
    expect(save).toBeEnabled();
    fireEvent.click(within(profile()).getByRole('button', { name: 'Discard changes' }));
    expect(field('Address').value).toBe('No. 1, Main Street');
    expect(save).toBeDisabled();
  });
});

describe('validation and failures', () => {
  it('shows an invalid phone number next to the field and sends nothing', async () => {
    renderPage();
    await loaded();
    fireEvent.change(field('Contact number'), { target: { value: 'call me' } });
    fireEvent.click(within(profile()).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Enter a phone number/)).toBeInTheDocument();
    expect(field('Contact number')).toHaveAttribute('aria-invalid', 'true');
    expect(updatePharmacySettings).not.toHaveBeenCalled();
  });

  it('keeps the edit and shows the server error when the save fails', async () => {
    vi.mocked(updatePharmacySettings).mockResolvedValue({ ok: false, status: 403, error: 'You do not have permission to perform this action.' });
    renderPage();
    await loaded();
    fireEvent.change(field('Pharmacy name'), { target: { value: 'New name' } });
    fireEvent.click(within(profile()).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('You do not have permission to perform this action.')).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(field('Pharmacy name').value).toBe('New name');
    expect(within(profile()).getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('treats a thrown request as a failure, not a success', async () => {
    vi.mocked(updatePharmacySettings).mockRejectedValue(new Error('network'));
    renderPage();
    await loaded();
    fireEvent.change(field('Pharmacy name'), { target: { value: 'New name' } });
    fireEvent.click(within(profile()).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Not saved')).toBeInTheDocument();
    expect(screen.queryByText('Pharmacy profile saved.')).not.toBeInTheDocument();
  });

  it('offers a reload when someone else saved first', async () => {
    vi.mocked(updatePharmacySettings).mockResolvedValue({ ok: false, status: 409, code: 'SETTINGS_CHANGED', error: 'The settings were changed by someone else.' });
    renderPage();
    await loaded();
    fireEvent.change(field('Pharmacy name'), { target: { value: 'Mine' } });
    fireEvent.click(within(profile()).getByRole('button', { name: 'Save changes' }));
    vi.mocked(getPharmacySettings).mockResolvedValue({ ok: true, data: settings({ pharmacy_name: 'Theirs', updated_at: 'later' }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Reload settings' }));
    await waitFor(() => expect(field('Pharmacy name').value).toBe('Theirs'));
  });
});

describe('unsaved changes', () => {
  const unload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const followLink = () => {
    const link = document.createElement('a');
    link.href = '/admin/patients';
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot navigate
    document.body.appendChild(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const spy = vi.spyOn(event, 'stopPropagation');
    link.dispatchEvent(event);
    link.remove();
    return spy.mock.calls.length > 0;
  };

  it('warns before leaving only while there are unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await loaded();
    expect(unload()).toBe(false);
    expect(followLink()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(field('Address'), { target: { value: 'Elsewhere' } });
    expect(unload()).toBe(true);
    expect(followLink()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);

    confirm.mockReturnValue(true);
    expect(followLink()).toBe(false);

    fireEvent.click(within(profile()).getByRole('button', { name: 'Discard changes' }));
    expect(unload()).toBe(false);
  });

  it('does not warn for the in-page section links', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderPage();
    await loaded();
    fireEvent.change(field('Address'), { target: { value: 'Elsewhere' } });
    fireEvent.click(screen.getByRole('link', { name: 'Printer' }));
    expect(confirm).not.toHaveBeenCalled();
  });
});
