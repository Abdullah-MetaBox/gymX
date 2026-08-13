'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteHouseholdAction } from '../actions';

export function HouseholdActions({ householdId, householdName }: { householdId: string; householdName: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    async () => {
      const result = await deleteHouseholdAction({ householdId });
      if (result.ok) {
        router.push('/households');
      }
      return result;
    },
    null,
  );

  return (
    <>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="inline-flex items-center justify-center rounded-md border border-[#EF4444] px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D] disabled:opacity-50"
        disabled={deletePending}
      >
        {t('common.delete')}
      </button>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-[#27272A]">
            <h2 className="mb-2 text-lg font-semibold text-[#EF4444]">{t('households.deleteConfirmTitle')}</h2>
            <p className="mb-4 text-sm text-[#6B7280] dark:text-[#A0A0A8]">
              {t('households.deleteConfirmBody', { name: householdName })}
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
