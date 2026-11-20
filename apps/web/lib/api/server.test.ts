import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'test-token' }) }),
}));

import { apiList, apiObject, apiRequest, query } from './server';
import { NETWORK_ERROR_MESSAGE } from './types';

function respond(status: number, body: unknown) {
  return new Response(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body), { status });
}

describe('apiRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('refuses backend requests in frontend-only mode without API configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_ONLY_MODE', 'true');
    vi.stubEnv('API_URL', '');
    vi.stubEnv('PILOT_API_URL', '');

    const res = await apiRequest('inventory/adjustments', { method: 'POST', body: { quantity: 1 } });

    expect(res).toEqual({
      ok: false,
      code: 'FRONTEND_ONLY_MODE',
      error: 'This operation is unavailable in frontend-only mode. No backend request was made.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns data on success and sends the bearer token', async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 'a1' }));
    const res = await apiRequest('things/a1');
    expect(res).toEqual({ ok: true, data: { id: 'a1' } });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
  });

  it('reports an unreachable server as an error, never as data', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await apiRequest('things');
    expect(res).toEqual({ ok: false, error: NETWORK_ERROR_MESSAGE });
  });

  it('maps HTTP errors to messages and keeps the status and code', async () => {
    fetchMock.mockResolvedValue(respond(409, { message: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' }));
    const res = await apiRequest('things', { method: 'POST', body: {} });
    expect(res).toEqual({ ok: false, status: 409, code: 'INSUFFICIENT_STOCK', error: 'Insufficient stock' });
  });

  it('uses a session message for 401', async () => {
    fetchMock.mockResolvedValue(respond(401, { message: 'Unauthorized' }));
    const res = await apiRequest('things');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/session has expired/i);
  });

  it('treats a 200 with success:false as a failure', async () => {
    fetchMock.mockResolvedValue(respond(200, { success: false, message: 'Could not save' }));
    const res = await apiRequest('things', { method: 'POST', body: {} });
    expect(res.ok).toBe(false);
  });

  it('rejects responses the server labels as simulated', async () => {
    fetchMock.mockResolvedValue(respond(200, { success: true, message: 'Adjustment processed (simulated)' }));
    const res = await apiRequest('inventory/adjustments', { method: 'POST', body: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/could not confirm/i);
  });

  it('never logs query strings (they can contain names or phone numbers)', async () => {
    fetchMock.mockResolvedValue(respond(500, {}));
    await apiRequest('customers/search?phone=0771234567');
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat().join(' ');
    expect(logged).toContain('customers/search');
    expect(logged).not.toContain('0771234567');
  });
});

describe('apiList / apiObject', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns an empty list as a successful empty result', async () => {
    fetchMock.mockResolvedValue(respond(200, []));
    expect(await apiList('things')).toEqual({ ok: true, data: [] });
  });

  it('rejects a non-array list response instead of treating it as empty', async () => {
    fetchMock.mockResolvedValue(respond(200, { items: [] }));
    const res = await apiList('things');
    expect(res.ok).toBe(false);
  });

  it('rejects an empty object response', async () => {
    fetchMock.mockResolvedValue(respond(200, ''));
    const res = await apiObject('things/1');
    expect(res.ok).toBe(false);
  });
});

describe('query', () => {
  it('omits empty values and encodes the rest', () => {
    expect(query({ q: 'a b', status: '', limit: 5, x: undefined })).toBe('?q=a+b&limit=5');
    expect(query({})).toBe('');
  });
});
