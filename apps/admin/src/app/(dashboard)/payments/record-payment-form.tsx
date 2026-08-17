'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
} from '../../../components/ui/index';
import { allocatePayment, createPayment } from './actions';

const METHODS = ['cash', 'card', 'transfer', 'cheque', 'juice'] as const;

/**
 * Record money received, and put it against an invoice in the same step.
 *
 * Allocation is offered here rather than as a later chore because an
 * unallocated payment is money the gym has taken and cannot account for — the
 * exact condition this product exists to eliminate.
 */
export function RecordPaymentForm({
  members,
  invoices,
  openShift,
  hasTill,
}: {
  members: { id: string; label: string }[];
  invoices: { id: string; payerMemberId: string; label: string }[];
  openShift: { id: string; tillName: string } | null;
  hasTill: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [payerMemberId, setPayerMemberId] = useState(members[0]?.id ?? '');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));

  // Only this payer's open invoices — allocating to someone else's bill is a
  // reconciliation error waiting to happen.
  const payerInvoices = useMemo(
    () => invoices.filter((i) => i.payerMemberId === payerMemberId),
    [invoices, payerMemberId],
  );

  const cashBlocked = method === 'cash' && !openShift;

  function submit() {
    setError(null);
    startTransition(async () => {
      const created = await createPayment({
        payerMemberId,
        method,
        amountMajor: Number(amount),
        reference: reference || undefined,
        receivedOn,
        tillShiftId: method === 'cash' ? openShift?.id : undefined,
      });

      if (!created.ok) {
        setError(created.error);
        return;
      }

      if (invoiceId) {
        const allocated = await allocatePayment({
          paymentId: created.data.id,
          invoiceId,
          amountMajor: Number(amount),
        });
        if (!allocated.ok) {
          // The payment is recorded and correct; only the link failed. Say so
          // precisely rather than implying the money was not taken.
          setError(t('payments.allocateFailed', { error: allocated.error }));
          router.refresh();
          return;
        }
      }

      setAmount('');
      setReference('');
      setInvoiceId('');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payments.record')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}

        {openShift ? (
          <p className="text-muted text-sm">
            {t('payments.shiftOpen', { till: openShift.tillName })}
          </p>
        ) : (
          <Alert tone="warning">
            {hasTill ? t('payments.noOpenShift') : t('payments.noTill')}{' '}
            <Link href="/cash-drawer" className="underline underline-offset-2">
              {t('nav.tillShifts')}
            </Link>
          </Alert>
        )}

        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label={t('payments.payer')} htmlFor="payerMemberId" required>
            <Select
              id="payerMemberId"
              value={payerMemberId}
              onChange={(e) => {
                setPayerMemberId(e.target.value);
                setInvoiceId('');
              }}
              required
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('payments.method')} htmlFor="method" required>
            <Select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`payments.methods.${m}`)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('payments.amount')} htmlFor="amount" required>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>

          <Field label={t('payments.receivedOn')} htmlFor="receivedOn" required>
            <Input
              id="receivedOn"
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              required
            />
          </Field>

          <Field label={t('payments.reference')} htmlFor="reference">
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('payments.referenceHint')}
            />
          </Field>

          <Field label={t('payments.allocateTo')} htmlFor="invoiceId">
            <Select
              id="invoiceId"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              disabled={payerInvoices.length === 0}
            >
              <option value="">
                {payerInvoices.length === 0
                  ? t('payments.noOpenInvoices')
                  : t('payments.allocateLater')}
              </option>
              {payerInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={pending || cashBlocked || !amount || !payerMemberId}>
              {pending ? t('common.loading') : t('payments.record')}
            </Button>
            {cashBlocked ? (
              <span className="text-muted ml-3 text-sm">{t('payments.cashNeedsShift')}</span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
