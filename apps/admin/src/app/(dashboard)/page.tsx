import { getTranslations } from 'next-intl/server';
import { Badge, EmptyState, PageHeader } from '../../components/ui/index';
import { requirePageContext } from '../../lib/session';
import { ManagerDashboard } from './dashboard-manager';

export default async function DashboardPage() {
  const t = await getTranslations();
  const context = await requirePageContext();
  const { principal, membership, actor } = context;

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome', { name: principal.name })}
      />

      {/* Platform admin or no membership: show empty state */}
      {!membership && (
        <div className="mt-6">
          <EmptyState title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
        </div>
      )}

      {/* Gym manager or staff: show dashboard */}
      {membership && (actor.role === 'gym_manager' || actor.role === 'staff') && (
        <div className="mt-6">
          <ManagerDashboard gymId={actor.gymId as string} timeZone={context.timeZone} />
        </div>
      )}

      {/* Accountant: show financial dashboard placeholder */}
      {membership && actor.role === 'accountant' && (
        <div className="mt-6">
          <EmptyState title="Financial Dashboard" body="Coming in Phase 6" />
        </div>
      )}
    </>
  );
}
