'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '../../../../components/ui/index';
import { ConfirmDialog } from '../../../../components/ui/modal';
import { archiveMember, deleteMember } from '../actions';

type Dialog = 'archive' | 'delete' | null;

export function MemberActions({
  memberId,
  memberName,
  canDelete,
}: {
  memberId: string;
  memberName: string;
  canDelete: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setDialog(null);
    setError(null);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        // The guard now reaches the user. These actions previously returned an
        // error-shaped object as their data, so the caller saw ok:true and
        // navigated away as though the member had been removed.
        setError(result.error ?? t('common.unknown'));
        return;
      }
      setDialog(null);
      router.push('/members');
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setDialog('archive')}>
        {t('members.archive')}
      </Button>
      {canDelete ? (
        <Button variant="danger" size="sm" onClick={() => setDialog('delete')}>
          {t('common.delete')}
        </Button>
      ) : null}

      <ConfirmDialog
        open={dialog === 'archive'}
        onClose={close}
        onConfirm={() => run(() => archiveMember({ memberId }))}
        title={t('members.archiveConfirmTitle')}
        body={t('members.archiveConfirmBody', { name: memberName })}
        confirmLabel={t('members.archive')}
        cancelLabel={t('common.cancel')}
        tone="primary"
        pending={pending}
        error={error}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        onConfirm={() => run(() => deleteMember({ memberId }))}
        title={t('members.deleteConfirmTitle')}
        body={t('members.deleteConfirmBody', { name: memberName })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        pending={pending}
        error={error}
      />
    </>
  );
}
