import { gyms } from '@gymx/db';
import { allModules } from '@gymx/modules';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GymForm } from '../../../components/gym-form';
import { EmptyState, PageHeader } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { gymFormLabels } from '../../../lib/gym-form-labels';
import { requirePageAccess } from '../../../lib/session';
import { updateGym } from '../platform/gyms/actions';

/** A gym manager editing their own gym. */
export default async function SettingsPage() {
  const context = await requirePageAccess('update', 'gym');
  const t = await getTranslations();

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('nav.settings')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const [gym] = await queryInGym({ action: 'read', subject: 'gym' }, (db) =>
    db
      .select()
      .from(gyms)
      .where(eq(gyms.id, context.actor.gymId as string))
      .limit(1),
  );
  if (!gym) notFound();

  const labels = await gymFormLabels('common.save');

  return (
    <>
      <PageHeader title={t('nav.settings')} subtitle={gym.name} />
      <GymForm
        mode="edit"
        labels={labels}
        availableModules={allModules().map((module) => ({ id: module.id, name: module.name }))}
        onSubmit={updateGym}
        values={{
          gymId: gym.id,
          name: gym.name,
          slug: gym.slug,
          brn: gym.brn ?? '',
          vatNumber: gym.vatNumber ?? '',
          timezone: gym.timezone,
          currency: gym.currency,
          vatRatePercent: gym.vatRateBp / 100,
          defaultLocale: gym.defaultLocale,
          locales: gym.locales,
          minContractMonths: gym.minContractMonths,
          overdueGraceDays: gym.overdueGraceDays,
          atRiskDays: gym.atRiskDays,
          primaryColor: gym.branding.primaryColor ?? '',
          accentColor: gym.branding.accentColor ?? '',
          logoUrl: gym.branding.logoUrl ?? '',
          enabledModules: gym.enabledModules,
        }}
      />
    </>
  );
}
