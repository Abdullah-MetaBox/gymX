'use client';

import { useTransition } from 'react';
import { enterGymAction } from './enter-gym-action';

/**
 * Enter a gym as a platform admin.
 *
 * Deliberately a distinct, explicit action rather than a side effect of
 * opening a page: taking it writes an audit row the gym owner can see.
 */
export function EnterGymButton({ gymId, label }: { gymId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => enterGymAction(gymId))}
      className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm hover:surface-2 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
