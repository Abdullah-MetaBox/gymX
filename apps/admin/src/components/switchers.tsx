'use client';

import { useRef } from 'react';
import { cn } from '../lib/utils';

/**
 * Select controls that submit their form on change.
 *
 * Client components purely so the change handler exists; the mutation itself
 * is still a server action, and the `<noscript>` button keeps both usable
 * without JavaScript.
 */

function AutoSubmitSelect({
  name,
  defaultValue,
  ariaLabel,
  className,
  children,
  submitLabel,
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <select
        ref={(node) => {
          formRef.current = node?.form ?? null;
        }}
        name={name}
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cn(
          'h-9 rounded-lg border border-[var(--color-border)] surface px-2 text-sm',
          className,
        )}
      >
        {children}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm underline">
          {submitLabel}
        </button>
      </noscript>
    </>
  );
}

export function GymSelect({
  gyms,
  activeGymId,
  label,
  submitLabel,
}: {
  gyms: { id: string; name: string }[];
  activeGymId: string;
  label: string;
  submitLabel: string;
}) {
  return (
    <AutoSubmitSelect
      name="gymId"
      defaultValue={activeGymId}
      ariaLabel={label}
      className="w-52"
      submitLabel={submitLabel}
    >
      {gyms.map((gym) => (
        <option key={gym.id} value={gym.id}>
          {gym.name}
        </option>
      ))}
    </AutoSubmitSelect>
  );
}

export function LocaleSelect({
  locales,
  activeLocale,
  label,
  submitLabel,
}: {
  locales: { value: string; label: string }[];
  activeLocale: string;
  label: string;
  submitLabel: string;
}) {
  return (
    <AutoSubmitSelect
      name="locale"
      defaultValue={activeLocale}
      ariaLabel={label}
      className="w-28"
      submitLabel={submitLabel}
    >
      {locales.map((locale) => (
        <option key={locale.value} value={locale.value}>
          {locale.label}
        </option>
      ))}
    </AutoSubmitSelect>
  );
}
