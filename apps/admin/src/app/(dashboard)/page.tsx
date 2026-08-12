import { getTranslations } from 'next-intl/server';
import { Badge, EmptyState, PageHeader } from '../../components/ui/index';
import { requireActiveContext } from '../../lib/session';

export default async function DashboardPage() {
  const t = await getTranslations();
  const context = await requireActiveContext();
  const { principal, membership } = context;

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
