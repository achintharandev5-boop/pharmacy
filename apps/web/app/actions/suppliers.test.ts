import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { createSupplier } from './suppliers';

describe('createSupplier', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts a stored record (UUID id, matching name)', async () => {
    const saved = { id: '3f2b8c1e-9a4d-4e2b-8f1a-2c3d4e5f6a7b', name: 'Acme Pharma' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }));
    expect(await createSupplier({ name: 'Acme Pharma' })).toEqual({ ok: true, data: saved });
  });

  it('rejects the placeholder record the API returns when the insert fails', async () => {
    const placeholder = { id: `sup_${Date.now()}`, active: true, created_at: new Date().toISOString() };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(placeholder), { status: 201 }));
    const res = await createSupplier({ name: 'Acme Pharma' });
    expect(res.ok).toBe(false);
  });
});
