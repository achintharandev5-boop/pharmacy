import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const response = vi.hoisted(() => ({ next: vi.fn(() => 'allowed'), redirect: vi.fn((url: URL) => url.pathname) }));
vi.mock('next/server', () => ({ NextResponse: response }));
import { proxy } from './proxy';
import { UI_TEST_COOKIE, UI_TEST_SESSION } from './lib/uiTestMode';
function request(path: string, local = true, real = false) {
 return { url: `http://localhost${path}`, nextUrl: { pathname: path }, cookies: { get: (name: string) =>
  name === UI_TEST_COOKIE && local ? { value: UI_TEST_SESSION } : name === 'sb-access-token' && real ? { value: 'jwt' } : undefined } } as never;
}
beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true'); });
afterEach(() => vi.unstubAllEnvs());
it.each(['/admin','/label','/admin/patients','/admin/prescriptions','/admin/products','/admin/inventory','/admin/analytics','/admin/settings'])('allows local sessions on %s', path => expect(proxy(request(path))).toBe('allowed'));
it('rejects a real token without the separate test session', () => expect(proxy(request('/admin', false, true))).toBe('/login'));
it('redirects signed-in login to the actual dashboard', () => expect(proxy(request('/login'))).toBe('/admin'));
it('ignores local sessions in normal and production modes', () => {
 vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE','false'); expect(proxy(request('/admin'))).toBe('/login');
 vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE','true'); vi.stubEnv('NODE_ENV','production'); expect(proxy(request('/admin'))).toBe('/login');
});
