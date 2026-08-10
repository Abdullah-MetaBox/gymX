import { resolveBranding } from '@gymx/modules';
import { redirect } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';
import { getActiveContext } from '../../lib/session';

/**
 * The authenticated shell.
 *
 * This is the real gate — the middleware only checks that a cookie exists.
 * Here the actor is resolved against the database, so a forged session cookie
 * lands straight back on the sign-in page.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const context = await getActiveContext();
  if (!context) redirect('/sign-in');

  // Branding: the gym's own settings, with any enabled module's overrides on
  // top. Applied as CSS custom properties so every component inherits the
  // gym's colour without knowing that gyms have colours.
  const moduleBranding = resolveBranding(context.membership?.enabledModules ?? []);
  const branding = { ...(context.membership?.branding ?? {}), ...moduleBranding };

  const style: CSSProperties = {};
  if (branding.primaryColor) {
    (style as Record<string, string>)['--color-primary'] = branding.primaryColor;
    (style as Record<string, string>)['--color-primary-hover'] = branding.primaryColor;
  }
  if (branding.accentColor) {
    (style as Record<string, string>)['--color-accent'] = branding.accentColor;
  }

  return (
    <div style={style}>
      <AppShell context={context}>{children}</AppShell>
    </div>
  );
}
