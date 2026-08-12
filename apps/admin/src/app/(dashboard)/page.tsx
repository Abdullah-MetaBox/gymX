import { getTranslations } from 'next-intl/server';
import { Badge, EmptyState, PageHeader } from '../../components/ui/index';
import { requireActiveContext } from '../../lib/session';
import { ManagerDashboard } from './dashboard-manager';
import { queryInGym } from '../../lib/action';

export default async function DashboardPage() {
  const t = await getTranslations();
  const context = await requireActiveContext();
  const { principal, membership, actor } = context;

  // Platform admin sees empty state
  if (!membership) {
    return (
      <>
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.welcome', { name: principal.name })}
          actions={<Badge tone="primary">{t('dashboard.phaseLabel')}</Badge>}
        />
        <div className="mt-6">
          <EmptyState title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
        </div>
      </>
    );
  }

  // Gym managers/staff see the full dashboard
  if (actor.role === 'gym_manager' || actor.role === 'staff') {
    return (
      <>
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.welcome', { name: principal.name })}
        />
        <ManagerDashboard
          gymId={actor.gymId as string}
          timeZone={context.timeZone}
        />
      </>
    );
  }

  // Accountants see financial dashboard (TODO)
  if (actor.role === 'accountant') {
    return (
      <>
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.welcome', { name: principal.name })}
        />
        <div className="mt-6">
          <EmptyState title="Financial Dashboard" body="Coming soon" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('dashboard.title')} />
      <EmptyState title={t('dashboard.emptyTitle')} body={t('dashboard.emptyBody')} />
    </>
  );
}
