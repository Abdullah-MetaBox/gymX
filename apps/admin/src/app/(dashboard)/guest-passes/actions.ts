'use server';

import { NotFoundError } from '@gymx/core/errors';
import { guestPasses } from '@gymx/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const createSchema = z.object({
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().max(30).optional().or(z.literal('')),
  hostMemberId: z.string().uuid().optional().or(z.literal('')),
  validOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createGuestPassAction = defineAction(
  createSchema,
  {
    permission: { action: 'create', subject: 'guest_pass' },
    audit: { entity: 'guest_pass', action: 'create' },
  },
  async (input, { db, actor }) => {
    const [pass] = await db
      .insert(guestPasses)
      .values({
        gymId: actor.gymId!,
        guestName: input.guestName,
        guestPhone: input.guestPhone || null,
        hostMemberId: input.hostMemberId || null,
        validOn: input.validOn,
        issuedBy: actor.userId,
      })
      .returning();

    if (!pass) throw new NotFoundError('Could not create guest pass');

    revalidatePath('/guest-passes');
    return { id: pass.id };
  },
);

/** Client-callable wrapper — see the note in members/actions.ts. */
export async function createGuestPass(input: unknown) {
  return createGuestPassAction(input);
}
