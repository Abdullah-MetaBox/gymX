/**
 * One-time database bootstrap. Run before the first migration:
 *
 *   pnpm db:bootstrap
 *
 * Creates the `gymx_app` role the application connects as. Idempotent.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCRIPT EXISTS, AND WHY IT REFUSES TO CONTINUE ON A BAD ROLE
 * ---------------------------------------------------------------------------
 * Postgres exempts a table's owner from row-level security. An application
 * connecting as the owner sails through every policy in sql/rls.sql without a
 * single error to warn you — the tenancy model would appear to work while
 * enforcing nothing.
 *
 * On Neon there is a second, sharper version of the same trap: **roles created
 * through the Neon console or API are granted `neon_superuser`, which carries
 * BYPASSRLS.** Such a role would defeat every policy we have. `gymx_app` must
 * therefore be created here, in plain SQL, where it is an ordinary role with
 * BYPASSRLS off by default.
 *
 * The verification at the end is not ceremony. It is the only thing standing
 * between "we have row-level security" and "we believe we have row-level
 * security".
 */
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

loadEnv({ path: '../../.env', quiet: true });

function parse(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    user: decodeURIComponent(parsed.username),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

function isLocal(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

async function main() {
  const ownerUrl = process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;
  const appPassword = process.env.APP_DB_PASSWORD;

  if (!ownerUrl || !appUrl || !appPassword) {
    throw new Error('DATABASE_URL, APP_DATABASE_URL and APP_DB_PASSWORD must all be set');
  }

  const owner = parse(ownerUrl);
  const app = parse(appUrl);

  if (owner.database !== app.database) {
    throw new Error(
      `DATABASE_URL and APP_DATABASE_URL must point at the same database ` +
        `(got "${owner.database}" and "${app.database}")`,
    );
  }

  if (ownerUrl.includes('-pooler.')) {
    throw new Error(
      'DATABASE_URL must be the DIRECT Neon endpoint, not the pooler. Migrations ' +
        'take advisory locks and issue DDL, which a transaction-mode pooler breaks.',
    );
  }

  // A managed provider hands you a database; only a local server needs one made.
  if (isLocal(owner.host)) {
    const admin = postgres(ownerUrl.replace(/\/[^/?]+(\?|$)/, '/postgres$1'), {
      max: 1,
      onnotice: () => {},
    });
    try {
      const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${owner.database}`;
      if (existing.length === 0) {
        await admin.unsafe(`CREATE DATABASE "${owner.database}"`);
        console.log(`✓ created database "${owner.database}"`);
      } else {
        console.log(`• database "${owner.database}" already exists`);
      }
    } finally {
      await admin.end({ timeout: 5 });
    }
  } else {
    console.log(`• managed database "${owner.database}" on ${owner.host} — creation skipped`);
  }

  const target = postgres(ownerUrl, {
    max: 1,
    onnotice: () => {},
    ssl: isLocal(owner.host) ? undefined : 'require',
  });

  try {
    const escapedPassword = appPassword.replace(/'/g, "''");

    const role = await target`SELECT 1 FROM pg_roles WHERE rolname = ${app.user}`;
    if (role.length === 0) {
      // Plain CREATE ROLE. NOBYPASSRLS is the default, and stated anyway so the
      // intent survives a future edit.
      await target.unsafe(
        `CREATE ROLE "${app.user}" LOGIN PASSWORD '${escapedPassword}' NOBYPASSRLS`,
      );
      console.log(`✓ created role "${app.user}"`);
    } else {
      await target.unsafe(`ALTER ROLE "${app.user}" LOGIN PASSWORD '${escapedPassword}'`);
      console.log(`• role "${app.user}" already exists — password reasserted`);
    }

    await target.unsafe(`GRANT CONNECT ON DATABASE "${owner.database}" TO "${app.user}"`);
    await target.unsafe(`GRANT USAGE ON SCHEMA public TO "${app.user}"`);

    // --- The checks that make the tenancy model real ----------------------
    const [check] = await target<
      { rolbypassrls: boolean; rolsuper: boolean; owns: number; inherits: string[] }[]
    >`
      SELECT r.rolbypassrls,
             r.rolsuper,
             (SELECT count(*) FROM pg_class c
               WHERE c.relowner = r.oid AND c.relkind = 'r')::int AS owns,
             COALESCE(
               (SELECT array_agg(g.rolname)
                  FROM pg_auth_members m
                  JOIN pg_roles g ON g.oid = m.roleid
                 WHERE m.member = r.oid),
               ARRAY[]::name[]
             ) AS inherits
      FROM pg_roles r WHERE r.rolname = ${app.user}
    `;

    if (!check) throw new Error(`Role "${app.user}" not found after creation`);

    if (check.rolbypassrls || check.rolsuper) {
      throw new Error(
        `Role "${app.user}" can bypass row-level security (bypassrls=${check.rolbypassrls}, ` +
          `superuser=${check.rolsuper}). Every tenancy guarantee in this codebase depends on ` +
          `it not being able to. If this role was created through the Neon console, drop it ` +
          `and re-run this script — console-created roles inherit neon_superuser, which has ` +
          `BYPASSRLS.`,
      );
    }

    // neon_superuser carries BYPASSRLS, so inheriting it is as bad as holding it.
    const dangerous = check.inherits.filter((r) => r === 'neon_superuser' || r === 'rds_superuser');
    if (dangerous.length > 0) {
      throw new Error(
        `Role "${app.user}" inherits ${dangerous.join(', ')}, which grants BYPASSRLS. ` +
          `Run: REVOKE ${dangerous.join(', ')} FROM "${app.user}";`,
      );
    }

    if (check.owns > 0) {
      throw new Error(
        `Role "${app.user}" owns ${check.owns} table(s). RLS does not apply to a table's ` +
          `owner, so the application role must own nothing.`,
      );
    }

    console.log(`✓ verified "${app.user}": NOBYPASSRLS, not superuser, owns no tables`);
    if (check.inherits.length > 0) {
      console.log(`  (inherits: ${check.inherits.join(', ')})`);
    }
  } finally {
    await target.end({ timeout: 5 });
  }

  console.log('\nBootstrap complete. Next: pnpm db:migrate');
}

main().catch((error) => {
  console.error('\n✗ bootstrap failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
