import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/schema/index';
import { ownerSql } from './_connect';

async function main() {
  const sqlClient = ownerSql();
  const db = drizzle(sqlClient, { schema });

  try {
    // Find the Gym ABC user
    const gymAbcUsers = await db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        gymId: schema.userRoles.gymId,
        gymName: schema.gyms.name,
        gymSlug: schema.gyms.slug,
        branding: schema.gyms.branding,
      })
      .from(schema.users)
      .innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
      .innerJoin(schema.gyms, eq(schema.gyms.id, schema.userRoles.gymId))
      .where(eq(schema.users.email, 'manager@gymabc.mu'));

    console.log('Gym ABC user data:', JSON.stringify(gymAbcUsers, null, 2));
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main();
