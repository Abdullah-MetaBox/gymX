import { clerkMiddleware } from '@clerk/nextjs/server';

/**
 * Establishes identity. Protects nothing.
 *
 * Clerk deprecated route-matcher protection here, and their reasoning is the
 * one this codebase already held: path matching in middleware can diverge from
 * how Next actually routes a request, which leaves protected resources
 * reachable. So authorisation stays where it can be correct —
 *
 *   - pages call `requirePageAccess`, which redirects when signed out and
 *     404s when the role lacks the permission
 *   - server actions go through `defineAction`, which resolves the actor and
 *     asserts against the permission matrix
 *   - API routes resolve the actor themselves; `/api/jobs/run` has no session
 *     at all and verifies a bearer token in constant time
 *   - RLS refuses cross-tenant rows underneath all of it
 *
 * Nothing is left for a matcher to get wrong. An earlier version of this file
 * did carry a matcher, and its `'/sign-in(.*)'` pattern also matched
 * `/sign-info` — the wildcard consumes any suffix, not just a path segment.
 * That is the failure mode Clerk is warning about, found in our own code.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
