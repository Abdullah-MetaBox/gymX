import { z } from 'zod';

/**
 * Database environment, validated at import time.
 *
 * The app refuses to boot on a missing or malformed value rather than
 * discovering it against a null connection string in production.
 */
const schema = z.object({
  /**
   * Owner / superuser connection. Runs migrations and the bootstrap script.
   *
   * Postgres does not apply row-level security to a table's owner, so this
   * connection can see every tenant's data. It must never serve a request.
   */
  DATABASE_URL: z.string().url(),

  /**
   * The `gymx_app` role: owns nothing, NOBYPASSRLS, subject to every policy.
   * Everything the admin app and the worker do goes through this.
   */
  APP_DATABASE_URL: z.string().url(),

  APP_DB_PASSWORD: z.string().min(8).default('gymx_app_dev_password'),
});

export type DbEnv = z.infer<typeof schema>;

let cached: DbEnv | null = null;

export function dbEnv(): DbEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid database environment:\n${issues}\n\nDid you copy .env.example to .env?`,
    );
  }
  // Swapping the two URLs fails much later and confusingly: migrations hang on
  // an advisory lock the pooler cannot hold, or the app exhausts connections.
  // Catch it at boot instead.
  if (parsed.data.DATABASE_URL.includes('-pooler.')) {
    throw new Error(
      'DATABASE_URL is the pooled Neon endpoint. It must be the DIRECT host — ' +
        'migrations take advisory locks and issue DDL, which a transaction-mode ' +
        'pooler breaks. The pooled URL belongs in APP_DATABASE_URL.',
    );
  }

  cached = parsed.data;
  return cached;
}
