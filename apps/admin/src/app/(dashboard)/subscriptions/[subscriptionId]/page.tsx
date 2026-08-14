import { can } from '@gymx/core/auth';
import { invoices, members, plans, subscriptionMembers, subscriptions } from '@gymx/db';
import type { Locale } from '@gymx/i18n';
import { Content } from '@gymx/i18n';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SubscriptionActions } from '../../../../components/subscription-actions';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'subscription');

  const locale = (context.actor.locale ?? 'en') as Locale;

  const [subRow, members_, invoices_] = await Promise.all([
    queryInGym({ action: 'read', subject: 'subscription' }, (db) =>
      db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1)
        .then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'subscription' }, (db) =>
      db
        .select()
        .from(subscriptionMembers)
        .where(eq(subscriptionMembers.subscriptionId, subscriptionId)),
    ),
    queryInGym({ action: 'read', subject: 'invoice' }, (db) =>
      db
        .select()
        .from(invoices)
        .where(eq(invoices.subscriptionId, subscriptionId))
        .orderBy(invoices.issuedOn),
    ),
  ]);

  if (!subRow) notFound();

  // Fetch member details and plan name
  const [payerRow, planRow] = await Promise.all([
    queryInGym({ action: 'read', subject: 'member' }, (db) =>
      db
        .select()
        .from(members)
        .where(eq(members.id, subRow.payerMemberId))
        .limit(1)
        .then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'plan' }, (db) =>
      db
        .select()
        .from(plans)
        .where(eq(plans.id, subRow.planId))
        .limit(1)
        .then((r) => r[0]),
    ),
  ]);

  const canEdit = can(context.actor.role, 'update', 'subscription');
  const canCreateInvoice = can(context.actor.role, 'create', 'invoice');

  function fmtMur(cents: number) {
    return (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 0,
    });
  }

  const planName = planRow
    ? Content.text((planRow.nameI18n as Record<string, string>) || {}, locale)
    : 'Unknown';
  const payerName = payerRow ? `${payerRow.firstName} ${payerRow.lastName}` : 'Unknown';

  return (
    <>
      <PageHeader
        title={`${payerName} • ${planName}`}
        subtitle={`Subscription started ${subRow.startsOn}`}
        actions={
          <div className="flex gap-2">
            <Link href="/subscriptions">
              <Button variant="secondary">{t('common.back')}</Button>
            </Link>
            {canEdit && (
              <SubscriptionActions
                subscriptionId={subRow.id}
                status={subRow.status}
                label={`${payerName} • ${planName}`}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Subscription details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('subscriptions.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-3 text-sm">
              <Row label={t('subscriptions.plan')} value={planName} />
              <Row label={t('subscriptions.payer')} value={payerName} />
              <Row label={t('subscriptions.price')} value={fmtMur(subRow.priceCentsSnapshot)} />
              <Row label={t('subscriptions.startsOn')} value={subRow.startsOn} />
              {subRow.endsOn && <Row label={t('subscriptions.endsOn')} value={subRow.endsOn} />}
              {subRow.minTermEndsOn && (
                <Row label={t('subscriptions.minTermEndsOn')} value={subRow.minTermEndsOn} />
              )}
              <div className="flex justify-between">
                <span className="text-muted shrink-0">{t('subscriptions.status')}</span>
                <Badge tone={subRow.status === 'active' ? 'success' : 'neutral'}>
                  {t(`subscriptions.statuses.${subRow.status}`)}
                </Badge>
              </div>
            </dl>
          </CardBody>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Total invoiced</p>
                <p className="text-xl font-semibold tabular-nums">
                  {fmtMur(invoices_.reduce((sum, inv) => sum + inv.totalCents, 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Active invoices</p>
                <p className="text-lg">
                  {invoices_.filter((inv) => ['issued', 'overdue'].includes(inv.status)).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">Members on plan</p>
                <p className="text-lg">{members_.length}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('invoices.title')}</CardTitle>
            {canCreateInvoice && (
              <Link href={`/invoices/new?subscription=${subscriptionId}`}>
                <Button variant="secondary" size="sm">
                  {t('invoices.create')}
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        {invoices_.length === 0 ? (
          <CardBody>
            <p className="text-muted text-sm">{t('invoices.empty')}</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('invoices.number')}</Th>
                <Th>{t('invoices.issuedOn')}</Th>
                <Th className="text-right">{t('invoices.total')}</Th>
                <Th>{t('invoices.status')}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invoices_.map((invoice) => (
                <tr key={invoice.id} className="hover:surface-2">
                  <Td className="font-mono text-sm">{invoice.number}</Td>
                  <Td className="text-muted">{invoice.issuedOn}</Td>
                  <Td className="text-right tabular-nums">{fmtMur(invoice.totalCents)}</Td>
                  <Td>
                    <Badge tone={invoice.status === 'paid' ? 'success' : 'neutral'}>
                      {t(`invoices.statuses.${invoice.status}`)}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-muted text-xs hover:underline"
                    >
                      {t('common.view')}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
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
