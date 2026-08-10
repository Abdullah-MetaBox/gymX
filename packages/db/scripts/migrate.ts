/**
 * Run Drizzle migrations, then (re)apply row-level security.
 *
 *   pnpm db:migrate
 *
 * Both steps run as the OWNER against the DIRECT endpoint. sql/rls.sql is
 * idempotent and applied on every migrate, so a newly created table can never
 * sit unprotected: if a later phase adds a tenant table and forgets its policy,
 * `tenant.test.ts` fails rather than the table quietly serving every gym's rows.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { ownerSql } from './_connect';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = ownerSql();

  try {
    console.log('→ applying Drizzle migrations…');
    await migrate(drizzle(sql), { migrationsFolder: resolve(here, '../drizzle') });
    console.log('✓ migrations applied');

    console.log('→ applying row-level security policies…');
    const rls = await readFile(resolve(here, '../sql/rls.sql'), 'utf8');
    await sql.unsafe(rls);
    console.log('✓ RLS policies applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('\n✗ migrate failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
