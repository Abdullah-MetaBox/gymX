'use server';

import { NotFoundError } from '@gymx/core/errors';
import {
  accessDirectionEnum,
  accessEvents,
  accessMethodEnum,
  accessReasonEnum,
  accessResultEnum,
  visits,
} from '@gymx/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

// ---------------------------------------------------------------------------
// Access Events (record entry/exit decisions)
// ---------------------------------------------------------------------------

const recordAccessEventSchema = z.object({
  memberId: z.string().uuid(),
  direction: z.enum(['in', 'out']),
  method: z.enum(['nfc', 'qr', 'manual', 'api']),
  area: z.string().min(1).max(100),
  result: z.enum(['granted', 'denied']),
  reasonCode: z.enum([
    'granted',
    'member_inactive',
    'no_active_subscription',
    'outside_access_window',
    'payment_overdue',
    'module_hook_deny',
  ]),
  overrideReason: z.string().max(500).optional(),
});

const recordAccessEventAction = defineAction(
  recordAccessEventSchema,
  {
    permission: { action: 'create', subject: 'access_event' },
    audit: { entity: 'access_event', action: 'record' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [event] = await db
      .insert(accessEvents)
      .values({
        gymId,
        memberId: input.memberId,
        enteredAt: new Date(),
        direction: input.direction,
        method: input.method,
        area: input.area,
        result: input.result,
        reasonCode: input.reasonCode,
        overriddenBy: input.overrideReason ? actor.userId! : null,
        overrideReason: input.overrideReason || null,
      })
      .returning();

    if (!event) throw new NotFoundError('Could not record access event');

    revalidatePath('/access');
    return { id: event.id };
  },
);

// ---------------------------------------------------------------------------
// Visits (track entry/exit pairs and dwell time)
// ---------------------------------------------------------------------------

const closeVisitSchema = z.object({
  visitId: z.string().uuid(),
});

const closeVisitAction = defineAction(
  closeVisitSchema,
  {
    permission: { action: 'update', subject: 'visit' },
    audit: {
      entity: 'visit',
      action: 'close',
      entityId: (input) => (input as { visitId: string }).visitId,
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    // Fetch the visit
    const [visit] = await db
      .select()
      .from(visits)
      .where(and(eq(visits.id, input.visitId), eq(visits.gymId, gymId)))
      .limit(1);

    if (!visit) throw new NotFoundError('Visit not found');
    if (visit.exitedAt) throw new NotFoundError('Visit already closed');

    // Calculate dwell time in minutes
    const exitedAt = new Date();
    const dwellMinutes = Math.floor((exitedAt.getTime() - visit.enteredAt.getTime()) / 60000);

    const [closed] = await db
      .update(visits)
      .set({
        exitedAt,
        dwellMinutes,
      })
      .where(eq(visits.id, input.visitId))
      .returning();

    if (!closed) throw new NotFoundError('Could not close visit');

    revalidatePath('/access');
    return { id: closed.id, dwellMinutes };
  },
);
