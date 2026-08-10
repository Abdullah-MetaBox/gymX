import { can } from '@gymx/core/auth';
import { planAccessRules, planPriceTiers, plans } from '@gymx/db';
import { Content } from '@gymx/i18n';
import type { Locale } from '@gymx/i18n';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
} from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'plan');

  const [planRow, rules, tiers] = await Promise.all([
    queryInGym({ action: 'read', subject: 'plan' }, (db) =>
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

  const canEdit = can(context.actor.role, 'update', 'plan');
  const locale = (context.actor.locale ?? 'en') as Locale;
  const nameI18n = planRow.nameI18n as Record<string, string>;
  const planName = Content.text(nameI18n, locale);

  function fmtMur(cents: number) {
    return (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 0,
    });
  }

  return (
    <>
      <PageHeader
        title={planName}
        subtitle={`${t(`plans.types.${planRow.type}`)} · ${t(`plans.categories.${planRow.category}`)}`}
        actions={
          <div className="flex gap-2">
            <Link href="/plans">
              <Button variant="secondary">{t('common.back')}</Button>
            </Link>
            {canEdit && (
              <Link href={`/plans/${planId}/edit`}>
                <Button>{t('common.edit')}</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>{t('plans.pricing')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-3 text-sm">
              <Row label={t('plans.basePrice')} value={fmtMur(planRow.basePriceCents)} />
              {planRow.joiningFeeCents > 0 && (
                <Row label={t('plans.joiningFee')} value={fmtMur(planRow.joiningFeeCents)} />
              )}
              <Row label={t('plans.pricingModel')} value={t(`plans.models.${planRow.pricingModel}`)} />
              <Row label={t('plans.vatInclusive')} value={planRow.vatInclusive ? t('common.yes') : t('common.no')} />
              {planRow.billingInterval && (
                <Row label={t('plans.billingInterval')} value={t(`plans.intervals.${planRow.billingInterval}`)} />
              )}
              {planRow.minTermMonths > 0 && (
                <Row label={t('plans.minTermMonths')} value={`${planRow.minTermMonths} months`} />
              )}
              {planRow.passDurationDays && (
                <Row label={t('plans.passDurationDays')} value={`${planRow.passDurationDays} days`} />
              )}
              <div className="flex justify-between">
                <span className="text-muted shrink-0">{t('plans.active')}</span>
                {planRow.active ? (
                  <Badge tone="success">Active</Badge>
                ) : (
                  <Badge tone="neutral">Inactive</Badge>
                )}
              </div>
            </dl>

            {tiers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  {planRow.pricingModel === 'flat_by_size'
                    ? t('plans.tiersFlat')
                    : t('plans.tiersPerHead')}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-muted font-medium pb-1">Size</th>
                      <th className="text-right text-xs text-muted font-medium pb-1">Price (MUR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr key={tier.id}>
                        <td className="py-0.5">
                          {tier.sizeFrom}
                          {tier.sizeTo ? `–${tier.sizeTo}` : '+'}
                        </td>
                        <td className="text-right tabular-nums">{fmtMur(tier.priceCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Access rules */}
        <Card>
          <CardHeader>
            <CardTitle>{t('plans.accessRules')}</CardTitle>
          </CardHeader>
          <CardBody>
            {rules.length === 0 ? (
              <p className="text-muted text-sm">{t('plans.noRules')}</p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="space-y-1.5">
                    <Badge tone="primary">{t(`plans.areas.${rule.area}`)}</Badge>
                    <p className="text-sm text-muted">
                      {rule.weekdays
                        ? rule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')
                        : 'All days'}
                    </p>
                    {(rule.startTime || rule.endTime) && (
                      <p className="text-sm text-muted">
                        {rule.startTime ?? '00:00'} – {rule.endTime ?? '24:00'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
