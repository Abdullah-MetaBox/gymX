import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@gymx/core/auth';
import { ForbiddenError, TenantContextError } from '@gymx/core/errors';
import { sql } from 'drizzle-orm';
import type { Database } from './client';
import { getAppDb } from './client';

/**
 * Tenant context.
 *
 * Two independent layers, and the difference between them matters:
 *
 *   1. **Row-level security** is the backstop. Postgres itself refuses to
 *      return another gym's rows, so a forgotten `where` clause is a bug that
 *      returns nothing rather than a bug that leaks a member list.
 *
 *   2. **This module** is the ergonomics. It opens the transaction, sets the
 *      GUCs the policies read, and throws a legible error when tenant data is
 *      touched with no context — instead of leaving a developer staring at an
 *      inexplicably empty result set.
 *
 * `SET LOCAL` (via `set_config(..., true)`) is deliberate: the setting dies
 * with the transaction. A pooled connection therefore cannot carry one gym's
 * context into the next request that borrows it. `tenant.test.ts` proves that
 * against a pool of exactly one connection.
 *
 * Honest limitation: `app.is_platform` gates cross-gym reads, and the database
 * only checks that the flag corresponds to a real `platform_admins` row at the
 * moment `withPlatform` sets it. A compromised application process could set
 * the GUC itself. This design defends against application *bugs*, which is the
 * realistic threat; defending against a compromised app server would need a
 * second database role, which is not worth the operational cost at this stage.
 */

export type TxDatabase = Parameters<Parameters<Database['transaction']>[0]>[0];

export type ContextKind = 'tenant' | 'actor' | 'platform';

export interface DbContext {
  kind: ContextKind;
  db: TxDatabase;
  gymId: string | null;
  userId: string | null;
  role: Role | null;
  isPlatform: boolean;
}

const storage = new AsyncLocalStorage<DbContext>();

/** The active context, or undefined outside one. */
export function currentContext(): DbContext | undefined {
  return storage.getStore();
}

/**
 * The transaction-bound client for the active context.
 *
 * Throws `TenantContextError` outside a context. This is the guard: it turns
 * "why is this list empty?" into a stack trace pointing at the call that
 * forgot to open a context.
 */
export function contextDb(): TxDatabase {
  const context = storage.getStore();
  if (!context) {
    throw new TenantContextError(
      'No database context. Wrap this in withTenant(), withActor() or withPlatform().',
    );
  }
  return context.db;
}

/** The client for a *tenant* context specifically. Throws in actor/platform contexts. */
export function tenantDb(): TxDatabase {
  const context = storage.getStore();
  if (!context) {
    throw new TenantContextError(
      'No database context. Wrap this in withTenant() before touching tenant-scoped data.',
    );
  }
  if (context.kind !== 'tenant') {
    throw new TenantContextError(
      `Tenant-scoped data requires withTenant(); the active context is "${context.kind}".`,
    );
  }
  return context.db;
}

export function requireGymId(): string {
  const context = storage.getStore();
  if (!context?.gymId) {
    throw new TenantContextError('No gym in the active database context');
  }
  return context.gymId;
}

async function setLocal(db: TxDatabase, key: string, value: string): Promise<void> {
  // set_config(key, value, is_local => true) is SET LOCAL with a bind parameter.
  // SET LOCAL itself takes no parameters, which would mean interpolating a
  // gym id into SQL text on every request.
  await db.execute(sql`select set_config(${key}, ${value}, true)`);
}

export interface TenantContextInput {
  gymId: string;
  userId?: string | null;
  role?: Role | null;
}

/**
 * Open a tenant context and run `fn` inside it.
 *
 * Everything in `fn` runs in one transaction with `app.gym_id` set, so every
 * RLS policy resolves to this gym and nothing else.
 *
 * `app.is_platform` is deliberately NOT settable here, and is explicitly
 * cleared. A platform admin who has entered a gym via assumeGym() is scoped to
 * that gym exactly as its own manager would be — they see what the gym sees.
 * An earlier version passed the platform flag through, and the effect was that
 * entering one gym silently showed every gym's staff: the flag means "operate
 * across tenants", which is the opposite of what entering a tenant is for.
 * Cross-gym reads have one entry point, `withPlatform`.
 */
export async function withTenant<T>(
  input: TenantContextInput,
  fn: (db: TxDatabase) => Promise<T>,
): Promise<T> {
  const { gymId, userId = null, role = null } = input;

  return getAppDb().transaction(async (tx) => {
    await setLocal(tx, 'app.gym_id', gymId);
    await setLocal(tx, 'app.user_id', userId ?? '');
    await setLocal(tx, 'app.user_role', role ?? '');
    await setLocal(tx, 'app.is_platform', '');

    const context: DbContext = {
      kind: 'tenant',
      db: tx,
      gymId,
      userId,
      role,
      isPlatform: false,
    };
    return storage.run(context, () => fn(tx));
  });
}

/**
 * Open a user context with no gym.
 *
 * Used at sign-in, before a tenant is chosen: policies let a user read their
 * own `user_roles` rows so their gym memberships can be listed. It grants
 * nothing else — tenant tables stay invisible because `app.gym_id` is unset.
 */
export async function withActor<T>(userId: string, fn: (db: TxDatabase) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await setLocal(tx, 'app.gym_id', '');
    await setLocal(tx, 'app.user_id', userId);
    await setLocal(tx, 'app.user_role', '');
    await setLocal(tx, 'app.is_platform', '');

    const context: DbContext = {
      kind: 'actor',
      db: tx,
      gymId: null,
      userId,
      role: null,
      isPlatform: false,
    };
    return storage.run(context, () => fn(tx));
  });
}

/**
 * Open a cross-gym platform context.
 *
 * Membership of `platform_admins` is verified inside the same transaction
 * before the flag is set, so a caller cannot assert platform access for a user
 * who does not have it.
 */
export async function withPlatform<T>(
  userId: string,
  fn: (db: TxDatabase) => Promise<T>,
): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await setLocal(tx, 'app.gym_id', '');
    await setLocal(tx, 'app.user_id', userId);
    await setLocal(tx, 'app.user_role', 'platform_admin');
    await setLocal(tx, 'app.is_platform', '');

    const rows = await tx.execute(
      sql`select 1 from platform_admins where user_id = ${userId}::uuid limit 1`,
    );
    if (rows.length === 0) {
      throw new ForbiddenError('User is not a platform administrator');
    }

    await setLocal(tx, 'app.is_platform', 'on');

    const context: DbContext = {
      kind: 'platform',
      db: tx,
      gymId: null,
      userId,
      role: 'platform_admin',
      isPlatform: true,
    };
    return storage.run(context, () => fn(tx));
  });
}

/**
 * Escape hatch for unauthenticated lookups that must cross tenants — sign-in
 * by email being the only one in Phase 0.
 *
 * Runs as `gymx_app` with no GUCs set, so tenant policies still deny
 * everything; only tables that are not tenant-scoped (`users`) are reachable.
 */
export async function withAnonymous<T>(fn: (db: TxDatabase) => Promise<T>): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await setLocal(tx, 'app.gym_id', '');
    await setLocal(tx, 'app.user_id', '');
    await setLocal(tx, 'app.user_role', '');
    await setLocal(tx, 'app.is_platform', '');

    const context: DbContext = {
      kind: 'actor',
      db: tx,
      gymId: null,
      userId: null,
      role: null,
      isPlatform: false,
    };
    return storage.run(context, () => fn(tx));
  });
}
