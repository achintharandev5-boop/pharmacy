import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { redirect, next } = vi.hoisted(() => ({
  redirect: vi.fn((url: URL) => ({ kind: 'redirect', url: url.toString() })),
  next: vi.fn(() => ({ kind: 'next' })),
}));

vi.mock('next/server', () => ({
  NextResponse: { redirect, next },
}));

import { proxy, config } from './proxy';

function request(path: string, token?: string) {
  return {
    url: `https://pharmacy.example${path}`,
    nextUrl: { pathname: path },
    cookies: { get: vi.fn(() => (token ? { value: token } : undefined)) },
  } as never;
}

describe('Next.js proxy navigation guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    redirect.mockClear();
    next.mockClear();
  });

  it('redirects unauthenticated protected pages to login', () => {
    proxy(request('/label'));
    expect(redirect).toHaveBeenCalledWith(new URL('/login', 'https://pharmacy.example/label'));
  });

  it('allows unauthenticated login navigation', () => {
    proxy(request('/login'));
    expect(next).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects a cookie-bearing request away from login', () => {
    proxy(request('/login', 'token'));
    expect(redirect).toHaveBeenCalledWith(new URL('/', 'https://pharmacy.example/login'));
  });

  it('allows cookie-bearing protected navigation to continue', () => {
    proxy(request('/label', 'token'));
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows frontend-only deployments to browse pages without a backend session', () => {
    vi.stubEnv('FRONTEND_ONLY_MODE', 'true');
    proxy(request('/admin/inventory'));
    expect(next).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps the landing page behind the existing authentication navigation boundary', () => {
    proxy(request('/welcome'));
    expect(redirect).toHaveBeenCalledWith(new URL('/login', 'https://pharmacy.example/welcome'));
    redirect.mockClear();
    proxy(request('/welcome', 'token'));
    expect(next).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('retains the existing API and framework asset exclusions', () => {
    expect(config.matcher).toEqual(['/((?!api|_next/static|_next/image|favicon.ico).*)']);
  });
});
