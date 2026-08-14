'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from '../../../../components/ui/index';
import { createInvoiceAction } from '../../subscriptions/actions';

interface CreateInvoiceFormProps {
  formId: string;
  subscriptionId: string;
  payerName: string;
  amount: number;
  defaultStartDate: string;
}

export function CreateInvoiceForm({
  formId,
  subscriptionId,
  payerName,
  amount,
  defaultStartDate,
}: CreateInvoiceFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createInvoiceAction({
        subscriptionId,
        periodStart: formData.get('periodStart') as string,
        periodEnd: formData.get('periodEnd') as string,
        dueOn: formData.get('dueOn') as string,
      });
      if (result.ok) {
        router.push('/invoices');
      }
      return result;
    },
    null,
  );

  const formatMur = (cents: number) =>
    (cents / 100).toLocaleString('en-MU', {
      style: 'currency',
      currency: 'MUR',
      maximumFractionDigits: 0,
    });

  return (
    <Card id={formId}>
      <CardHeader>
        <CardTitle>{payerName}</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}

          <div className="rounded-md bg-[#F3F4F6] p-3 dark:bg-[#2D2D35]">
            <p className="text-sm font-medium">{t('invoices.amount')}</p>
            <p className="text-2xl font-bold tabular-nums">{formatMur(amount)}</p>
          </div>

          <Field
            label={t('invoices.periodStart')}
            htmlFor={`periodStart-${subscriptionId}`}
            required
          >
            <Input
              id={`periodStart-${subscriptionId}`}
              name="periodStart"
              type="date"
              defaultValue={defaultStartDate}
              required
            />
          </Field>

          <Field label={t('invoices.periodEnd')} htmlFor={`periodEnd-${subscriptionId}`} required>
            <Input
              id={`periodEnd-${subscriptionId}`}
              name="periodEnd"
              type="date"
              defaultValue={defaultStartDate}
              required
            />
          </Field>

          <Field label={t('invoices.dueOn')} htmlFor={`dueOn-${subscriptionId}`} required>
            <Input
              id={`dueOn-${subscriptionId}`}
              name="dueOn"
              type="date"
              defaultValue={today}
              required
            />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? t('common.loading') : t('invoices.create')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
