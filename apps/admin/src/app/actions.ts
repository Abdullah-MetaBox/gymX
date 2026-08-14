'use server';

import { isLocale } from '@gymx/i18n';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { leaveGym, setActiveGym, setLocaleCookie } from '../lib/session';

/** Shell-level actions: switching gym, language, and signing out. */

export async function switchGymAction(formData: FormData): Promise<void> {
  const gymId = String(formData.get('gymId') ?? '');
  if (!gymId) return;
  // Validates the gym against this user's memberships; a platform admin
  // without a role there takes the audited assumeGym() path instead.
  await setActiveGym(gymId);
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function leaveGymAction(): Promise<void> {
  await leaveGym();
  revalidatePath('/', 'layout');
  redirect('/platform/gyms');
}

export async function switchLocaleAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? '');
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  revalidatePath('/', 'layout');
}

/**
 * Signing out is Clerk's to perform — it holds the session. The shell renders
 * Clerk's <SignOutButton> rather than posting here.
 */
