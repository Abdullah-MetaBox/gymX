import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

/**
 * The middleware is a cookie check and a redirect, not the security boundary —
 * pages and actions authorise independently. What it CAN do is quietly break
 * things by redirecting something that was never going to have a session.
 *
 * That is not hypothetical: `/api/jobs/run` was initially caught by the
 * matcher, so every scheduled run 307'd to the sign-in page. The jobs stopped
 * running and nothing said so.
 */

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('unauthenticated requests', () => {
  it('redirects app pages to sign-in', () => {
    const response = middleware(request('/'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/sign-in');
  });

  it('redirects a nested app page and remembers where it was going', () => {
    const response = middleware(request('/team'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('next=%2Fteam');
  });
});

describe('paths that must never be redirected', () => {
  it('lets the sign-in page through', () => {
    expect(middleware(request('/sign-in')).status).toBe(200);
  });

  it('lets Auth.js endpoints through', () => {
    expect(middleware(request('/api/auth/csrf')).status).toBe(200);
  });

  it('lets the scheduled-jobs endpoint through', () => {
    // The scheduler has no session and never will; the route verifies a bearer
    // token itself. If this regresses, cron silently stops working.
    expect(middleware(request('/api/jobs/run')).status).toBe(200);
  });
});

describe('authenticated requests', () => {
  it('passes a request carrying a session cookie', () => {
    const response = middleware(request('/', 'authjs.session-token=whatever'));
    expect(response.status).toBe(200);
  });

  it('accepts the __Secure- prefixed cookie used over HTTPS', () => {
    const response = middleware(request('/', '__Secure-authjs.session-token=whatever'));
    expect(response.status).toBe(200);
  });
});
