import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

async function main() {
  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });

  try {
    // First check what exists
    const existing = await db.select({ id: schema.gyms.id, slug: schema.gyms.slug, branding: schema.gyms.branding }).from(schema.gyms);
    console.log('Existing gyms:', JSON.stringify(existing, null, 2));

    const result = await db
      .update(schema.gyms)
      .set({
        branding: { primaryColor: '#d946ef', accentColor: '#0f766e' },
      })
      .where(eq(schema.gyms.slug, 'gym-abc'));

    console.log('✓ Updated Gym ABC branding to purple');
    console.log('Rows affected:', result.rowCount);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main();
