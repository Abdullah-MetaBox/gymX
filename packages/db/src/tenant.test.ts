import { ForbiddenError, TenantContextError } from '@gymx/core/errors';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, createOwnerDb, getAppDb, resetAppDb } from './client';
import { auditLog, gyms, locations, userRoles, users } from './schema/index';
import { contextDb, tenantDb, withActor, withAnonymous, withPlatform, withTenant } from './tenant';

/**
 * The tests that make Phase 0 real.
 *
 * They run as `gymx_app`, never as the owner. That distinction is the whole
 * point: Postgres exempts a table's owner from row-level security, so an
 * identical suite run as the owner would pass every assertion while proving
 * nothing at all.
 */

let gymAbcId: string;
let northsideId: string;
let platformAdminId: string;
let abcManagerId: string;
let northsideManagerId: string;

beforeAll(async () => {
  // Look the fixtures up as the owner — the only place in the suite that is
  // allowed to see across tenants.
  const { db, sql: ownerSql } = createOwnerDb();
  try {
    const gymRows = await db.select().from(gyms);
    gymAbcId = gymRows.find((g) => g.slug === 'gym-abc')?.id ?? '';
    northsideId = gymRows.find((g) => g.slug === 'northside')?.id ?? '';

    const userRows = await db.select().from(users);
    platformAdminId = userRows.find((u) => u.email === 'admin@metabox.mu')?.id ?? '';
    abcManagerId = userRows.find((u) => u.email === 'manager@gymabc.mu')?.id ?? '';
    northsideManagerId = userRows.find((u) => u.email === 'manager@northside.mu')?.id ?? '';
  } finally {
    await ownerSql.end({ timeout: 5 });
  }

  if (!gymAbcId || !northsideId || !platformAdminId || !abcManagerId) {
    throw new Error(
      'Seed data missing. Run: pnpm db:reset && pnpm db:bootstrap && pnpm db:migrate && pnpm db:seed',
    );
  }

  // A pool of exactly ONE connection, so every transaction below is forced to
  // reuse the same physical connection. That is what makes the context-leak
  // test meaningful rather than accidentally passing on a fresh connection.
  await resetAppDb();
  getAppDb({ max: 1 });
});

afterAll(async () => {
  await closeDb();
});

describe('the application connects as a role that RLS actually applies to', () => {
  it('is gymx_app, not the owner, and cannot bypass RLS', async () => {
    const [row] = await withAnonymous(async (db) => {
      const result = await db.execute<{
        current_user: string;
        rolbypassrls: boolean;
        owned_tables: number;
      }>(sql`
        SELECT current_user,
               r.rolbypassrls,
               (SELECT count(*) FROM pg_class c
                 WHERE c.relowner = r.oid AND c.relkind = 'r')::int AS owned_tables
        FROM pg_roles r WHERE r.rolname = current_user
      `);
      return result;
    });

    expect(row?.current_user).toBe('gymx_app');
    expect(row?.rolbypassrls).toBe(false);
    // RLS does not apply to a table's owner. The app must own nothing.
    expect(row?.owned_tables).toBe(0);
  });
});

describe('tenant isolation', () => {
  it('sees only its own gym', async () => {
    const rows = await withTenant(
      { gymId: gymAbcId, userId: abcManagerId, role: 'gym_manager' },
      (db) => db.select().from(gyms),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(gymAbcId);
  });

  it('returns ZERO rows when explicitly selecting another gym by id', async () => {
    // Not "the query was filtered" -- the row is invisible even when named.
    const rows = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(gyms).where(eq(gyms.id, northsideId)),
    );

    expect(rows).toHaveLength(0);
  });

  it('cannot see another gym"s locations', async () => {
    const own = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(locations),
    );
    const theirs = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(locations).where(eq(locations.gymId, northsideId)),
    );

    expect(own.length).toBeGreaterThan(0);
    expect(own.every((row) => row.gymId === gymAbcId)).toBe(true);
    expect(theirs).toHaveLength(0);
  });

  it('cannot see another gym"s staff assignments', async () => {
    const rows = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(userRoles),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.gymId === gymAbcId)).toBe(true);
    expect(rows.some((row) => row.userId === northsideManagerId)).toBe(false);
  });

  it('cannot see another gym"s audit trail', async () => {
    const rows = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(auditLog),
    );

    expect(rows.every((row) => row.gymId === gymAbcId)).toBe(true);
  });

  it('REFUSES a write that smuggles in another gym"s id', async () => {
    // WITH CHECK is the half of RLS people forget. Without it a tenant can
    // read only its own rows but happily write into someone else's.
    await expect(
      withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
        db.insert(locations).values({ gymId: northsideId, name: 'Smuggled' }),
      ),
    ).rejects.toThrow(/row-level security/i);

    const leaked = await withTenant({ gymId: northsideId, role: 'gym_manager' }, (db) =>
      db.select().from(locations).where(eq(locations.name, 'Smuggled')),
    );
    expect(leaked).toHaveLength(0);
  });

  it('cannot update another gym"s row', async () => {
    await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.update(gyms).set({ name: 'Hijacked' }).where(eq(gyms.id, northsideId)),
    );

    // The UPDATE matches no visible row, so it is a silent no-op rather than
    // an error -- which is exactly why the assertion checks the other tenant.
    const [target] = await withTenant({ gymId: northsideId, role: 'gym_manager' }, (db) =>
      db.select().from(gyms).where(eq(gyms.id, northsideId)),
    );
    expect(target?.name).toBe('Northside Fitness');
  });
});

