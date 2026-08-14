import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { env } from '../../lib/env';
import { getPrincipal } from '../../lib/session';
import { AuthSplitLayout } from './auth-split-layout';
import { SignInForm } from './sign-in-form';

/**
 * Branding for the sign-in screen.
 *
 * Nobody is authenticated here, so there is no gym context to read branding
 * from — the deployment itself decides. GYMABC_MODE marks the client-facing
 * build; the default is the platform's own identity.
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

  return (
    <AuthSplitLayout
      brandName={brand.name}
      brandTagline={brand.tagline}
      primaryColor={brand.primaryColor}
      accentColor={brand.accentColor}
      points={[t('auth.point_members'), t('auth.point_access'), t('auth.point_money')]}
      form={
        <>
          <div className="mb-8">
            <h1 className="font-semibold text-2xl tracking-tight">{t('auth.signInTitle')}</h1>
            <p className="text-muted mt-1 text-sm">{t('auth.signInSubtitle')}</p>
          </div>

          <SignInForm
            labels={{
              email: t('auth.email'),
              password: t('auth.password'),
              submit: t('common.signIn'),
              submitting: t('auth.signingIn'),
              invalid: t('auth.invalidCredentials'),
            }}
          />
        </>
      }
    />
  );
}
