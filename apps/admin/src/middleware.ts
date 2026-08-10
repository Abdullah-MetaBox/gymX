import { type NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware: a fast redirect, NOT the security boundary.
 *
 * It only checks whether a session cookie is present, because the real check
 * needs the database and `@gymx/db` cannot run on the edge runtime. Every
 * protected page and every server action independently resolves the actor and
 * asserts permissions server-side — see lib/session.ts and lib/action.ts.
 *
 * Treating this file as the gate would be the classic mistake: a forged cookie
 * gets past it, and gets nowhere afterwards.
 */

/**
 * Paths the cookie check does not apply to.
 *
 * `/api/jobs` is here because the scheduler has no session and never will —
 * it authenticates with a bearer token the route itself verifies in constant
 * time. Without this exemption the middleware 307s every cron call to the
 * sign-in page, and the jobs simply stop running, silently and successfully
 * as far as the workflow can tell.
 */
const PUBLIC_PATHS = ['/sign-in', '/api/auth', '/api/jobs'];

const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
