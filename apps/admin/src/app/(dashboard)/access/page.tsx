import { formatMemberCode, members } from '@gymx/db';
import { asc, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { EmptyState, PageHeader } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';
import { CheckInPanel } from './check-in-panel';

export default async function AccessPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'access_event');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('access.title')} subtitle={t('access.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} />
      </>
    );
  }

  const memberRows = await queryInGym({ action: 'read', subject: 'member' }, (db) =>
    db
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        memberSeq: members.memberSeq,
      })
      .from(members)
      .where(eq(members.status, 'active'))
      .orderBy(asc(members.lastName), asc(members.firstName)),
  );

  return (
    <>
      <PageHeader title={t('access.title')} subtitle={t('access.subtitle')} />
      <CheckInPanel
        members={memberRows.map((m) => ({
          id: m.id,
          label: `${m.firstName} ${m.lastName} (${formatMemberCode(m.memberSeq)})`,
        }))}
      />
    </>
  );
}
