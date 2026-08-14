import { invoiceLines, invoices, members } from '@gymx/db';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'invoice');

  const [invoiceRow, lines, payer] = await Promise.all([
    queryInGym({ action: 'read', subject: 'invoice' }, (db) =>
      db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)
        .then((r) => r[0]),
    ),
    queryInGym({ action: 'read', subject: 'invoice' }, (db) =>
      db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)),
    ),
    queryInGym({ action: 'read', subject: 'member' }, (db) =>
      db
        .select()
        .from(members)
        .where(eq(members.id, invoices.payerMemberId))
        .limit(1)
        .then((r) => r[0]),
    ),
  ]);

  if (!invoiceRow) notFound();

  function fmtMur(cents: number) {
    return (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 2,
    });
  }

  const payerName = payer ? `${payer.firstName} ${payer.lastName}` : 'Unknown';

  return (
    <>
      <PageHeader
        title={invoiceRow.number}
        subtitle={`${payerName} • Due ${invoiceRow.dueOn}`}
        actions={
          <div className="flex gap-2">
            <Link href="/invoices">
              <Button variant="secondary">{t('common.back')}</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Invoice summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('invoices.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="space-y-3 text-sm mb-6">
              <Row label={t('invoices.number')} value={invoiceRow.number} />
              <Row label={t('invoices.payer')} value={payerName} />
              <Row label={t('invoices.issuedOn')} value={invoiceRow.issuedOn} />
              <Row label={t('invoices.dueOn')} value={invoiceRow.dueOn} />
              {invoiceRow.periodStart && invoiceRow.periodEnd && (
                <Row
                  label={t('invoices.period')}
                  value={`${invoiceRow.periodStart} to ${invoiceRow.periodEnd}`}
                />
              )}
              <div className="flex justify-between">
                <span className="text-muted shrink-0">{t('invoices.status')}</span>
                <Badge tone={invoiceRow.status === 'paid' ? 'success' : 'warning'}>
                  {t(`invoices.statuses.${invoiceRow.status}`)}
                </Badge>
              </div>
            </dl>

            {/* Line items */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
                Line items
              </p>
              <div className="space-y-2 text-sm">
                {lines.map((line) => (
                  <div key={line.id} className="flex justify-between gap-4">
                    <div>
                      <p>{line.description}</p>
                      <p className="text-muted text-xs">
                        {line.qty} × {fmtMur(line.unitPriceCents)}
                      </p>
                    </div>
                    <p className="text-right font-medium tabular-nums">
                      {fmtMur(line.amountCents)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={fmtMur(invoiceRow.subtotalCents)} />
              {invoiceRow.discountCents > 0 && (
                <Row
                  label={t('invoices.discount')}
                  value={`-${fmtMur(invoiceRow.discountCents)}`}
                />
              )}
              {invoiceRow.vatCents > 0 && (
                <Row label={t('invoices.vat')} value={fmtMur(invoiceRow.vatCents)} />
              )}
              <div className="border-t border-[var(--color-border)] pt-2 mt-2">
                <div className="flex justify-between gap-2 font-semibold text-base">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtMur(invoiceRow.totalCents)}</span>
                </div>
              </div>
            </div>
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
