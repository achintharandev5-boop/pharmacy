import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/api/server', () => ({ apiObject: vi.fn() }));

import { getCurrentUser, handleLogin } from './auth';
import { cookies } from 'next/headers';

describe('frontend-only authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refuses login without contacting an API or requiring API configuration', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_ONLY_MODE', 'true');
    vi.stubEnv('API_URL', '');
    vi.stubEnv('PILOT_API_URL', '');
    const formData = new FormData();
    formData.set('email', 'user@example.com');
    formData.set('password', 'not-forwarded');

    await expect(handleLogin(undefined, formData)).resolves.toEqual({
      error: 'Sign-in is unavailable in frontend-only mode. No credentials were sent.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not accept the local UI-test identity in frontend-only mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FRONTEND_ONLY_MODE', 'true');
    vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');

    await expect(getCurrentUser()).resolves.toEqual({
      ok: false,
      code: 'FRONTEND_ONLY_MODE',
      error: 'Authentication is unavailable in frontend-only mode. No backend request was made.',
    });
    expect(cookies).not.toHaveBeenCalled();
  });
});
