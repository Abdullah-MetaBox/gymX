import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PlanForm } from '../../../../components/plan-form';
import { Button, PageHeader } from '../../../../components/ui/index';
import { requirePageAccess } from '../../../../lib/session';
import { createPlanAndRedirect } from '../actions';

export default async function NewPlanPage() {
  await requirePageAccess('create', 'plan');
  const t = await getTranslations();

  return (
    <>
      <PageHeader
        title={t('plans.createTitle')}
        actions={
          <Link href="/plans">
            <Button variant="secondary">{t('common.back')}</Button>
          </Link>
        }
      />
      <PlanForm
        action={createPlanAndRedirect}
        submitLabel={t('common.create')}
        cancelHref="/plans"
      />
    </>
  );
}
