'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveMemberAction, deleteMemberAction } from '../actions';

export function MemberActions({ memberId, memberName }: { memberId: string; memberName: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [archiveState, archiveAction, archivePending] = useActionState(
    async () => {
      const result = await archiveMemberAction({ memberId });
      if (result.ok) {
        router.push('/members');
      }
      return result;
    },
    null,
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async () => {
      const result = await deleteMemberAction({ memberId });
      if (result.ok) {
        router.push('/members');
      }
      return result;
    },
    null,
  );

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowArchiveConfirm(true)}
          className="inline-flex items-center justify-center rounded-md border border-[#D1D5DB] px-3 py-2 text-sm font-medium hover:bg-[#F3F4F6] dark:border-[#4B5563] dark:hover:bg-[#2D2D35] disabled:opacity-50"
          disabled={archivePending}
        >
          {t('members.archive')}
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center justify-center rounded-md border border-[#EF4444] px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D] disabled:opacity-50"
          disabled={deletePending}
        >
          {t('common.delete')}
        </button>
      </div>

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-[#27272A]">
            <h2 className="mb-2 text-lg font-semibold">{t('members.archiveConfirmTitle')}</h2>
            <p className="mb-4 text-sm text-[#6B7280] dark:text-[#A0A0A8]">
              {t('members.archiveConfirmBody', { name: memberName })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D35]"
              >
                {t('common.cancel')}
              </button>
              <form action={archiveAction}>
                <button
                  type="submit"
                  className="rounded-md bg-[#D946EF] px-3 py-2 text-sm font-medium text-white hover:bg-[#C026D3] disabled:opacity-50"
                  disabled={archivePending}
                >
                  {archivePending ? t('common.loading') : t('members.archive')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-[#27272A]">
            <h2 className="mb-2 text-lg font-semibold text-[#EF4444]">{t('members.deleteConfirmTitle')}</h2>
            <p className="mb-4 text-sm text-[#6B7280] dark:text-[#A0A0A8]">
              {t('members.deleteConfirmBody', { name: memberName })}
            </p>
            {deleteState && !deleteState.ok && (
              <p className="mb-4 text-sm text-[#EF4444]">{deleteState.error}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[#F3F4F6] dark:hover:bg-[#2D2D35]"
              >
                {t('common.cancel')}
              </button>
              <form action={deleteAction}>
                <button
                  type="submit"
                  className="rounded-md bg-[#EF4444] px-3 py-2 text-sm font-medium text-white hover:bg-[#DC2626] disabled:opacity-50"
                  disabled={deletePending}
                >
                  {deletePending ? t('common.loading') : t('common.delete')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
