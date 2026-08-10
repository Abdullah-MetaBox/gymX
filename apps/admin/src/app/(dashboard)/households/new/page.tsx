'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Alert, Button, Field, Input, PageHeader } from '../../../../components/ui/index';
import { createHouseholdAndRedirect } from '../actions';

export default function NewHouseholdPage() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      return createHouseholdAndRedirect({
        name: formData.get('name') as string,
      });
    },
    null,
  );

  return (
    <>
      <PageHeader title={t('households.createTitle')} />
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? t('common.loading') : t('households.create')}
          </Button>
          <a href="/households" className="text-muted text-sm hover:underline">
            {t('common.cancel')}
          </a>
        </div>
      </form>
    </>
  );
}