describe('context does not survive a transaction', () => {
  it('does not leak across sequential transactions on ONE pooled connection', async () => {
    // `SET LOCAL` dies with the transaction. If this ever regresses to `SET`,
    // gym B's request would inherit gym A's context from the pool.
    const first = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(gyms),
    );
    const second = await withTenant({ gymId: northsideId, role: 'gym_manager' }, (db) =>
      db.select().from(gyms),
    );

    expect(first.map((g) => g.id)).toEqual([gymAbcId]);
    expect(second.map((g) => g.id)).toEqual([northsideId]);
  });

  it('leaves no tenant visible once the context closes', async () => {
    await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) => db.select().from(gyms));

    // A later context with no gym set must see nothing: policies key off a
    // setting that is now NULL, and `column = NULL` is not true.
    const afterwards = await withAnonymous((db) => db.select().from(gyms));
    expect(afterwards).toHaveLength(0);
  });

  it('fails closed when no gym is set', async () => {
    const rows = await withActor(abcManagerId, (db) => db.select().from(locations));
    expect(rows).toHaveLength(0);
  });
});

describe('the developer guard', () => {
  it('throws a legible error when tenant data is touched with no context', () => {
    expect(() => tenantDb()).toThrow(TenantContextError);
    expect(() => contextDb()).toThrow(/withTenant/);
  });

  it('refuses tenantDb() inside a non-tenant context', async () => {
    await withActor(abcManagerId, async () => {
      expect(() => tenantDb()).toThrow(TenantContextError);
    });
  });

  it('provides the transaction client inside a tenant context', async () => {
    await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, async () => {
      expect(() => tenantDb()).not.toThrow();
    });
  });
});

