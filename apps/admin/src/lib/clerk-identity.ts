import { auth, currentUser } from '@clerk/nextjs/server';
import { normaliseEmail, users, withActor, withAnonymous } from '@gymx/db';
import { eq } from 'drizzle-orm';
import { cache } from 'react';

/**
 * Resolve the signed-in Clerk account to the GymX user it acts as.
 *
 * Identity is Clerk's; authorisation is ours. Everything downstream — roles,
 * RLS predicates, audit rows — keys off `users.id`, so a Clerk session grants
 * nothing until it maps to a row here. Someone who signs up to Clerk on their
 * own gets a valid session and no access at all, which is the correct outcome:
 * provisioning a gym's staff stays a GymX decision.
 *
 * Two lookups, in order:
 *   1. by `clerk_user_id` — the fast path, taken on every request after the first
 *   2. by verified email — the one-time link, which then writes (1) for next time
 *
 * `withAnonymous` is the right context for this: `users` is not tenant-scoped,
 * and we have no gym (or even a user id) to open a scoped context with yet.
 */
export const resolveGymxUserId = cache(async (): Promise<string | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await withAnonymous(async (db) => {
    const [row] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return row ?? null;
  });

  if (existing) return existing.status === 'active' ? existing.id : null;

  // First sign-in for this Clerk account: link it to an existing GymX user by
  // email. currentUser() is an API call, so it only runs on this one request —
  // afterwards the clerk_user_id lookup above short-circuits.
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  // An unverified address must never link an account: anyone could sign up to
  // Clerk claiming a manager's email and inherit their gym.
  if (clerkUser.primaryEmailAddress?.verification?.status !== 'verified') return null;

  const match = await withAnonymous(async (db) => {
    const [row] = await db
      .select({ id: users.id, status: users.status, clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.email, normaliseEmail(email)))
      .limit(1);
    return row ?? null;
  });

  if (!match || match.status !== 'active') return null;

  // Already claimed by a different Clerk account — refuse rather than move the
  // link, which would let a second signup take over the first's identity.
  if (match.clerkUserId && match.clerkUserId !== clerkUserId) return null;

  // The write runs as the matched user, not anonymously: the users_update
  // policy admits `id = app_current_user_id()`, and an anonymous context has no
  // user id, so the same statement inside withAnonymous is silently discarded
  // by RLS — the link would never persist and every request would repeat this
  // whole path.
  await withActor(match.id, async (db) => {
    await db
      .update(users)
      .set({ clerkUserId, lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, match.id));
  });

  return match.id;
});
