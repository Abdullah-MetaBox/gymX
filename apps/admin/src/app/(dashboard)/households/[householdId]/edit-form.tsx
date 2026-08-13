'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Select } from '../../../../../components/ui/index';
import { updateHouseholdAction } from '../../actions';

const formatMemberCode = (seq: number) => `M${String(seq).padStart(5, '0')}`;

interface HouseholdFormProps {
  householdId: string;
  defaultName: string;
  defaultPayerMemberId: string | null;
  membersList: Array<{ id: string; firstName: string; lastName: string; memberSeq: number }>;
}

export function HouseholdForm({
  householdId,
  defaultName,
  defaultPayerMemberId,
  membersList,
}: HouseholdFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await updateHouseholdAction({
        householdId,
        name: formData.get('name') as string,
        payerMemberId: formData.get('payerMemberId') as string | undefined,
      });
      if (result.ok) {
        router.push(`/households/${householdId}`);
      }
      return result;
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
        <Input id="name" name="name" defaultValue={defaultName} required />
      </Field>

      <Field
        label={t('households.payer')}
        htmlFor="payerMemberId"
        hint={t('households.payerHelp')}
      >
        <Select id="payerMemberId" name="payerMemberId" defaultValue={defaultPayerMemberId || ''}>
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
          {pending ? t('common.loading') : t('common.save')}
        </Button>
        <a href={`/households/${householdId}`} className="text-muted text-sm hover:underline">
          {t('common.cancel')}
        </a>
      </div>
    </form>
  );
}
