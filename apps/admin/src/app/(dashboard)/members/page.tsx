import { formatMemberCode, members } from '@gymx/db';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, EmptyState, PageHeader } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';
import { MemberListView } from './list-view';

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'member');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('members.title')} subtitle={t('members.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'member' }, (db) => {
    const conditions = [];
    if (status && ['active', 'inactive', 'suspended', 'frozen'].includes(status)) {
      conditions.push(eq(members.status, status as 'active' | 'inactive' | 'suspended' | 'frozen'));
    }
    if (q) {
      conditions.push(
        or(
          ilike(members.firstName, `%${q}%`),
          ilike(members.lastName, `%${q}%`),
          ilike(members.email, `%${q}%`),
          ilike(members.phone, `%${q}%`),
        ),
      );
    }
    return db
      .select()
      .from(members)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(200);
  });

  // Transform database rows to component format
  const memberData = rows.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    memberCode: formatMemberCode(row.memberSeq),
    email: row.email ?? '',
    phone: row.phone ?? '',
    status: row.status,
    joinedDate: row.joinedAt,
  }));

  return (
    <>
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/members/import">
              <Button variant="secondary" size="sm">
                {t('members.importLink')}
              </Button>
            </Link>
            <Link href="/members/new">
              <Button>{t('members.create')}</Button>
            </Link>
          </div>
        }
      />

      {memberData.length === 0 ? (
        <EmptyState
          title={t('members.empty')}
          action={
            <Link href="/members/new">
              <Button>{t('members.create')}</Button>
            </Link>
          }
        />
      ) : (
        <MemberListView members={memberData} />
      )}
    </>
  );
}
