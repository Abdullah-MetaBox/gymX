import { planAccessRules, planPriceTiers, plans } from '@gymx/db';
import { Content } from '@gymx/i18n';
import type { Locale } from '@gymx/i18n';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlanForm } from '../../../../../components/plan-form';
import { Button, PageHeader } from '../../../../../components/ui/index';
import { queryInGym } from '../../../../../lib/action';
import { requirePageAccess } from '../../../../../lib/session';
import { updatePlanAndRedirect } from '../../actions';

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('update', 'plan');

  const [planRow, rules, tiers] = await Promise.all([
    queryInGym({ action: 'update', subject: 'plan' }, (db) =>
      db.select().from(plans).where(eq(plans.id, planId)).limit(1).then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'plan' }, (db) =>
      db.select().from(planAccessRules).where(eq(planAccessRules.planId, planId)),
    ),
    queryInGym({ action: 'read', subject: 'plan' }, (db) =>
      db
        .select()
        .from(planPriceTiers)
        .where(eq(planPriceTiers.planId, planId))
        .orderBy(planPriceTiers.sizeFrom),
    ),
  ]);

  if (!planRow) notFound();

  const locale = (context.actor.locale ?? 'en') as Locale;
  const nameI18n = planRow.nameI18n as Record<string, string>;

  const defaultValues = {
    nameEn: nameI18n.en ?? '',
    nameFr: nameI18n.fr ?? '',
    type: planRow.type,
    category: planRow.category,
    billingInterval: planRow.billingInterval ?? '',
    basePriceMajor: planRow.basePriceCents / 100,
    joiningFeeMajor: planRow.joiningFeeCents / 100,
    vatInclusive: planRow.vatInclusive,
    minTermMonths: planRow.minTermMonths,
    passDurationDays: planRow.passDurationDays ?? undefined,
    pricingModel: planRow.pricingModel,
    active: planRow.active,
    sortOrder: planRow.sortOrder,
    accessRules: rules.map((r) => ({
      area: r.area,
      weekdays: r.weekdays ?? undefined,
      startTime: r.startTime ?? undefined,
      endTime: r.endTime ?? undefined,
    })),
    priceTiers: tiers.map((t) => ({
      sizeFrom: t.sizeFrom,
      sizeTo: t.sizeTo ?? undefined,
      priceCents: t.priceCents,
    })),
  };

  return (
    <>
      <PageHeader
        title={t('plans.editTitle')}
        subtitle={Content.text(nameI18n, locale)}
        actions={
          <Link href={`/plans/${planId}`}>
            <Button variant="secondary">{t('common.back')}</Button>
          </Link>
        }
      />
      <PlanForm
        action={updatePlanAndRedirect}
        defaultValues={defaultValues}
        planId={planId}
        submitLabel={t('common.save')}
        cancelHref={`/plans/${planId}`}
      />
    </>
  );
}
