import { invoices, members } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge, Button, EmptyState, PageHeader, Table, Td, Th } from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';

const STATUS_TONE = {
  draft: 'neutral',
  issued: 'warning',
  paid: 'success',
  partially_paid: 'warning',
  overdue: 'danger',
  void: 'neutral',
  written_off: 'neutral',
} as const;

export default async function InvoicesPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'invoice');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('invoices.title')} subtitle={t('invoices.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} body={t('gyms.subtitle')} />
      </>
    );
  }

  const rows = await queryInGym({ action: 'read', subject: 'invoice' }, (db) =>
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        issuedOn: invoices.issuedOn,
        dueOn: invoices.dueOn,
        totalCents: invoices.totalCents,
        status: invoices.status,
        payerName: members.firstName,
        payerLastName: members.lastName,
      })
      .from(invoices)
      .innerJoin(members, eq(invoices.payerMemberId, members.id))
      .orderBy(invoices.issuedOn),
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
        title={t('invoices.title')}
        subtitle={t('invoices.subtitle')}
        actions={
          <Link href="/invoices/new">
            <Button>{t('invoices.create')}</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={t('invoices.empty')}
          action={
            <Link href="/invoices/new">
              <Button>{t('invoices.create')}</Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('invoices.number')}</Th>
              <Th>{t('invoices.payer')}</Th>
              <Th>{t('invoices.issuedOn')}</Th>
              <Th>{t('invoices.dueOn')}</Th>
              <Th className="text-right">{t('invoices.total')}</Th>
              <Th>{t('invoices.status')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:surface-2">
                <Td className="font-mono text-sm">{row.number}</Td>
                <Td className="font-medium">
                  {row.payerName} {row.payerLastName}
                </Td>
                <Td className="text-muted">{row.issuedOn}</Td>
                <Td className="text-muted">{row.dueOn}</Td>
                <Td className="text-right tabular-nums">{fmtMur(row.totalCents)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[row.status]}>
                    {t(`invoices.statuses.${row.status}`)}
                  </Badge>
                </Td>
                <Td>
                  <Link href={`/invoices/${row.id}`} className="text-muted text-xs hover:underline">
                    {t('common.view')}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
