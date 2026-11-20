import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from './AppShell';

const nav = vi.hoisted(() => ({ pathname: '/admin', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }}>{children}</a>
  ),
}));
const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const admin = vi.hoisted(() => ({ getAdminAlerts: vi.fn(async () => ({ ok: true, data: [] })) }));
vi.mock('@/app/actions/auth', () => ({
  handleLogout: vi.fn(),
  getCurrentUser: auth.getCurrentUser,
}));
vi.mock('@/app/actions/admin', () => ({
  getAdminAlerts: admin.getAdminAlerts,
}));

const signedInAs = (role: string | null) =>
  auth.getCurrentUser.mockResolvedValue({ ok: true, data: { id: 'u1', email: `${role}@example.test`, role } });

describe('application shell navigation', () => {
  beforeEach(() => {
    nav.pathname = '/admin';
    nav.push.mockReset();
    admin.getAdminAlerts.mockClear();
    signedInAs('admin');
  });

  it('collapses the desktop sidebar while keeping each icon link accessible', async () => {
    render(<AppShell><div>Dashboard content</div></AppShell>);
    await screen.findByRole('link', { name: 'Patients' });

    expect(screen.getByText('Dashboard', { selector: 'header p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Patients' })).toHaveAttribute('title', 'Patients');
  });

  it('updates the top title for the current route', () => {
    const { rerender } = render(<AppShell><div>Page</div></AppShell>);
    nav.pathname = '/admin/inventory/movements';
    rerender(<AppShell><div>Page</div></AppShell>);
    expect(screen.getByText('Inventory', { selector: 'header p' })).toBeInTheDocument();
  });

  it('opens a mobile navigation dialog and closes it after following a link', async () => {
    render(<AppShell><div>Page</div></AppShell>);
    await screen.findByRole('link', { name: 'Patients' });
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Patients' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });

  describe('role-aware navigation (display only; the API enforces access)', () => {
    const STAFF_LINKS = ['Dashboard', 'Label workstation', 'Patients', 'Prescriptions', 'Label history', 'Medicines', 'Inventory', 'Suppliers', 'Analytics', 'Edit Reasons', 'Settings'];

    it.each(['admin', 'pharmacist', 'staff'])('shows %s the pharmacy pages, the point of sale and staff tools', async (role) => {
      signedInAs(role);
      render(<AppShell><div>Page</div></AppShell>);
      const main = await screen.findByRole('navigation', { name: 'Main' });
      await within(main).findByRole('link', { name: 'Patients' });
      for (const name of [...STAFF_LINKS, 'Point of sale']) {
        expect(within(main).getByRole('link', { name })).toBeInTheDocument();
      }
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Stock alerts/ })).toBeInTheDocument();
    });

    it('shows a cashier only the point of sale and their account controls', async () => {
      signedInAs('cashier');
      render(<AppShell><div>Page</div></AppShell>);
      const main = await screen.findByRole('navigation', { name: 'Main' });
      await within(main).findByRole('link', { name: 'Point of sale' });
      expect(within(main).getAllByRole('link').map((a) => a.textContent)).toEqual(['Point of sale']);
      for (const name of STAFF_LINKS) expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
      expect(screen.queryByRole('search')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Stock alerts/ })).not.toBeInTheDocument();
      expect(admin.getAdminAlerts).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /cashier@example.test/ }));
      const menu = screen.getByRole('menu');
      expect(within(menu).queryByRole('menuitem', { name: 'Settings' })).not.toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    });

    it.each([
      ['no role', () => signedInAs(null)],
      ['an unavailable identity', () => auth.getCurrentUser.mockResolvedValue({ ok: false, error: 'offline' })],
    ])('shows no navigation links for %s', async (_label, setup) => {
      setup();
      render(<AppShell><div>Page</div></AppShell>);
      await waitFor(() => expect(auth.getCurrentUser).toHaveBeenCalled());
      await act(async () => {});
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole('link')).toEqual([]);
    });
  });
});
