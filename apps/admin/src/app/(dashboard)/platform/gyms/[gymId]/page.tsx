import { gyms } from '@gymx/db';
import { allModules } from '@gymx/modules';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GymForm } from '../../../../../components/gym-form';
import { PageHeader } from '../../../../../components/ui/index';
import { queryOnPlatform } from '../../../../../lib/action';
import { gymFormLabels } from '../../../../../lib/gym-form-labels';
import { requireActiveContext } from '../../../../../lib/session';
import { updateGymOnPlatformAction } from '../actions';

export default async function EditGymPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  const context = await requireActiveContext();
  if (!context.principal.isPlatformAdmin) notFound();

  const t = await getTranslations();
  const labels = await gymFormLabels('common.save');

  const [gym] = await queryOnPlatform({ action: 'read', subject: 'gym' }, (db) =>
    db.select().from(gyms).where(eq(gyms.id, gymId)).limit(1),
  );
  if (!gym) notFound();

  return (
    <>
      <PageHeader title={gym.name} subtitle={t('gyms.editTitle')} />
      <GymForm
        mode="edit"
        labels={labels}
        availableModules={allModules().map((module) => ({ id: module.id, name: module.name }))}
        onSubmit={updateGymOnPlatformAction}
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
          enabledModules: gym.enabledModules,
        }}
      />
    </>
  );
}
