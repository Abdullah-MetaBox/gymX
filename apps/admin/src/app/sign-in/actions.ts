'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { signIn } from '../../auth';

export interface SignInState {
  error?: string;
}

/**
 * Sign in.
 *
 * Every failure returns the same message. Distinguishing "no such account"
 * from "wrong password" would turn the form into an account enumerator for a
 * system holding member health notes and payment records.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const t = await getTranslations('auth');

  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t('invalidCredentials') };
    }
    throw error;
  }

  redirect('/');
}
