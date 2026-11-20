import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { uiTestEnabled, UI_TEST_COOKIE, UI_TEST_SESSION } from './lib/uiTestMode';

export function proxy(request: NextRequest) {
  if (process.env.FRONTEND_ONLY_MODE === 'true') return NextResponse.next();
  const path = request.nextUrl.pathname;
  const login = path === '/login';
  const token = uiTestEnabled()
    ? request.cookies.get(UI_TEST_COOKIE)?.value === UI_TEST_SESSION
    : Boolean(request.cookies.get('sb-access-token')?.value);
  if (path === '/demo') return NextResponse.redirect(new URL(token ? '/admin' : '/login', request.url));
  if (!token && !login) return NextResponse.redirect(new URL('/login', request.url));
  if (token && login) return NextResponse.redirect(new URL(uiTestEnabled() ? '/admin' : '/', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