describe('append-only tables', () => {
  it('permits INSERT and SELECT on the audit log', async () => {
    await withTenant({ gymId: gymAbcId, userId: abcManagerId, role: 'gym_manager' }, async (db) => {
      await db.insert(auditLog).values({
        gymId: gymAbcId,
        userId: abcManagerId,
        entity: 'test',
        entityId: 'append-only',
        action: 'probe',
      });
    });

    const rows = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(auditLog).where(eq(auditLog.action, 'probe')),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('REFUSES UPDATE on the audit log', async () => {
    await expect(
      withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
        db.update(auditLog).set({ action: 'rewritten' }).where(eq(auditLog.action, 'probe')),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('REFUSES DELETE on the audit log', async () => {
    await expect(
      withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
        db.delete(auditLog).where(eq(auditLog.action, 'probe')),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe('withActor — sign-in before a tenant is chosen', () => {
  it('lets a user read their own gym memberships', async () => {
    const rows = await withActor(abcManagerId, (db) =>
      db.select().from(userRoles).where(eq(userRoles.userId, abcManagerId)),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.gymId).toBe(gymAbcId);
  });

  it('does NOT let a user read anyone else"s memberships', async () => {
    const rows = await withActor(abcManagerId, (db) =>
      db.select().from(userRoles).where(eq(userRoles.userId, northsideManagerId)),
    );

    expect(rows).toHaveLength(0);
  });

  it('lets a user list the gyms they belong to, with no gym selected', async () => {
    // The sign-in bootstrap: "which gyms do you belong to?" has to be
    // answerable before a gym is active. This originally returned nothing --
    // user_roles was readable but the joined `gyms` row was not, so the inner
    // join silently dropped every membership and every user looked orphaned.
    // A missing row, not an error, which is why it needs a test.
    const rows = await withActor(abcManagerId, (db) =>
      db
        .select({ gymId: userRoles.gymId, role: userRoles.role, gymName: gyms.name })
        .from(userRoles)
        .innerJoin(gyms, eq(gyms.id, userRoles.gymId))
        .where(eq(userRoles.userId, abcManagerId)),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.gymName).toBe('Gym ABC');
    expect(rows[0]?.role).toBe('gym_manager');
  });

  it('does NOT let a user see a gym they hold no role in', async () => {
    const rows = await withActor(abcManagerId, (db) =>
      db.select().from(gyms).where(eq(gyms.id, northsideId)),
    );
    expect(rows).toHaveLength(0);
  });

  it('lets a user read their own identity and nobody else"s', async () => {
    const own = await withActor(abcManagerId, (db) =>
      db.select().from(users).where(eq(users.id, abcManagerId)),
    );
    const other = await withActor(abcManagerId, (db) =>
      db.select().from(users).where(eq(users.id, northsideManagerId)),
    );

    expect(own).toHaveLength(1);
    expect(other).toHaveLength(0);
  });
});

describe('withPlatform — the audited cross-gym escape hatch', () => {
  it('lets a verified platform admin see every gym', async () => {
    const rows = await withPlatform(platformAdminId, (db) => db.select().from(gyms));
    const ids = rows.map((g) => g.id);

    expect(ids).toContain(gymAbcId);
    expect(ids).toContain(northsideId);
  });

  it('REFUSES a user who is not a platform admin', async () => {
    // Verified against platform_admins inside the transaction, before the flag
    // is raised -- so a caller cannot assert platform access it does not hold.
    await expect(withPlatform(abcManagerId, async (db) => db.select().from(gyms))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('gives a gym manager no ambient cross-gym reach', async () => {
    const rows = await withTenant({ gymId: gymAbcId, role: 'gym_manager' }, (db) =>
      db.select().from(gyms),
    );
    expect(rows).toHaveLength(1);
  });

  it('scopes a platform admin INSIDE an assumed gym to that gym alone', async () => {
    // The bug this pins: entering a gym used to carry the platform flag into
    // the tenant context, and the user_roles policy reads that flag as "show
    // everything". The effect was that opening Gym ABC's team page listed
    // Northside's staff too. Entering a tenant is an act of narrowing; only
    // withPlatform crosses tenants.
    const roles = await withTenant(
      { gymId: gymAbcId, userId: platformAdminId, role: 'platform_admin' },
      (db) => db.select().from(userRoles),
    );

    expect(roles.length).toBeGreaterThan(0);
    expect(roles.every((row) => row.gymId === gymAbcId)).toBe(true);
    expect(roles.some((row) => row.userId === northsideManagerId)).toBe(false);

    // And they see exactly one gym, not the whole platform.
    const visibleGyms = await withTenant(
      { gymId: gymAbcId, userId: platformAdminId, role: 'platform_admin' },
      (db) => db.select().from(gyms),
    );
    expect(visibleGyms.map((g) => g.id)).toEqual([gymAbcId]);
  });

  it('confines a platform admin"s writes to the gym they assumed', async () => {
    // Reading across gyms is the point of assumeGym(); writing across them is not.
    await expect(
      withTenant({ gymId: gymAbcId, userId: platformAdminId, role: 'platform_admin' }, (db) =>
        db.insert(locations).values({ gymId: northsideId, name: 'Platform smuggled' }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe('no tenant table is left unprotected', () => {
  it('has RLS enabled and forced on every table carrying a gym_id', async () => {
    // The regression this catches: a later phase adds a table with a gym_id
    // and forgets to write its policy in sql/rls.sql. Without this test the
    // table would quietly serve every gym's rows.
    const { db, sql: ownerSql } = createOwnerDb();
    try {
      const rows = await db.execute<{
        table_name: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
        policy_count: number;
      }>(sql`
        SELECT c.relname       AS table_name,
               c.relrowsecurity,
               c.relforcerowsecurity,
               (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND EXISTS (
            SELECT 1 FROM information_schema.columns col
            WHERE col.table_schema = 'public'
              AND col.table_name = c.relname
              AND col.column_name = 'gym_id'
          )
      `);

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.relrowsecurity, `${row.table_name} must ENABLE ROW LEVEL SECURITY`).toBe(true);
        expect(row.relforcerowsecurity, `${row.table_name} must FORCE ROW LEVEL SECURITY`).toBe(
          true,
        );
        expect(row.policy_count, `${row.table_name} must have at least one policy`).toBeGreaterThan(
          0,
        );
      }
    } finally {
      await ownerSql.end({ timeout: 5 });
    }
  });

  it('protects the gyms table itself, which has no gym_id column', async () => {
    const { db, sql: ownerSql } = createOwnerDb();
    try {
      const rows = await db.execute<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(sql`
        SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE oid = 'public.gyms'::regclass
      `);
      expect(rows[0]?.relrowsecurity).toBe(true);
      expect(rows[0]?.relforcerowsecurity).toBe(true);
    } finally {
      await ownerSql.end({ timeout: 5 });
    }
  });
});

describe('cleanup', () => {
  it('removes the probe rows written by this suite', async () => {
    const { db, sql: ownerSql } = createOwnerDb();
    try {
      await db.delete(auditLog).where(eq(auditLog.action, 'probe'));
      await db.delete(locations).where(and(eq(locations.name, 'Smuggled')));
    } finally {
      await ownerSql.end({ timeout: 5 });
    }
    expect(true).toBe(true);
  });
});
