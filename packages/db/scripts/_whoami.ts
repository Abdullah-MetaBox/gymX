/** Throwaway: what does Clerk hold, and does it match a GymX user? */
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

loadEnv({ path: '../../.env', quiet: true });

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string; verification?: { status?: string } }[];
  external_accounts?: { provider?: string }[];
  created_at: number;
}

async function main() {
  const r = await fetch('https://api.clerk.com/v1/users?limit=50', {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  const clerkUsers = (await r.json()) as ClerkUser[];

  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });
  try {
    const gymxUsers = await db
      .select({ email: schema.users.email, clerkUserId: schema.users.clerkUserId })
      .from(schema.users);
    const byEmail = new Map(gymxUsers.map((u) => [u.email, u]));

    console.log('CLERK ACCOUNTS:');
    for (const cu of clerkUsers) {
      const email = cu.email_addresses[0]?.email_address ?? '(no email)';
      const verified = cu.email_addresses[0]?.verification?.status ?? '?';
      const providers = (cu.external_accounts ?? []).map((a) => a.provider).join(',') || 'password';
      const match = byEmail.get(email);
      console.log(
        `  ${email.padEnd(26)} via=${providers.padEnd(14)} verified=${verified.padEnd(9)} ` +
          `gymx=${match ? 'YES' : '*** NO MATCHING users ROW ***'}`,
      );
    }

    console.log('\nGYMX USERS WITH NO CLERK LINK:');
    const unlinked = gymxUsers.filter((u) => !u.clerkUserId);
    console.log(unlinked.length ? unlinked.map((u) => `  ${u.email}`).join('\n') : '  (none)');
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main();
