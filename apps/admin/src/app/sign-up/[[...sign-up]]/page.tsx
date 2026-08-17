import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthSplitLayout } from '../../sign-in/auth-split-layout';

/**
 * There is no self-service sign-up.
 *
 * Clerk can mint an account for anyone, but an account grants nothing here: a
 * Clerk identity has to resolve to a row in `users` before any role, gym or
 * record becomes reachable — see lib/clerk-identity.ts. Someone who signed
 * themselves up would land on a dashboard where every query returns nothing,
 * which reads as a broken product rather than a closed door.
 *
 * The route stays because Clerk's sign-in card links to it; it explains itself
 * instead of 404ing.
 */
export default async function SignUpPage() {
  const t = await getTranslations();

  return (
    <AuthSplitLayout
      brandName="GymX"
      brandTagline="Gym management for Mauritius."
      primaryColor="#d946ef"
      accentColor="#0f766e"
      points={[t('auth.point_members'), t('auth.point_access'), t('auth.point_money')]}
      form={
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">{t('auth.noSignUpTitle')}</h1>
          <p className="text-muted mt-2 text-sm">{t('auth.noSignUpBody')}</p>
          <Link
            href="/sign-in"
            className="mt-6 inline-block text-[var(--color-primary)] text-sm hover:underline"
          >
            {t('common.signIn')}
          </Link>
        </div>
      }
    />
  );
}
