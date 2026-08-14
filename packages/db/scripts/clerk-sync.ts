/**
 * Create Clerk accounts for the seeded GymX users, and link them.
 *
 *   pnpm db:clerk-sync
 *
 * Identity lives in Clerk, authorisation lives in `users`. This script only
 * bridges the two for development and demo data — in production a gym's staff
 * are invited through Clerk and linked on first sign-in by verified email, so
 * nothing here runs.
 *
 * Idempotent: an account that already exists is linked rather than recreated.
 */
import { config as loadEnv } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

loadEnv({ path: '../../.env', quiet: true });

const DEV_PASSWORD = 'GymX!dev2026';
const CLERK_API = 'https://api.clerk.com/v1';

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string }[];
}

async function clerk<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Clerk ${init?.method ?? 'GET'} ${path} -> ${response.status}: ${body}`);
  }
  return body ? (JSON.parse(body) as T) : ({} as T);
}

async function findByEmail(email: string): Promise<ClerkUser | null> {
  const found = await clerk<ClerkUser[]>(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  return found[0] ?? null;
}

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not set');
  }

  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });

  try {
    const rows = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users);

    for (const user of rows) {
      const [firstName, ...rest] = user.name.split(' ');

      let clerkUser = await findByEmail(user.email);
      if (clerkUser) {
        console.log(`  • ${user.email} — already in Clerk`);
      } else {
        clerkUser = await clerk<ClerkUser>('/users', {
          method: 'POST',
          body: JSON.stringify({
            email_address: [user.email],
            password: DEV_PASSWORD,
            first_name: firstName || user.name,
            last_name: rest.join(' ') || undefined,
            skip_password_checks: true,
            skip_legal_checks: true,
          }),
        });
        console.log(`  ✓ ${user.email} — created in Clerk`);
      }

      // Runs as the owner, which bypasses RLS. Correct for a provisioning
      // script and wrong for anything the app does.
      await db
        .update(schema.users)
        .set({ clerkUserId: clerkUser.id, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));
    }

    console.log(`\n✓ linked ${rows.length} users. Password for all: ${DEV_PASSWORD}`);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
