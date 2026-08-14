import {
  formatMemberCode,
  householdMembers,
  households,
  members,
  planPriceTiers,
  plans,
} from '@gymx/db';
import { Content, type Locale } from '@gymx/i18n';
import { asc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, PageHeader } from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';
import { AssignPlanForm } from './assign-plan-form';

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string; householdId?: string }>;
}) {
  const { memberId, householdId } = await searchParams;
  const t = await getTranslations();
  const context = await requirePageAccess('create', 'subscription');
  const locale = (context.actor.locale ?? 'en') as Locale;

  const { planRows, tierRows, memberRows, householdRows } = await queryInGym(
    { action: 'read', subject: 'plan' },
    async (db) => ({
      planRows: await db
        .select()
        .from(plans)
        .where(eq(plans.active, true))
        .orderBy(asc(plans.sortOrder)),
      tierRows: await db.select().from(planPriceTiers),
      memberRows: await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          memberSeq: members.memberSeq,
        })
        .from(members)
        .where(eq(members.status, 'active'))
        .orderBy(asc(members.lastName), asc(members.firstName)),
      // The size drives the tier price, so the form can preview it without a
      // round trip — the server still derives the real figure on submit.
      householdRows: await db
        .select({
          id: households.id,
          name: households.name,
          memberCount: sql<number>`count(${householdMembers.memberId})::int`,
        })
        .from(households)
        .leftJoin(householdMembers, eq(householdMembers.householdId, households.id))
        .groupBy(households.id, households.name)
        .orderBy(asc(households.name)),
    }),
  );

  return (
    <>
      <PageHeader
        title={t('subscriptions.createTitle')}
        subtitle={t('subscriptions.createSubtitle')}
        actions={
          <Link href="/members">
            <Button variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />

      <AssignPlanForm
        plans={planRows.map((p) => ({
          id: p.id,
          name: Content.text(p.nameI18n, locale, { placeholder: t('common.unknown') }),
          pricingModel: p.pricingModel,
          basePriceCents: Number(p.basePriceCents),
          tiers: tierRows
            .filter((tier) => tier.planId === p.id)
            .map((tier) => ({
              sizeFrom: tier.sizeFrom,
              sizeTo: tier.sizeTo,
              priceCents: Number(tier.priceCents),
            })),
        }))}
        members={memberRows.map((m) => ({
          id: m.id,
          label: `${m.firstName} ${m.lastName} (${formatMemberCode(m.memberSeq)})`,
        }))}
        households={householdRows}
        defaultMemberId={memberId}
        defaultHouseholdId={householdId}
      />
    </>
  );
}
