import { Time } from '@gymx/core';
import { ROLE_LABELS } from '@gymx/core/auth';
import { userRoles, users } from '@gymx/db';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

/**
 * Who can sign in to this gym.
 *
 * The query has no `where gym_id = ...` clause and does not need one: RLS on
 * `user_roles` confines it to the active tenant. Another gym's staff are not
 * filtered out — they are not visible in the first place.
 */
export default async function TeamPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'user');

  // A platform admin who has not entered a gym has no tenant to query. Render
  // the empty state rather than letting the missing context become a 500.
  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'user' }, (db) =>
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        role: userRoles.role,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId)),
  );

  return (
    <>
      <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} />

      {rows.length === 0 ? (
        <EmptyState title={t('team.empty')} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{t('team.name')}</Th>
                <Th>{t('team.email')}</Th>
                <Th>{t('team.role')}</Th>
                <Th>{t('team.lastLogin')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-muted">{row.email}</Td>
                  <Td>
                    <Badge tone={row.role === 'accountant' ? 'neutral' : 'primary'}>
                      {ROLE_LABELS[row.role]}
                    </Badge>
                  </Td>
                  <Td className="text-muted">
                    {row.lastLoginAt
                      ? Time.formatInstant(row.lastLoginAt, { timeZone: context.timeZone })
                      : t('team.never')}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
