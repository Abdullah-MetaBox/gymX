import { z } from 'zod';

/**
 * Application environment, validated at import time.
 *
 * The app refuses to boot on a missing or malformed value rather than
 * discovering it at 2am against a null connection string.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_URL: z.string().url().optional(),
  /** Vercel Blob read/write token. Required from Phase 1 (member photos). */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  /** Shared secret for the scheduled-jobs endpoint. */
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}\n\nDid you copy .env.example to .env?`);
  }

  // A pooled URL for migrations, or a direct one for the app, both fail in
  // confusing ways much later. Catch the swap at boot.
  if (parsed.data.DATABASE_URL.includes('-pooler.')) {
    throw new Error(
      'DATABASE_URL is the pooled Neon endpoint. It must be the DIRECT host — ' +
        'migrations take advisory locks that a transaction-mode pooler breaks. ' +
        'The pooled URL belongs in APP_DATABASE_URL.',
    );
  }

  if (parsed.data.NODE_ENV === 'production' && !parsed.data.CRON_SECRET) {
    throw new Error('CRON_SECRET must be set in production, or scheduled jobs cannot run.');
  }

  return parsed.data;
}

export const env = load();
