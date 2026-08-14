'use client';

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
  Select,
} from '../../../components/ui/index';
import { createGuestPassAction } from './actions';

const today = () => new Date().toISOString().split('T')[0];

export function GuestPassForm({
  memberList,
}: {
  memberList: { id: string; firstName: string; lastName: string }[];
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const data: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') data[key] = value;
      }
      return createGuestPassAction(data);
    },
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('guestPasses.createTitle')}</CardTitle>
      </CardHeader>
      <CardBody>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
          {state?.ok && <Alert tone="info">{t('guestPasses.created')}</Alert>}

          <Field label={t('guestPasses.guestName')} htmlFor="guestName" required>
            <Input id="guestName" name="guestName" required />
          </Field>

          <Field label={t('guestPasses.guestPhone')} htmlFor="guestPhone">
            <Input id="guestPhone" name="guestPhone" type="tel" />
          </Field>

          <Field label={t('guestPasses.hostMember')} htmlFor="hostMemberId">
            <Select id="hostMemberId" name="hostMemberId">
              <option value="">{t('common.none')}</option>
              {memberList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('guestPasses.validOn')} htmlFor="validOn" required>
            <Input id="validOn" name="validOn" type="date" defaultValue={today()} required />
          </Field>

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? t('common.loading') : t('guestPasses.create')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
