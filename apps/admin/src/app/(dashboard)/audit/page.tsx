import { Time } from '@gymx/core';
import { auditLog } from '@gymx/db';
import { desc } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

/**
 * The audit trail for this gym.
 *
 * The table is append-only in Postgres, so what is shown here cannot have been
 * edited by the application that wrote it. Rows carrying `assumedGymId` are
 * badged: that is a Metabox platform admin having entered the gym, and a gym
 * owner is entitled to see exactly when that happened.
 */
export default async function AuditPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'audit_log');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'audit_log' }, (db) =>
    db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(100),
  );

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      {rows.length === 0 ? (
        <EmptyState title={t('audit.empty')} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{t('audit.when')}</Th>
                <Th>{t('audit.who')}</Th>
                <Th>{t('audit.entity')}</Th>
                <Th>{t('audit.action')}</Th>
                <Th>{t('audit.changes')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap text-muted">
                    {Time.formatInstant(row.at, {
                      timeZone: context.timeZone,
                      timeStyle: 'medium',
                    })}
                  </Td>
                  <Td>
                    <span className="font-medium">{row.actorEmail ?? '—'}</span>
                    {row.assumedGymId ? (
                      <Badge tone="warning" className="ml-2">
                        {t('audit.assumedBadge')}
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="text-muted">
                    {row.entity}
                    {row.entityId ? (
                      <span className="ml-1 font-mono text-xs opacity-60">
                        {row.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge>{row.action}</Badge>
                  </Td>
                  <Td className="max-w-md">
                    {row.diff ? (
                      <code className="block truncate font-mono text-muted text-xs">
                        {JSON.stringify(row.diff)}
                      </code>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
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
