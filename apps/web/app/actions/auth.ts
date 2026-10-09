'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function handleLogin(
  prevState: any,
  formData: FormData
): Promise<{ error?: string }> {
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const candidateUrls = [
    process.env.NEXT_PUBLIC_API_URL,
    'http://127.0.0.1:3001',
    'http://localhost:3001',
  ].filter(Boolean) as string[];

  const uniqueUrls = Array.from(new Set(candidateUrls));

  let res: Response | null = null;
  let lastError: any = null;

  for (const url of uniqueUrls) {
    try {
      res = await fetch(`${url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res) break;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!res) {
    console.error('API Error:', lastError);
    return {
      error: `Could not reach authentication server (${lastError?.message || 'Connection refused'}). Ensure NestJS API is running on port 3001.`,
    };
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error('Login failed:', errorText);
    return { error: 'Invalid email or password. Please check your credentials.' };
  }

  const session = await res.json();

  if (!session?.access_token) {
    return { error: 'Authentication succeeded but no access token was returned.' };
  }

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.expires_in || 3600,
    sameSite: 'lax',
  });

  redirect('/');
}

export async function handleLogout() {
  const cookieStore = await cookies();
  cookieStore.delete('sb-access-token');
  redirect('/login');
}
