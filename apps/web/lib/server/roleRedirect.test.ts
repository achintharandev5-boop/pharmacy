import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));
vi.mock('@/app/actions/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import { redirectCashierToPos } from './roleRedirect';

describe('redirectCashierToPos', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset();
    mocks.redirect.mockClear();
  });

  it('sends a cashier to the point of sale', async () => {
    mocks.getCurrentUser.mockResolvedValue({ ok: true, data: { id: 'u', email: null, role: 'cashier' } });
    await expect(redirectCashierToPos()).rejects.toThrow('NEXT_REDIRECT /pos');
  });

  it.each(['admin', 'pharmacist', 'staff', null])('leaves %s on the requested page', async (role) => {
    mocks.getCurrentUser.mockResolvedValue({ ok: true, data: { id: 'u', email: null, role } });
    await expect(redirectCashierToPos()).resolves.toBeUndefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('renders the page as before when the identity cannot be checked (the API still enforces access)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ ok: false, error: 'offline' });
    await expect(redirectCashierToPos()).resolves.toBeUndefined();
  });
});
