import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

async function main() {
  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });

  try {
    const gym = await db.select().from(schema.gyms).where(eq(schema.gyms.slug, 'gym-abc'));
    console.log('Gym ABC:', JSON.stringify(gym, null, 2));

    if (gym.length === 0) {
      console.log('No gym found with slug gym-abc, checking all gyms:');
      const allGyms = await db.select({ slug: schema.gyms.slug, name: schema.gyms.name, branding: schema.gyms.branding }).from(schema.gyms);
      console.log('All gyms:', JSON.stringify(allGyms, null, 2));
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main();
