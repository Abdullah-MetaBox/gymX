'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { cancelSubscriptionAction } from '../app/(dashboard)/subscriptions/actions';
import { Button } from './ui/index';
import { ConfirmDialog } from './ui/modal';

type SubscriptionStatus = 'active' | 'frozen' | 'suspended' | 'cancelled' | 'expired';

/**
 * Actions valid for a subscription's current status.
 *
 * Hold and resume are deliberately absent: holdSubscriptionAction only flips the
 * status today — it writes no subscription_holds row and does not extend the
 * minimum term. A Hold button that silently fails to extend the term is worse
 * than no button, because the shortfall only surfaces when a VAT period will not
 * reconcile. See the plan's deferred list.
 */
export function SubscriptionActions({
  subscriptionId,
  status,
  label,
  size = 'sm',
}: {
  subscriptionId: string;
  status: SubscriptionStatus;
  label: string;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancellable = status === 'active' || status === 'frozen' || status === 'suspended';
  if (!cancellable) return null;

  return (
    <>
      <Button variant="danger" size={size} onClick={() => setOpen(true)}>
        {t('subscriptions.cancel')}
      </Button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() =>
          startTransition(async () => {
            const result = await cancelSubscriptionAction({ subscriptionId });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setOpen(false);
            router.refresh();
          })
        }
        title={t('subscriptions.cancelConfirmTitle')}
        body={t('subscriptions.cancelConfirmBody', { name: label })}
        confirmLabel={t('subscriptions.cancel')}
        cancelLabel={t('common.back')}
        pending={pending}
        error={error}
      />
    </>
  );
}
