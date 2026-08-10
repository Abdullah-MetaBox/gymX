import { ROLE_LABELS } from '@gymx/core/auth';
import { LOCALE_LABELS, LOCALES } from '@gymx/i18n';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { leaveGymAction, signOutAction, switchGymAction, switchLocaleAction } from '../app/actions';
import { navFor } from '../lib/nav';
import type { ActiveContext } from '../lib/session';
import { NavLinks } from './nav-links';
import { GymSelect, LocaleSelect } from './switchers';
import { ThemeToggle } from './theme-toggle';
import { Alert, Badge } from './ui/index';

/**
 * The admin shell.
 *
 * Server-rendered, so nav is computed from the actor's permissions before
 * anything reaches the browser: a link a role cannot use is never sent, rather
 * than sent and hidden with CSS.
 */
export async function AppShell({
  context,
  children,
}: {
  context: ActiveContext;
  children: ReactNode;
}) {
  const t = await getTranslations();
  const { principal, membership, actor, assumed } = context;

  const entries = navFor({
    role: actor.role,
    isPlatformAdmin: principal.isPlatformAdmin,
    enabledModules: membership?.enabledModules ?? [],
    gymId: actor.gymId,
    locale: context.locale,
    timeZone: context.timeZone,
  });

  const enabledLocales = (membership?.locales ?? [...LOCALES]).filter((locale) =>
    (LOCALES as readonly string[]).includes(locale),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-[var(--color-border)] border-r surface md:flex">
        <div className="flex h-14 items-center gap-2 border-[var(--color-border)] border-b px-5">
          <span
            className="inline-block h-6 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-primary)' }}
            aria-hidden
          />
          <span className="font-semibold tracking-tight">{t('common.appName')}</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          <NavLinks
            entries={entries.map((entry) => ({
              id: entry.id,
              href: entry.href,
              icon: entry.icon,
              label: t(`nav.${entry.labelKey}` as never),
            }))}
          />
        </nav>

        <div className="border-[var(--color-border)] border-t p-3 text-xs">
          <p className="truncate font-medium">{principal.name}</p>
          <p className="truncate text-muted">{principal.email}</p>
          <p className="mt-1.5">
            <Badge tone={actor.role === 'accountant' ? 'neutral' : 'primary'}>
              {ROLE_LABELS[actor.role]}
            </Badge>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-[var(--color-border)] border-b surface px-4">
          <div className="flex min-w-0 items-center gap-3">
            {principal.memberships.length > 1 ? (
              <form action={switchGymAction}>
                <GymSelect
                  gyms={principal.memberships.map((m) => ({ id: m.gymId, name: m.gymName }))}
                  activeGymId={membership?.gymId ?? ''}
                  label={t('gymSwitcher.label')}
                  submitLabel={t('common.confirm')}
                />
              </form>
            ) : membership ? (
              <span className="truncate font-medium text-sm">{membership.gymName}</span>
            ) : (
              <span className="text-muted text-sm">{t('gymSwitcher.platformView')}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {enabledLocales.length > 1 ? (
              <form action={switchLocaleAction}>
                <LocaleSelect
                  locales={enabledLocales.map((locale) => ({
                    value: locale,
                    label: LOCALE_LABELS[locale as (typeof LOCALES)[number]],
                  }))}
                  activeLocale={context.locale}
                  label={t('locale.label')}
                  submitLabel={t('common.confirm')}
                />
              </form>
            ) : null}

            <ThemeToggle />

            <form action={signOutAction}>
              <button type="submit" className="rounded-lg px-3 py-1.5 text-sm hover:surface-2">
                {t('common.signOut')}
              </button>
            </form>
          </div>
        </header>

        {assumed && membership ? (
          <div className="px-6 pt-4">
            <Alert tone="warning">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{t('gymSwitcher.assumed', { gym: membership.gymName })}</span>
                <form action={leaveGymAction}>
                  <button type="submit" className="underline underline-offset-2">
                    {t('gymSwitcher.leave')}
                  </button>
                </form>
              </div>
            </Alert>
          </div>
        ) : null}

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
