'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { addHouseholdMemberAction } from '../app/(dashboard)/households/actions';
import { Alert, Button, Field, Select } from './ui/index';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  memberSeq: number;
}

interface AddHouseholdMemberFormProps {
  householdId: string;
  availableMembers: Member[];
}

const RELATIONSHIP_VALUES = ['primary', 'spouse', 'child', 'other'] as const;

export function AddHouseholdMemberForm({
  householdId,
  availableMembers,
}: AddHouseholdMemberFormProps) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const data: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') data[key] = value;
      }
      data.householdId = householdId;
      return addHouseholdMemberAction(data);
    },
    null,
  );

  const fieldError = (name: string) => state && !state.ok && state.fieldErrors?.[name];

  if (availableMembers.length === 0) {
    return (
      <div className="text-sm text-muted">
        {t('common.none')} — all members are already in this household or no other members exist.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && !state.fieldErrors && <Alert tone="danger">{state.error}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Member"
          htmlFor="memberId"
          required
          errors={fieldError('memberId') || undefined}
        >
          <Select id="memberId" name="memberId" required>
            <option value="">{t('common.optional')}</option>
            {availableMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={t('households.relationship')}
          htmlFor="relationship"
          errors={fieldError('relationship') || undefined}
        >
          <Select id="relationship" name="relationship" defaultValue="other">
            {RELATIONSHIP_VALUES.map((r) => (
              <option key={r} value={r}>
                {t(`households.relationships.${r}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? t('common.loading') : 'Add Member'}
      </Button>
    </form>
  );
}
