'use client';

import { formatMemberCode } from '@gymx/db';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Alert, Button, Field, Input, Select } from '../../../components/ui/index';
import { createHouseholdAndRedirect } from './actions';

interface NewHouseholdFormProps {
  membersList: Array<{ id: string; firstName: string; lastName: string; memberSeq: number }>;
}

export function NewHouseholdForm({ membersList }: NewHouseholdFormProps) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return createHouseholdAndRedirect({
        name: formData.get('name') as string,
        payerMemberId: formData.get('payerMemberId') as string | undefined,
      });
    },
    null,
  );

  return (
    <form action={formAction} className="max-w-md space-y-4">
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}

      <Field
        label={t('households.name')}
        htmlFor="name"
        required
        hint={t('households.nameHelp')}
      >
        <Input id="name" name="name" required />
      </Field>

      <Field
        label={t('households.payer')}
        htmlFor="payerMemberId"
        hint={t('households.payerHelp')}
        required
      >
        <Select id="payerMemberId" name="payerMemberId" required>
          <option value="">— {t('common.select')}</option>
          {membersList.map((member) => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName} ({formatMemberCode(member.memberSeq)})
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t('common.loading') : t('households.create')}
        </Button>
        <a href="/households" className="text-muted text-sm hover:underline">
          {t('common.cancel')}
        </a>
      </div>
    </form>
  );
}
