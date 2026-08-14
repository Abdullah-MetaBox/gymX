import { planAccessRules, plans } from '@gymx/db';
import type { Locale } from '@gymx/i18n';
import { Content } from '@gymx/i18n';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

export default async function PlansPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'plan');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('plans.title')} subtitle={t('plans.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const [allPlans, allRules] = await Promise.all([
    queryInGym({ action: 'read', subject: 'plan' }, (db) =>
      db.select().from(plans).orderBy(plans.sortOrder, plans.type),
    ),
    queryInGym({ action: 'read', subject: 'plan' }, (db) => db.select().from(planAccessRules)),
  ]);

  const rulesByPlan = new Map<string, typeof allRules>();
  for (const rule of allRules) {
    const existing = rulesByPlan.get(rule.planId) ?? [];
    existing.push(rule);
    rulesByPlan.set(rule.planId, existing);
  }

  const locale = (context.actor.locale ?? 'en') as Locale;
  const contracts = allPlans.filter((p) => p.type === 'contract');
  const passes = allPlans.filter((p) => p.type === 'pass');

  function fmtMur(cents: number) {
    return (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 0,
    });
  }

  function PlanSection({ rows, label }: { rows: typeof allPlans; label: string }) {
    if (rows.length === 0) return null;
    return (
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">{label}</h2>
        <Table>
          <thead>
            <tr>
              <Th>{t('plans.name')}</Th>
              <Th>{t('plans.category')}</Th>
              <Th>{t('plans.pricingModel')}</Th>
              <Th className="text-right">{t('plans.basePrice')}</Th>
              <Th>Access areas</Th>
              <Th>{t('plans.active')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((plan) => {
              const rules = rulesByPlan.get(plan.id) ?? [];
              const areas = [...new Set(rules.map((r) => r.area))];
              return (
                <tr key={plan.id} className="hover:surface-2">
                  <Td>
                    <Link href={`/plans/${plan.id}`} className="font-medium hover:underline">
                      {Content.text(plan.nameI18n as Record<string, string>, locale)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{t(`plans.categories.${plan.category}`)}</Badge>
                  </Td>
                  <Td className="text-muted text-xs">{t(`plans.models.${plan.pricingModel}`)}</Td>
                  <Td className="text-right tabular-nums">{fmtMur(plan.basePriceCents)}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {areas.length === 0 ? (
                        <span className="text-muted text-xs">—</span>
                      ) : (
                        areas.map((area) => (
                          <Badge key={area} tone="primary">
                            {t(`plans.areas.${area}`)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </Td>
                  <Td>
                    {plan.active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/plans/${plan.id}/edit`}
                      className="text-muted text-xs hover:underline"
                    >
                      {t('common.edit')}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title={t('plans.title')}
        subtitle={t('plans.subtitle')}
        actions={
          <Link href="/plans/new">
            <Button>{t('plans.create')}</Button>
          </Link>
        }
      />

      {allPlans.length === 0 ? (
        <EmptyState
          title={t('plans.empty')}
          action={
            <Link href="/plans/new">
              <Button>{t('plans.create')}</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <PlanSection rows={contracts} label={t('plans.types.contract')} />
          <PlanSection rows={passes} label={t('plans.types.pass')} />
        </div>
      )}
    </>
  );
}
