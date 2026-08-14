/** Throwaway diagnostic: prints the seeded shape of every gym. Not part of the build. */
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

async function main() {
  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });
  try {
    const gyms = await db.select({ id: schema.gyms.id, slug: schema.gyms.slug }).from(schema.gyms);

    for (const g of gyms) {
      const mem = await db
        .select({
          seq: schema.members.memberSeq,
          f: schema.members.firstName,
          l: schema.members.lastName,
          s: schema.members.status,
        })
        .from(schema.members)
        .where(eq(schema.members.gymId, g.id));
      const hh = await db
        .select({
          id: schema.households.id,
          name: schema.households.name,
          payer: schema.households.payerMemberId,
        })
        .from(schema.households)
        .where(eq(schema.households.gymId, g.id));
      const subs = await db
        .select({ status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.gymId, g.id));

      console.log(`\n== ${g.slug} (${g.id}) ==`);
      console.log(
        `  members (${mem.length}): ${mem.map((m) => `#${m.seq} ${m.f} ${m.l}[${m.s}]`).join(' | ')}`,
      );
      console.log(`  subscriptions (${subs.length}): ${subs.map((s) => s.status).join(', ')}`);
      console.log(`  households (${hh.length}):`);
      for (const h of hh) {
        const hm = await db
          .select({ rel: schema.householdMembers.relationship })
          .from(schema.householdMembers)
          .where(eq(schema.householdMembers.householdId, h.id));
        console.log(
          `    "${h.name}" payer=${h.payer ?? 'NONE'} members=${hm.length} [${hm.map((x) => x.rel).join(', ')}]`,
        );
      }
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main();
