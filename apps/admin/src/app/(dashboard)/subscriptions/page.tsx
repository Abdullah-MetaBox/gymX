import { members, plans, subscriptions } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

const STATUS_TONE = {
  active: 'success',
  frozen: 'warning',
  suspended: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
} as const;

export default async function SubscriptionsPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'subscription');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('subscriptions.title')} subtitle={t('subscriptions.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'subscription' }, (db) =>
    db
      .select({
        id: subscriptions.id,
        status: subscriptions.status,
        startsOn: subscriptions.startsOn,
        endsOn: subscriptions.endsOn,
        priceCents: subscriptions.priceCentsSnapshot,
        planName: plans.nameI18n,
        memberName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .innerJoin(members, eq(subscriptions.payerMemberId, members.id))
      .orderBy(subscriptions.createdAt),
  );

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
        title={t('subscriptions.title')}
        subtitle={t('subscriptions.subtitle')}
        actions={
          <Link href="/subscriptions/new">
            <Button>{t('subscriptions.create')}</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t('subscriptions.empty')}
          action={
            <Link href="/subscriptions/new">
              <Button>{t('subscriptions.create')}</Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('subscriptions.payer')}</Th>
              <Th>{t('subscriptions.plan')}</Th>
              <Th>{t('subscriptions.startsOn')}</Th>
              <Th className="text-right">{t('subscriptions.price')}</Th>
              <Th>{t('subscriptions.status')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const planName =
                typeof row.planName === 'object' && row.planName !== null
                  ? (row.planName as Record<string, string>).en || 'Unnamed'
                  : 'Unnamed';
              return (
                <tr key={row.id} className="hover:surface-2">
                  <Td className="font-medium">
                    {row.memberName} {row.memberLastName}
                  </Td>
                  <Td>{planName}</Td>
                  <Td className="text-muted">{row.startsOn}</Td>
                  <Td className="text-right tabular-nums">{fmtMur(row.priceCents)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>
                      {t(`subscriptions.statuses.${row.status}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/subscriptions/${row.id}`}
                      className="text-muted text-xs hover:underline"
                    >
                      {t('common.view')}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
