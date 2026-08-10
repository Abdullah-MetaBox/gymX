import { normaliseEmail, users, withAnonymous } from '@gymx/db';
import { eq } from 'drizzle-orm';
import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { env } from './lib/env';
import { verifyPassword } from './lib/password';

/**
 * Authentication.
 *
 * Scope note: Phase 0 ships **credentials only**. The plan also listed
 * magic-link sign-in, which needs an email transport — and that transport is
 * itself a Phase 6 deliverable. Building half of it now would mean a provider
 * wired to nothing, so it moves to Phase 6 alongside the adapter it depends
 * on. Recorded in docs/roadmap.md rather than left as a silent gap.
 *
 * Sessions are JWTs. Two consequences worth being explicit about:
 *   - The token carries identity only — never a role, never a gym. Roles are
 *     read from the database on every request, so revoking someone's access
 *     takes effect immediately instead of whenever their token happens to
 *     expire.
 *   - Which gym is active lives in a cookie, validated against that user's
 *     memberships server-side on every request (see lib/session.ts). A tampered
 *     cookie names a gym the user has no role in, and resolution fails.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const nextAuth = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: { signIn: '/sign-in' },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = normaliseEmail(parsed.data.email);

        // Sign-in has to find an account before any tenant context exists.
        // withAnonymous runs as gymx_app with no GUCs set, so every tenant
        // policy denies — only `users`, which is not tenant-scoped, is
        // reachable, and only for SELECT.
        const [user] = await withAnonymous((db) =>
          db.select().from(users).where(eq(users.email, email)).limit(1),
        );

        if (!user?.passwordHash) return null;
        if (user.status !== 'active') return null;

        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/**
 * Exported with explicit annotations rather than destructured directly.
 *
 * next-auth's inferred types reference @auth/core internals that pnpm's
 * symlinked layout places outside this package's resolution scope, which
 * surfaces as TS2742. Naming the types fixes it without loosening the
 * workspace's isolation.
 */
export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
