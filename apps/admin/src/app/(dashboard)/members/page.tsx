import { formatMemberCode, members } from '@gymx/db';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, Card, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

const STATUS_TONE = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  frozen: 'warning',
} as const;

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

      <form method="get" className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder={t('members.searchPlaceholder')}
          className="h-9 rounded-lg border border-[var(--color-border)] surface px-3 text-sm w-72 focus:outline-[var(--color-primary)]"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="h-9 rounded-lg border border-[var(--color-border)] surface px-3 text-sm"
        >
          <option value="">{t('common.none')} (all)</option>
          {(['active', 'inactive', 'suspended', 'frozen'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`members.statuses.${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          {t('common.search')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={t('members.empty')}
          action={
            <Link href="/members/new">
              <Button>{t('members.create')}</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{t('members.memberCode')}</Th>
                <Th>{t('members.firstName')} {t('members.lastName')}</Th>
                <Th>{t('members.email')}</Th>
                <Th>{t('members.phone')}</Th>
                <Th>{t('members.status')}</Th>
                <Th>{t('members.joinedAt')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:surface-2">
                  <Td className="font-mono text-xs text-muted">{formatMemberCode(row.memberSeq)}</Td>
                  <Td className="font-medium">
                    {row.firstName} {row.lastName}
                  </Td>
                  <Td className="text-muted">{row.email ?? '—'}</Td>
                  <Td className="text-muted">{row.phone ?? '—'}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>
                      {t(`members.statuses.${row.status}`)}
                    </Badge>
                  </Td>
                  <Td className="text-muted">{row.joinedAt}</Td>
                  <Td>
                    <Link
                      href={`/members/${row.id}`}
                      className="text-[var(--color-primary)] text-sm hover:underline underline-offset-2"
                    >
                      {t('common.view')}
                    </Link>
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
