import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getPrincipal } from '../../lib/session';
import { SignInForm } from './sign-in-form';

export default async function SignInPage() {
  const principal = await getPrincipal();
  if (principal) redirect('/');

  const t = await getTranslations();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span
            className="inline-block h-7 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-primary)' }}
            aria-hidden
          />
          <div>
            <h1 className="font-semibold text-xl tracking-tight">{t('auth.signInTitle')}</h1>
            <p className="text-muted text-sm">{t('auth.signInSubtitle')}</p>
          </div>
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
      </div>
    </div>
  );
}
