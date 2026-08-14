import { Money } from '@gymx/core';
import { can, type Role } from '@gymx/core/auth';
import { householdMembers, households, plans, subscriptionMembers, subscriptions } from '@gymx/db';
import { Content, type Locale } from '@gymx/i18n';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SubscriptionActions } from '../../../../components/subscription-actions';
import { Badge, Button } from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';

const STATUS_TONE = {
  active: 'success',
  frozen: 'warning',
  suspended: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
} as const;

/**
 * The member's plan and family, on their profile.
 *
 * Previously this page showed neither, despite the schema linking both — the
 * two halves of a member's record were a navigation away from each other.
 */
export async function MembershipPanel({ memberId, role }: { memberId: string; role: Role }) {
  const t = await getTranslations();
  const locale = 'en' as Locale;

  const canSeePlans = can(role, 'read', 'subscription');
  const canSeeFamily = can(role, 'read', 'household');
  const canAssign = can(role, 'create', 'subscription');

  const { subs, family } = await queryInGym({ action: 'read', subject: 'member' }, async (db) => ({
    subs: canSeePlans
      ? await db
          .select({
            id: subscriptions.id,
            status: subscriptions.status,
            startsOn: subscriptions.startsOn,
            endsOn: subscriptions.endsOn,
            priceCents: subscriptions.priceCentsSnapshot,
            planNameI18n: plans.nameI18n,
          })
          .from(subscriptionMembers)
          .innerJoin(subscriptions, eq(subscriptions.id, subscriptionMembers.subscriptionId))
          .innerJoin(plans, eq(plans.id, subscriptions.planId))
          .where(eq(subscriptionMembers.memberId, memberId))
      : [],
    family: canSeeFamily
      ? await db
          .select({
            id: households.id,
            name: households.name,
            relationship: householdMembers.relationship,
          })
          .from(householdMembers)
          .innerJoin(households, eq(households.id, householdMembers.householdId))
          .where(eq(householdMembers.memberId, memberId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null,
  }));

  return (
    <div className="space-y-4 text-sm">
      {family ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">{t('members.household')}</span>
          <Link href={`/households/${family.id}`} className="font-medium hover:underline">
            {family.name}
            <span className="text-muted ml-2 text-xs capitalize">{family.relationship}</span>
          </Link>
        </div>
      ) : null}

      {subs.length === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted">{t('subscriptions.noneForMember')}</p>
          {canAssign ? (
            <Link href={`/subscriptions/new?memberId=${memberId}`}>
              <Button size="sm">{t('subscriptions.assign')}</Button>
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {subs.map((sub) => {
            const planName = Content.text(sub.planNameI18n, locale, {
              placeholder: t('common.unknown'),
            });
            return (
              <li
                key={sub.id}
                className="flex flex-wrap items-center justify-between gap-3 border-[var(--color-border)] border-t pt-3 first:border-t-0 first:pt-0"
              >
                <div>
                  <Link href={`/subscriptions/${sub.id}`} className="font-medium hover:underline">
                    {planName}
                  </Link>
                  <p className="text-muted text-xs tabular-nums">
                    {Money.format(Money.cents(Number(sub.priceCents)), { currency: 'MUR' })}
                    {' · '}
                    {sub.startsOn}
                    {sub.endsOn ? ` → ${sub.endsOn}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[sub.status]}>
                    {t(`subscriptions.statuses.${sub.status}`)}
                  </Badge>
                  {can(role, 'update', 'subscription') ? (
                    <SubscriptionActions
                      subscriptionId={sub.id}
                      status={sub.status}
                      label={planName}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
