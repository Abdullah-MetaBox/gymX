import type { Action, ActorContext, Role, Subject } from '@gymx/core/auth';
import { can } from '@gymx/core/auth';
import { UnauthorizedError } from '@gymx/core/errors';
import type { GymBranding } from '@gymx/db';
import {
  gyms,
  platformAdmins,
  recordAudit,
  userRoles,
  users,
  withActor,
  withPlatform,
  withTenant,
} from '@gymx/db';
import { resolveLocale } from '@gymx/i18n';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { auth } from '../auth';

export const ACTIVE_GYM_COOKIE = 'gymx.gym';
export const LOCALE_COOKIE = 'gymx.locale';

export interface Membership {
  gymId: string;
  gymName: string;
  gymSlug: string;
  role: Role;
  timezone: string;
  defaultLocale: string;
  locales: string[];
  enabledModules: string[];
  branding: GymBranding;
}

export interface Principal {
  userId: string;
  email: string;
  name: string;
  locale: string;
  isPlatformAdmin: boolean;
  memberships: Membership[];
}

/**
 * Who is signed in, and what they may reach.
 *
 * Roles are read from the database on every request rather than carried in the
 * session token. Revoking a role therefore takes effect on the next request,
 * not whenever the token happens to expire.
 *
 * `cache()` dedupes this within a single render pass, so a layout and three
 * nested pages cost one round trip rather than four.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  // withActor sets app.user_id and nothing else: policies let a user read
  // their own identity and their own memberships, and deny everything else.
  return withActor(userId, async (db) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user?.status !== 'active') return null;

    const [platformRow] = await db
      .select()
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, userId))
      .limit(1);

    const roleRows = await db
      .select({
        gymId: userRoles.gymId,
        role: userRoles.role,
        gymName: gyms.name,
        gymSlug: gyms.slug,
        timezone: gyms.timezone,
        defaultLocale: gyms.defaultLocale,
        locales: gyms.locales,
        enabledModules: gyms.enabledModules,
        branding: gyms.branding,
      })
      .from(userRoles)
      .innerJoin(gyms, eq(gyms.id, userRoles.gymId))
      .where(eq(userRoles.userId, userId));

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      isPlatformAdmin: Boolean(platformRow),
      memberships: roleRows.map((row) => ({
        gymId: row.gymId,
        gymName: row.gymName,
        gymSlug: row.gymSlug,
        role: row.role,
        timezone: row.timezone,
        defaultLocale: row.defaultLocale,
        locales: row.locales,
        enabledModules: row.enabledModules,
        branding: row.branding,
      })),
    } satisfies Principal;
  });
});

export async function requirePrincipal(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new UnauthorizedError();
  return principal;
}

export interface ActiveContext {
  principal: Principal;
  actor: ActorContext;
  membership: Membership | null;
  /** True when a platform admin is inside a gym they hold no role in. */
  assumed: boolean;
  locale: string;
  timeZone: string;
}

/**
 * Resolve the gym the request is operating on.
 *
 * The active gym comes from a cookie, but the cookie is never trusted: it is
 * matched against this user's memberships. A tampered value names a gym they
 * hold no role in, and resolution falls through to null — or, for a platform
 * admin, to an explicitly *assumed* gym that gets recorded.
 */
export const getActiveContext = cache(async (): Promise<ActiveContext | null> => {
  const principal = await getPrincipal();
  if (!principal) return null;

  const cookieStore = await cookies();
  const requestedGymId = cookieStore.get(ACTIVE_GYM_COOKIE)?.value ?? null;

  let membership: Membership | null = null;
  if (requestedGymId) {
    membership = principal.memberships.find((m) => m.gymId === requestedGymId) ?? null;
  }
  if (!membership && principal.memberships.length === 1) {
    membership = principal.memberships[0] ?? null;
  }

  // A platform admin inside a gym they hold no role in: permitted, audited.
  let assumed = false;
  let assumedGym: Membership | null = null;
  if (!membership && requestedGymId && principal.isPlatformAdmin) {
    const [gym] = await withPlatform(principal.userId, (db) =>
      db.select().from(gyms).where(eq(gyms.id, requestedGymId)).limit(1),
    );
    if (gym) {
      assumed = true;
      assumedGym = {
        gymId: gym.id,
        gymName: gym.name,
        gymSlug: gym.slug,
        role: 'platform_admin',
        timezone: gym.timezone,
        defaultLocale: gym.defaultLocale,
        locales: gym.locales,
        enabledModules: gym.enabledModules,
        branding: gym.branding,
      };
    }
  }

  const active = membership ?? assumedGym;
  const role: Role = active?.role ?? (principal.isPlatformAdmin ? 'platform_admin' : 'staff');

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = resolveLocale({
    userLocale: cookieLocale ?? principal.locale,
    gymDefaultLocale: active?.defaultLocale,
    gymLocales: active?.locales,
  });

  return {
    principal,
    membership: active,
    assumed,
    locale,
    timeZone: active?.timezone ?? 'Indian/Mauritius',
    actor: {
      userId: principal.userId,
      email: principal.email,
      name: principal.name,
      role,
      locale,
      gymId: active?.gymId ?? null,
      assumedGymId: assumed ? (active?.gymId ?? null) : null,
    },
  };
});

export async function requireActiveContext(): Promise<ActiveContext> {
  const context = await getActiveContext();
  if (!context) throw new UnauthorizedError();
  return context;
}

/**
 * Page-level permission gate.
 *
 * Server *actions* throw ForbiddenError, which the action pipeline turns into
 * a typed failure the form can render. A *page* has nowhere to render that to,
 * so an uncaught throw becomes a 500 — a denied page must look like a page
 * that is not there, not like a broken one.
 *
 * Every page that queries a permissioned resource calls this first, which also
 * keeps the page and the sidebar agreeing about what a role can reach.
 */
export async function requirePageAccess(action: Action, subject: Subject): Promise<ActiveContext> {
  const context = await requireActiveContext();
  if (!can(context.actor.role, action, subject)) notFound();
  return context;
}

/**
 * Enter a gym as a platform admin, recording it.
 *
 * "Who can see my members?" is a question every gym owner asks and deserves a
 * precise answer to. A platform admin holds no ambient cross-tenant reach —
 * they take this route, and taking it writes an audit row.
 */
export async function assumeGym(gymId: string): Promise<void> {
  const principal = await requirePrincipal();
  if (!principal.isPlatformAdmin) {
    throw new UnauthorizedError('Only platform administrators may enter a gym');
  }

  const [gym] = await withPlatform(principal.userId, (db) =>
    db.select().from(gyms).where(eq(gyms.id, gymId)).limit(1),
  );
  if (!gym) throw new UnauthorizedError('Unknown gym');

  await withTenant({ gymId, userId: principal.userId, role: 'platform_admin' }, (db) =>
    recordAudit(db, {
      gymId,
      userId: principal.userId,
      actorEmail: principal.email,
      assumedGymId: gymId,
      entity: 'gym',
      entityId: gymId,
      action: 'assume_gym',
      diff: { gymName: gym.name },
    }),
  );

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GYM_COOKIE, gymId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function leaveGym(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_GYM_COOKIE);
}

export async function setActiveGym(gymId: string): Promise<void> {
  const principal = await requirePrincipal();
  const membership = principal.memberships.find((m) => m.gymId === gymId);

  if (!membership) {
    if (principal.isPlatformAdmin) return assumeGym(gymId);
    throw new UnauthorizedError('You do not have a role in that gym');
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GYM_COOKIE, gymId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function setLocaleCookie(locale: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
