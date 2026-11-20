import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ jar: new Map<string, string>(), fetch: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: (key: string) => mocks.jar.has(key) ? { value: mocks.jar.get(key) } : undefined,
  set: (key: string, value: string) => mocks.jar.set(key, value),
  delete: (key: string) => mocks.jar.delete(key),
}) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { handleLogin, handleLogout, getCurrentUser } from '@/app/actions/auth';
import { apiRequest } from '@/lib/api/server';
import { sendClientSms } from '@/app/actions/sms';
import { createLabelRecord } from '@/app/actions/labels';
import { uiTestEnabled, UI_TEST_COOKIE, UI_TEST_SESSION } from './uiTestMode';
function form(email = 'tester@pharmacy.local', password = 'Test@12345') {
  const data = new FormData(); data.set('email', email); data.set('password', password); return data;
}
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
  mocks.jar.clear(); mocks.fetch.mockReset(); vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('database-free UI mode isolation', () => {
  it('logs in with a separate session without contacting the API', async () => {
    await expect(handleLogin(undefined, form())).rejects.toThrow('redirect:/admin');
    expect(mocks.jar.get(UI_TEST_COOKIE)).toBe(UI_TEST_SESSION);
    expect(mocks.jar.has('sb-access-token')).toBe(false);
    expect((await getCurrentUser()).ok).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('rejects wrong credentials', async () => {
    expect(await handleLogin(undefined, form('tester@pharmacy.local', 'wrong'))).toHaveProperty('error');
    expect(mocks.jar.size).toBe(0);
  });
  it('requires a local session for identity', async () => { expect((await getCurrentUser()).ok).toBe(false); });
  it('keeps identity across repeated requests and logs out', async () => {
    mocks.jar.set(UI_TEST_COOKIE, UI_TEST_SESSION);
    expect((await getCurrentUser()).ok).toBe(true);
    expect((await getCurrentUser()).ok).toBe(true);
    await expect(handleLogout()).rejects.toThrow('redirect:/login');
    expect((await getCurrentUser()).ok).toBe(false);
  });
  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)('blocks %s even with a production token present', async (method) => {
    mocks.jar.set('sb-access-token', 'real-token');
    const result = await apiRequest('products', { method });
    expect(result.ok).toBe(false); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('blocks legacy label and external SMS writes', async () => {
    expect(await createLabelRecord({})).toHaveProperty('error');
    expect((await sendClientSms({ recipient: '0771234567', message: 'test' })).success).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('never forwards reserved credentials when disabled or in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'false');
    expect(await handleLogin(undefined, form())).toHaveProperty('error');
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true'); vi.stubEnv('NODE_ENV', 'production');
    expect(uiTestEnabled()).toBe(false);
    expect(await handleLogin(undefined, form())).toHaveProperty('error');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
