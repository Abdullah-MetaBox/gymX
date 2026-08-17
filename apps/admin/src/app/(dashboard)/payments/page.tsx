import { Money, Time } from '@gymx/core';
import { can } from '@gymx/core/auth';
import {
  formatMemberCode,
  invoices,
  members,
  paymentAllocations,
  payments,
  tills,
  tillShifts,
} from '@gymx/db';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from '../../../components/ui/index';
import { queryInGym } from '../../../lib/action';
import { requirePageAccess } from '../../../lib/session';
import { RecordPaymentForm } from './record-payment-form';

/**
 * Money received.
 *
 * Payments are append-only: a mistake is corrected with a reversal, never an
 * edit, so the trail of what was actually taken cannot be rewritten after the
 * fact. Each row shows how much of it has been allocated to an invoice —
 * unallocated money is a visible worklist item rather than quietly lost income.
 */
export default async function PaymentsPage() {
  const t = await getTranslations();
  const context = await requirePageAccess('read', 'payment');

  if (!context.actor.gymId) {
    return (
      <>
        <PageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />
        <EmptyState title={t('gymSwitcher.platformView')} />
      </>
    );
  }

  const { rows, memberRows, openInvoices, openShift, hasTill } = await queryInGym(
    { action: 'read', subject: 'payment' },
    async (db) => {
      const allocated = db
        .select({
          paymentId: paymentAllocations.paymentId,
          total: sql<number>`coalesce(sum(${paymentAllocations.amountCents}), 0)`.as('alloc'),
        })
        .from(paymentAllocations)
        .groupBy(paymentAllocations.paymentId)
        .as('allocated');

      const rows = await db
        .select({
          id: payments.id,
          method: payments.method,
          amountCents: payments.amountCents,
          receivedAt: payments.receivedAt,
          reference: payments.reference,
          createdAt: payments.createdAt,
          payerFirst: members.firstName,
          payerLast: members.lastName,
          payerSeq: members.memberSeq,
          allocatedCents: allocated.total,
        })
        .from(payments)
        .innerJoin(members, eq(members.id, payments.payerMemberId))
        .leftJoin(allocated, eq(allocated.paymentId, payments.id))
        .orderBy(desc(payments.createdAt))
        .limit(100);

      const memberRows = await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          memberSeq: members.memberSeq,
        })
        .from(members)
        .where(eq(members.status, 'active'))
        .orderBy(asc(members.lastName), asc(members.firstName));

      const openInvoices = await db
        .select({
          id: invoices.id,
          number: invoices.number,
          totalCents: invoices.totalCents,
          payerMemberId: invoices.payerMemberId,
        })
        .from(invoices)
        .where(and(ne(invoices.status, 'paid'), ne(invoices.status, 'void')))
        .orderBy(desc(invoices.issuedOn))
        .limit(100);

      const [open] = await db
        .select({ id: tillShifts.id, tillName: tills.name })
        .from(tillShifts)
        .innerJoin(tills, eq(tills.id, tillShifts.tillId))
        .where(eq(tillShifts.status, 'open'))
        .limit(1);

      const [till] = await db.select({ id: tills.id }).from(tills).limit(1);

      return { rows, memberRows, openInvoices, openShift: open ?? null, hasTill: Boolean(till) };
    },
  );

  const mur = (cents: number) => Money.format(Money.cents(Number(cents)), { currency: 'MUR' });
  const canRecord = can(context.actor.role, 'create', 'payment');

  const totalTaken = rows.reduce((sum, r) => sum + Number(r.amountCents), 0);
  const totalUnallocated = rows.reduce(
    (sum, r) => sum + (Number(r.amountCents) - Number(r.allocatedCents ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />

      {canRecord ? (
        <div className="mb-5">
          <RecordPaymentForm
            members={memberRows.map((m) => ({
              id: m.id,
              label: `${m.firstName} ${m.lastName} (${formatMemberCode(m.memberSeq)})`,
            }))}
            invoices={openInvoices.map((i) => ({
              id: i.id,
              payerMemberId: i.payerMemberId,
              label: `${i.number} · ${mur(Number(i.totalCents))}`,
            }))}
            openShift={openShift}
            hasTill={hasTill}
          />
        </div>
      ) : null}

      {totalUnallocated > 0 ? (
        <div className="mb-5">
          <Alert tone="warning">
            {t('payments.unallocatedWarning', { amount: mur(totalUnallocated) })}
          </Alert>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('payments.recent')}</CardTitle>
            <span className="text-muted text-sm tabular-nums">
              {t('payments.totalTaken', { amount: mur(totalTaken) })}
            </span>
          </div>
        </CardHeader>
        {rows.length === 0 ? (
          <CardBody>
            <p className="text-muted text-sm">{t('payments.empty')}</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('payments.payer')}</Th>
                <Th>{t('payments.method')}</Th>
                <Th>{t('payments.receivedOn')}</Th>
                <Th>{t('payments.reference')}</Th>
                <Th className="text-right">{t('payments.amount')}</Th>
                <Th className="text-right">{t('payments.allocated')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const amount = Number(p.amountCents);
                const alloc = Number(p.allocatedCents ?? 0);
                const outstanding = amount - alloc;
                return (
                  <tr key={p.id} className="hover:surface-2">
                    <Td className="font-medium">
                      {p.payerFirst} {p.payerLast}
                      <span className="text-muted ml-2 font-mono text-xs">
                        {formatMemberCode(p.payerSeq)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={p.method === 'cash' ? 'warning' : 'neutral'}>
                        {t(`payments.methods.${p.method}`)}
                      </Badge>
                    </Td>
                    <Td className="text-muted text-xs">{p.receivedAt}</Td>
                    <Td className="text-muted text-xs">{p.reference ?? '—'}</Td>
                    <Td className="text-right font-medium tabular-nums">{mur(amount)}</Td>
                    <Td className="text-right tabular-nums">
                      {outstanding === 0 ? (
                        <Badge tone="success">{t('payments.fullyAllocated')}</Badge>
                      ) : (
                        <Badge tone="warning">{t('payments.unallocated', { amount: mur(outstanding) })}</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
