'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '../../../../components/ui/index';
import { ConfirmDialog } from '../../../../components/ui/modal';
import { deleteHouseholdAction } from '../actions';

export function HouseholdActions({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        {t('common.delete')}
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteHouseholdAction({ householdId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            router.push('/members');
            router.refresh();
          })
        }
        title={t('households.deleteConfirmTitle')}
        body={t('households.deleteConfirmBody', { name: householdName })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        pending={pending}
        error={error}
      />
    </>
  );
}
