'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiObject } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';
import { frontendOnlyMode, loginApiUrls } from '@/lib/server/apiConfiguration';
import { stagingGatewayHeaders } from '@/lib/server/stagingGateway';

export interface CurrentUser {
  id: string;
  email: string | null;
  role: 'admin' | 'pharmacist' | 'staff' | 'cashier' | null;
}

import { uiTestEnabled, UI_TEST_COOKIE, UI_TEST_SESSION } from '@/lib/uiTestMode';

export async function handleLogin(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  if (frontendOnlyMode()) {
    return { error: 'Sign-in is unavailable in frontend-only mode. No credentials were sent.' };
  }
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Enter both email and password.' };
  }

  if (uiTestEnabled()) {
    if (email !== (process.env.UI_TEST_EMAIL || 'tester@pharmacy.local') ||
        password !== (process.env.UI_TEST_PASSWORD || 'Test@12345')) {
      return { error: 'Incorrect UI test email or password.' };
    }
    const store = await cookies();
    store.set(UI_TEST_COOKIE, UI_TEST_SESSION, {
      httpOnly: true, secure: false, path: '/', sameSite: 'strict',
    });
    redirect('/admin');
  }
  // Never forward the reserved local account to production authentication.
  if (email === 'tester@pharmacy.local' || email === process.env.UI_TEST_EMAIL) {
    return { error: 'The local test account is unavailable outside UI testing mode.' };
  }

  const candidateUrls = loginApiUrls();

  let res: Response | null = null;
  for (const url of candidateUrls) {
    try {
      res = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...stagingGatewayHeaders() },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
      });
      break;
    } catch {
      // Try the next address.
    }
  }

  if (!res) {
    console.error('[auth] sign-in failed: API unreachable');
    return { error: 'Could not reach the pharmacy server. Check that it is running, then try again.' };
  }

  if (!res.ok) {
    console.error(`[auth] sign-in failed -> ${res.status}`);
    if (res.status === 401 || res.status === 400) return { error: 'Incorrect email or password.' };
    if (res.status === 429) return { error: 'Too many sign-in attempts. Wait a minute and try again.' };
    return { error: 'The sign-in service is unavailable right now. Please try again shortly.' };
  }

  const session = await res.json().catch(() => null);
  if (!session?.access_token) {
    return { error: 'Sign-in did not return a session. Please try again.' };
  }

  const cookieStore = await cookies();
  cookieStore.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: typeof session.expires_in === 'number' ? session.expires_in : 3600,
    sameSite: 'lax',
  });

  redirect('/');
}

export async function handleLogout() {
  const cookieStore = await cookies();
  cookieStore.delete('sb-access-token');
  cookieStore.delete(UI_TEST_COOKIE);
  cookieStore.delete('pharmacy-ui-demo');
  redirect('/login');
}

/** The signed-in user as verified by the API (identity and role). */
export async function getCurrentUser(): Promise<ApiResult<CurrentUser>> {
  if (frontendOnlyMode()) {
    return { ok: false, code: 'FRONTEND_ONLY_MODE', error: 'Authentication is unavailable in frontend-only mode. No backend request was made.' };
  }
  if (uiTestEnabled()) {
    const store = await cookies();
    return store.get(UI_TEST_COOKIE)?.value === UI_TEST_SESSION
      ? { ok: true, data: { id: 'local-ui-tester', email: process.env.UI_TEST_EMAIL || 'tester@pharmacy.local', role: 'admin' } }
      : { ok: false, status: 401, error: 'Sign in to the local UI test session.' };
  }
  return apiObject<CurrentUser>('auth/me');
}
