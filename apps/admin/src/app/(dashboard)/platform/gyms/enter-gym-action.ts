'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assumeGym } from '../../../../lib/session';

export async function enterGymAction(gymId: string): Promise<void> {
  // Verifies platform-admin status and writes the audit row before the cookie
  // is set — entering a gym is never silent.
  await assumeGym(gymId);
  revalidatePath('/', 'layout');
  redirect('/');
}
