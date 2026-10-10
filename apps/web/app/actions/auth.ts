'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiObject } from '@/lib/api/server';
import type { ApiResult } from '@/lib/api/types';

export interface CurrentUser {
  id: string;
  email: string | null;
  role: 'admin' | 'pharmacist' | 'staff' | null;
}

export async function handleLogin(_prevState: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Enter both email and password.' };
  }

  const candidateUrls = Array.from(
    new Set([process.env.NEXT_PUBLIC_API_URL, 'http://127.0.0.1:3001', 'http://localhost:3001'].filter(Boolean) as string[]),
  );

  let res: Response | null = null;
  for (const url of candidateUrls) {
    try {
      res = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  redirect('/login');
}

/** The signed-in user as verified by the API (identity and role). */
export async function getCurrentUser(): Promise<ApiResult<CurrentUser>> {
  return apiObject<CurrentUser>('auth/me');
}
