import { Time } from '@gymx/core';
import { createOwnerDb, gyms, platformAdmins, withPlatform } from '@gymx/db';
import { registerJob } from '../registry';

/**
 * Heartbeat.
 *
 * Proves the whole scheduling path end to end — the cron fires, the endpoint
 * authenticates, the handler runs, the database is reachable through the
 * application role, output is logged. So when Phase 3's invoicing job does not
 * run at 02:00, we already know the plumbing is not the reason.
 *
 * It also reports each gym's local time, which makes an accidental UTC
 * assumption visible in the logs immediately rather than at the moment a lunch
 * member is turned away.
 */
registerJob({
  name: 'heartbeat',
  description: 'Confirms the runner can reach the database and read gym-local time.',
  schedule: '0 2 * * *',
  timezone: Time.DEFAULT_TIME_ZONE,
  idempotent: true,

  async handler(_payload, { logger, now }) {
    const rows = await asPlatform((db) => db.select().from(gyms));

    logger.info('heartbeat', { gyms: rows.length });

    for (const gym of rows) {
      logger.info('gym clock', {
        gym: gym.slug,
        timezone: gym.timezone,
        localTime: Time.formatInstant(now, { timeZone: gym.timezone }),
        localDate: Time.dateKeyInZone(now, gym.timezone),
      });
    }
  },
});

/**
 * Run as the platform, for jobs that legitimately span every gym.
 *
 * There is no signed-in user in a scheduled run, so it borrows the identity of
 * a platform admin — verified against `platform_admins` inside the transaction
 * by `withPlatform`, so a job cannot assert access nobody holds.
 *
 * Per-gym jobs from Phase 3 onwards should instead loop over gyms and use
 * `withTenant` for each, so RLS scopes the work exactly as it would a request.
 */
async function asPlatform<T>(fn: Parameters<typeof withPlatform<T>>[1]): Promise<T> {
  const { db, sql } = createOwnerDb();
  let userId: string | undefined;
  try {
    const [admin] = await db.select().from(platformAdmins).limit(1);
    userId = admin?.userId;
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (!userId) {
    throw new Error('No platform administrator exists. Run: pnpm db:seed');
  }
  return withPlatform(userId, fn);
}
