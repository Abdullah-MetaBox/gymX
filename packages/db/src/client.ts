import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { dbEnv } from './env';
import * as schema from './schema/index';

export type Database = PostgresJsDatabase<typeof schema>;
export type Sql = postgres.Sql;

export interface ClientOptions {
  /** Pool size. Tests use 1 to force connection reuse and prove context cannot leak. */
  max?: number;
}

/** True when the URL points at Neon's PgBouncer endpoint rather than the database directly. */
function isPooledEndpoint(url: string): boolean {
  return url.includes('-pooler.');
}

/**
 * Driver options.
 *
 * Two Neon-specific details, both of which fail in ways that look like
 * something else:
 *
 *   - **`prepare: false` on the pooled endpoint.** Neon's pooler runs PgBouncer
 *     in transaction mode, where a prepared statement created on one server
 *     connection is not there when the next query lands on another. The failure
 *     is an intermittent "prepared statement does not exist" under load, not a
 *     clean error at startup.
 *
 *   - **Transaction-scoped settings still work.** `withTenant` uses
 *     `set_config(..., true)` — SET LOCAL — which lives and dies inside one
 *     transaction. PgBouncer's transaction mode holds a server connection for
 *     the duration of a transaction, so the tenant context is intact for every
 *     statement in it and gone afterwards. Session-level `SET` would have been
 *     silently broken here; we never used it.
 */
function driverOptions(url: string, options: ClientOptions, defaultMax: number) {
  return {
    max: options.max ?? defaultMax,
    prepare: !isPooledEndpoint(url),
    onnotice: () => {},
    // Neon requires TLS. `sslmode=require` in the URL covers it; this is the
    // belt for a URL that forgot the braces.
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : ('require' as const),
  };
}

let appSql: Sql | null = null;
let appDb: Database | null = null;

/**
 * The application connection: role `gymx_app`, owns nothing, NOBYPASSRLS.
 *
 * Every row-level security policy applies to it. This is the only connection
 * that may serve a request or run a job. On Neon this should be the **pooled**
 * endpoint (`...-pooler...`), because serverless functions open far more
 * connections than a database wants to see.
 */
export function getAppDb(options: ClientOptions = {}): Database {
  if (!appDb) {
    const url = dbEnv().APP_DATABASE_URL;
    appSql = postgres(url, {
      ...driverOptions(url, options, 10),
      // Timestamps come back as Date; the gym's timezone is applied by
      // @gymx/core/time, never by the driver.
      types: {},
    });
    appDb = drizzle(appSql, { schema });
  }
  return appDb;
}

export function getAppSql(): Sql {
  getAppDb();
  return appSql as Sql;
}

/**
 * The OWNER connection. Migrations, bootstrap and seeds only.
 *
 * Postgres does not apply row-level security to a table's owner, so anything
 * running here sees every tenant. Never import this from the admin app — the
 * rule is: if you are writing a feature, you want `withTenant`.
 *
 * On Neon this must be the **direct** (non-pooled) endpoint. Migrations take
 * advisory locks and issue DDL, neither of which survives a transaction-mode
 * pooler.
 */
export function createOwnerDb(options: ClientOptions = {}): { db: Database; sql: Sql } {
  const url = dbEnv().DATABASE_URL;
  const sql = postgres(url, driverOptions(url, options, 1));
  return { db: drizzle(sql, { schema }), sql };
}

/** Close pooled connections. Call from scripts and test teardown. */
export async function closeDb(): Promise<void> {
  if (appSql) {
    await appSql.end({ timeout: 5 });
    appSql = null;
    appDb = null;
  }
}

/** Reset the memoised client. Tests use this to re-open a pool with max: 1. */
export async function resetAppDb(): Promise<void> {
  await closeDb();
}
