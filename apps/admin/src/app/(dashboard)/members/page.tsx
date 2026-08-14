import { can } from '@gymx/core/auth';
import type { Locale } from '@gymx/i18n';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Alert, Button, EmptyState, PageHeader } from '../../../components/ui/index';
import { countMembers, groupMembersByFamily } from '../../../lib/member-grouping';
import { requirePageAccess } from '../../../lib/session';
import { MemberGridView } from './member-grid-view';
import { MemberTableView } from './member-table-view';
import { MembersToolbar, type ViewMode } from './members-toolbar';
import { fetchMembersView, isMemberStatus, PAGE_LIMIT } from './query';

/**
 * Members, family memberships and subscriptions on one screen.
 *
 * They were three sidebar entries showing three views of the same rows — 90%+ of
 * members hold a 1:1 subscription, and the family screen repeated what Members
 * already displayed. One list now carries all three, grouped by family.
 *
 * Rendered entirely on the server. The previous version shipped every member to
 * the browser as props on a client component; at 500 rows that is the whole list
 * serialised into the RSC payload and hydrated again for no interactivity.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>;
}) {
  const { q, status, view } = await searchParams;
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

  // Permission is data, and a page a role may not see must degrade rather than
  // throw: queryInGym would raise ForbiddenError, which in a page is a 500 —
  // and convention 7 says a denied page is a 404, never a broken one.
  const includeFamilies = can(context.actor.role, 'read', 'household');
  const includePlans = can(context.actor.role, 'read', 'subscription');
  const canCreate = can(context.actor.role, 'create', 'member');

  const viewMode: ViewMode = view === 'grid' ? 'grid' : 'list';
  const statusFilter = isMemberStatus(status) ? status : undefined;
  const search = q?.trim() || undefined;

  const { rows, statusCounts, total, truncated } = await fetchMembersView({
    q: search,
    status: statusFilter,
    locale: (context.actor.locale ?? 'en') as Locale,
    includeFamilies,
    includePlans,
  });

  const groups = groupMembersByFamily(rows);
  const shown = countMembers(groups);

  return (
    <>
      <PageHeader
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        actions={
          canCreate ? (
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
          ) : null
        }
      />

      <MembersToolbar
        state={{ q: search, status: statusFilter, view: viewMode }}
        statusCounts={statusCounts}
        total={total}
      />

      {truncated ? (
        <div className="mb-4">
          <Alert tone="info">{t('members.truncated', { limit: PAGE_LIMIT })}</Alert>
        </div>
      ) : null}

      {shown === 0 ? (
        <EmptyState
          title={search || statusFilter ? t('members.noMatches') : t('members.empty')}
          action={
            canCreate && !search && !statusFilter ? (
              <Link href="/members/new">
                <Button>{t('members.create')}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <MemberGridView groups={groups} />
          ) : (
            <MemberTableView groups={groups} />
          )}
          <p className="text-muted mt-4 text-sm">{t('members.showingCount', { shown, total })}</p>
        </>
      )}
    </>
  );
}
