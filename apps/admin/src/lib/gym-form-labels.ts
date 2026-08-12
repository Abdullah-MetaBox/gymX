import { getTranslations } from 'next-intl/server';
import type { GymFormLabels } from '../components/gym-form';

/** Server-side label bundle for the gym form, shared by the create and edit pages. */
export async function gymFormLabels(submitKey: string): Promise<GymFormLabels> {
  const t = await getTranslations();
  return {
    name: t('gyms.name'),
    slug: t('gyms.slug'),
    slugHelp: t('gyms.slugHelp'),
    brn: t('gyms.brn'),
    vatNumber: t('gyms.vatNumber'),
    timezone: t('gyms.timezone'),
    currency: t('gyms.currency'),
    vatRate: t('gyms.vatRate'),
    vatRateHelp: t('gyms.vatRateHelp'),
    defaultLocale: t('gyms.defaultLocale'),
    locales: t('gyms.locales'),
    minContractMonths: t('gyms.minContractMonths'),
    overdueGraceDays: t('gyms.overdueGraceDays'),
    graceHelp: t('gyms.graceHelp'),
    atRiskDays: t('gyms.atRiskDays'),
    primaryColor: t('gyms.primaryColor'),
    accentColor: t('gyms.accentColor'),
    logoUrl: t('gyms.logoUrl'),
    enabledModules: t('gyms.enabledModules'),
    submit: t(submitKey as never),
    saved: t('common.saved'),
  };
}
