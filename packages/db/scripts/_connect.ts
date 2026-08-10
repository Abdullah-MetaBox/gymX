import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '../../.env', quiet: true });

/**
 * Owner connection for scripts (migrate, seed, reset).
 *
 * Always the DIRECT endpoint. Migrations take advisory locks and issue DDL,
 * neither of which survives Neon's transaction-mode pooler, and the failure is
 * an obscure lock error rather than anything that names the real cause.
 */
export function ownerSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  if (url.includes('-pooler.')) {
    throw new Error(
      'DATABASE_URL points at the Neon pooler. Scripts need the direct endpoint ' +
        '(the host without "-pooler"). The pooled URL belongs in APP_DATABASE_URL.',
    );
  }

  const local = url.includes('localhost') || url.includes('127.0.0.1');
  return postgres(url, {
    max: 1,
    onnotice: () => {},
    prepare: true,
    ssl: local ? undefined : 'require',
  });
}
