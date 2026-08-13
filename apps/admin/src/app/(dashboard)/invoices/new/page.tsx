import { subscriptions, members, plans } from '@gymx/db';
import { eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader, Button, Card, CardHeader, CardTitle, CardBody, Table, Th, Td } from '../../../../components/ui/index';
import { queryInGym } from '../../../../lib/action';
import { requirePageAccess } from '../../../../lib/session';
import { CreateInvoiceForm } from './create-invoice-form';

export default async function CreateInvoicePage() {
  const t = await getTranslations();
  const context = await requirePageAccess('create', 'invoice');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('invoices.createTitle')} />
        <div className="text-center py-12">
          <p className="text-muted">{t('gymSwitcher.platformView')}</p>
        </div>
      </>
    );
  }

  let activeSubscriptions: any[] = [];
  try {
    activeSubscriptions = await queryInGym(
      { action: 'read', subject: 'subscription' },
      (db) =>
        db
          .select({
            id: subscriptions.id,
            payerMemberId: subscriptions.payerMemberId,
            payerName: sql<string>`''`,
            payerLastName: sql<string>`''`,
            planId: subscriptions.planId,
            startsOn: subscriptions.startsOn,
            nextInvoiceOn: subscriptions.nextInvoiceOn,
            priceCentsSnapshot: subscriptions.priceCentsSnapshot,
          })
          .from(subscriptions)
          .where(eq(subscriptions.status, 'active')),
    );
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
  }

  const formatMur = (cents: number) =>
    (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 0,
    });

  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <PageHeader
        title={t('invoices.createTitle')}
        subtitle={t('invoices.createSubtitle')}
        actions={
          <Link href="/invoices">
            <Button variant="secondary" size="sm">
              {t('common.back')}
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Select subscription */}
        <Card>
          <CardHeader>
            <CardTitle>{t('invoices.selectSubscription')}</CardTitle>
          </CardHeader>
          {activeSubscriptions.length === 0 ? (
            <CardBody>
              <p className="text-muted text-sm">{t('invoices.noActiveSubscriptions')}</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t('members.firstName')}</Th>
                  <Th>{t('invoices.plan')}</Th>
                  <Th className="text-right">{t('invoices.amount')}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {activeSubscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <Td className="font-medium">
                      {sub.payerName} {sub.payerLastName}
                    </Td>
                    <Td className="text-muted text-sm">Membership Plan</Td>
                    <Td className="text-right tabular-nums">{formatMur(sub.priceCentsSnapshot)}</Td>
                    <Td>
                      <button
                        onClick={() => {
                          const form = document.getElementById(`form-${sub.id}`) as HTMLFormElement;
                          form?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-[var(--color-primary)] text-xs hover:underline"
                      >
                        {t('common.select')}
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Right: Create invoice form */}
        <div className="space-y-4">
          {activeSubscriptions.length > 0 && (
            <>
              <h3 className="font-semibold text-lg">{t('invoices.createNewInvoice')}</h3>
              {activeSubscriptions.map((sub) => (
                <CreateInvoiceForm
                  key={sub.id}
                  formId={`form-${sub.id}`}
                  subscriptionId={sub.id}
                  payerName={`${sub.payerName} ${sub.payerLastName}`}
                  amount={sub.priceCentsSnapshot}
                  defaultStartDate={(sub.nextInvoiceOn ?? today) as string}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
