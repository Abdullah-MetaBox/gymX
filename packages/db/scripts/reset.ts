/**
 * Drop and recreate the public schema.
 *
 *   pnpm db:reset
 *
 * Destructive. Refuses to run against NODE_ENV=production, and asks for
 * confirmation before touching a managed (non-localhost) database — with one
 * shared Neon database across dev and CI, an unguarded reset is a good way to
 * delete a colleague's afternoon.
 */
import { ownerSql } from './_connect';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset will not run with NODE_ENV=production');
  }

  const url = process.env.DATABASE_URL as string;
  const host = new URL(url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';

  if (!local && process.env.CONFIRM_RESET !== 'yes') {
    throw new Error(
      `Refusing to reset the managed database at ${host}.\n` +
        `This drops every table and every row, for everyone using it.\n` +
        `If you are certain, re-run with: CONFIRM_RESET=yes pnpm db:reset`,
    );
  }

  const sql = ownerSql();
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    console.log(`✓ schema dropped and recreated on ${host}`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log('\nNext: pnpm db:bootstrap && pnpm db:migrate && pnpm db:seed');
}

main().catch((error) => {
  console.error('\n✗ reset failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
