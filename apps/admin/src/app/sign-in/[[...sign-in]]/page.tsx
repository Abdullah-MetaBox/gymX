import { SignIn, SignOutButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { env } from '../../../lib/env';
import { getPrincipal } from '../../../lib/session';
import { AuthSplitLayout } from '../auth-split-layout';

/**
 * Catch-all so Clerk can own its own sub-routes (factor-two, SSO callback,
 * verification) without each needing a page here.
 */

function brandFor(gymAbcMode: boolean) {
  if (gymAbcMode) {
    return {
      name: 'Gym ABC',
      tagline: 'Island Breeze.',
      primaryColor: '#d946ef',
      accentColor: '#0f766e',
    };
  }
  return {
    name: 'GymX',
    tagline: 'Gym management for Mauritius.',
    primaryColor: '#d946ef',
    accentColor: '#0f766e',
  };
}

export default async function SignInPage() {
  const principal = await getPrincipal();
  if (principal) redirect('/');

  const t = await getTranslations();
  const brand = brandFor(Boolean(env.GYMABC_MODE));

  // Signed in to Clerk, but that identity resolves to no GymX user — so every
  // protected page redirects back here and the form re-renders, which reads as
  // "my password keeps failing" when the password was never the problem.
  // Say so instead, and offer the way out.
  const { userId: clerkUserId } = await auth();
  const unprovisioned = Boolean(clerkUserId);

  return (
    <AuthSplitLayout
      brandName={brand.name}
      brandTagline={brand.tagline}
      primaryColor={brand.primaryColor}
      accentColor={brand.accentColor}
      points={[t('auth.point_members'), t('auth.point_access'), t('auth.point_money')]}
      form={
        unprovisioned ? (
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {t('auth.notProvisionedTitle')}
            </h1>
            <p className="text-muted mt-2 text-sm">{t('auth.notProvisionedBody')}</p>
            <div className="mt-6">
              <SignOutButton redirectUrl="/sign-in">
                <button
                  type="button"
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium hover:surface-2"
                >
                  {t('auth.notProvisionedAction')}
                </button>
              </SignOutButton>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-semibold text-2xl tracking-tight">{t('auth.signInTitle')}</h1>
              <p className="text-muted mt-1 text-sm">{t('auth.signInSubtitle')}</p>
            </div>

            <SignIn
              appearance={{
                elements: {
                  // The page already carries the heading and the brand panel.
                  rootBox: 'w-full',
                  cardBox: 'w-full shadow-none border-none',
                  card: 'shadow-none border-none bg-transparent p-0',
                  header: 'hidden',
                  footer: 'hidden',
                  formButtonPrimary:
                    'bg-[var(--color-primary)] hover:opacity-90 text-white normal-case text-sm',
                },
              }}
            />
          </>
        )
      }
    />
  );
}
