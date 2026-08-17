import { allModules } from '@gymx/modules';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GymForm } from '../../../../../components/gym-form';
import { PageHeader } from '../../../../../components/ui/index';
import { gymFormLabels } from '../../../../../lib/gym-form-labels';
import { requirePageContext } from '../../../../../lib/session';
import { createGym } from '../actions';

export default async function NewGymPage() {
  const context = await requirePageContext();
  if (!context.principal.isPlatformAdmin) notFound();

  const t = await getTranslations();
  const labels = await gymFormLabels('common.create');

  return (
    <>
      <PageHeader title={t('gyms.createTitle')} />
      <GymForm
        mode="create"
        redirectTo="/platform/gyms"
        labels={labels}
        availableModules={allModules().map((module) => ({ id: module.id, name: module.name }))}
        onSubmit={createGym}
        values={{
          name: '',
          slug: '',
          brn: '',
          vatNumber: '',
          // Mauritian defaults: this is the market GymX is built for.
          timezone: 'Indian/Mauritius',
          currency: 'MUR',
          vatRatePercent: 15,
          defaultLocale: 'en',
          locales: ['en'],
          minContractMonths: 0,
          overdueGraceDays: 1,
          atRiskDays: 21,
          primaryColor: '',
          accentColor: '',
          logoUrl: '',
          enabledModules: [],
        }}
      />
    </>
  );
}
