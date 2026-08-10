'use client';

import { can } from '@gymx/core/auth';
import type { Role } from '@gymx/core/auth';
import { LOCALES } from '@gymx/i18n';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Alert, Button, Field, Input, Select } from './ui/index';

interface Plan {
  id: string;
  nameI18n: Record<string, string>;
}

interface MemberFormProps {
  action: (input: unknown) => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  defaultValues?: Record<string, string | null | undefined>;
  memberId?: string;
  role: Role;
  submitLabel: string;
  cancelHref?: string;
  plans?: Plan[];
}

const GENDER_VALUES = ['male', 'female'] as const;
const STATUS_VALUES = ['active', 'inactive', 'suspended', 'frozen'] as const;

const today = new Date().toISOString().split('T')[0];

export function MemberForm({ action, defaultValues = {}, memberId, role, submitLabel, cancelHref, plans = [] }: MemberFormProps) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const data: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') data[key] = value;
      }
      if (memberId) data.memberId = memberId;
      return action(data);
    },
    null,
  );

  const fieldError = (name: string) =>
    state && !state.ok && state.fieldErrors?.[name];

  const canManageStatus = can(role, 'update', 'member');

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state && !state.ok && !state.fieldErrors && (
        <Alert tone="danger">{state.error}</Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t('members.firstName')}
          htmlFor="firstName"
          required
          errors={fieldError('firstName') || undefined}
        >
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaultValues.firstName ?? ''}
            required
          />
        </Field>
        <Field
          label={t('members.lastName')}
          htmlFor="lastName"
          required
          errors={fieldError('lastName') || undefined}
        >
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaultValues.lastName ?? ''}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('members.email')} htmlFor="email" errors={fieldError('email') || undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues.email ?? ''}
          />
        </Field>
        <Field label={t('members.phone')} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={defaultValues.phone ?? ''} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('members.dateOfBirth')} htmlFor="dateOfBirth">
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={defaultValues.dateOfBirth ?? ''}
          />
        </Field>
        <Field label={t('members.gender')} htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={defaultValues.gender ?? ''}>
            <option value="">{t('common.optional')}</option>
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {t(`members.genders.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('members.nic')} htmlFor="nic">
          <Input id="nic" name="nic" defaultValue={defaultValues.nic ?? ''} />
        </Field>
        <Field label={t('members.joinedAt')} htmlFor="joinedAt" required>
          <Input
            id="joinedAt"
            name="joinedAt"
            type="date"
            defaultValue={defaultValues.joinedAt ?? today}
            required
          />
        </Field>
      </div>

      <Field label={t('members.address')} htmlFor="address">
        <textarea
          id="address"
          name="address"
          rows={2}
          defaultValue={defaultValues.address ?? ''}
          className="w-full rounded-lg border border-[var(--color-border)] surface px-3 py-2 text-sm resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('members.emergencyContact')} htmlFor="emergencyContactName">
          <Input
            id="emergencyContactName"
            name="emergencyContactName"
            defaultValue={defaultValues.emergencyContactName ?? ''}
          />
        </Field>
        <Field label={t('members.emergencyPhone')} htmlFor="emergencyContactPhone">
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            defaultValue={defaultValues.emergencyContactPhone ?? ''}
          />
        </Field>
      </div>

      <Field label={t('members.medicalNote')} htmlFor="medicalNote">
        <textarea
          id="medicalNote"
          name="medicalNote"
          rows={2}
          defaultValue={defaultValues.medicalNote ?? ''}
          className="w-full rounded-lg border border-[var(--color-border)] surface px-3 py-2 text-sm resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('members.locale')} htmlFor="locale">
          <Select id="locale" name="locale" defaultValue={defaultValues.locale ?? 'en'}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {t(`locale.${l}`)}
              </option>
            ))}
          </Select>
        </Field>

        {!memberId && (
          <Field label="Plan (optional)" htmlFor="planId">
            <Select id="planId" name="planId" defaultValue={defaultValues.planId ?? ''}>
              <option value="">{t('common.optional')}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameI18n.en || p.nameI18n.fr || 'Unnamed plan'}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {canManageStatus && (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('members.status')} htmlFor="status">
            <Select id="status" name="status" defaultValue={defaultValues.status ?? 'active'}>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(`members.statuses.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {canManageStatus && (
        <Field
          label={t('members.nfcUid')}
          htmlFor="nfcUid"
          hint={t('members.nfcUidHelp')}
        >
          <Input
            id="nfcUid"
            name="nfcUid"
            defaultValue={defaultValues.nfcUid ?? ''}
            className="font-mono"
          />
        </Field>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? t('common.loading') : submitLabel}
        </Button>
        {cancelHref && (
          <a href={cancelHref} className="text-muted text-sm hover:underline">
            {t('common.cancel')}
          </a>
        )}
      </div>
    </form>
  );
}
