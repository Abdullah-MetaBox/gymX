'use server';

import { ConflictError, NotFoundError, ValidationError } from '@gymx/core/errors';
import { formatMemberCode, members, plans, subscriptionMembers, subscriptions } from '@gymx/db';
import { getStorage } from '@gymx/storage';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const memberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  nic: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(30).optional().or(z.literal('')),
  medicalNote: z.string().max(1000).optional().or(z.literal('')),
  nfcUid: z.string().max(64).optional().or(z.literal('')),
  locale: z.enum(['en', 'fr']).default('en'),
  status: z.enum(['active', 'inactive', 'suspended', 'frozen']).default('active'),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planId: z.string().uuid().optional().or(z.literal('')),
});

function toRow(input: z.infer<typeof memberSchema>) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email || null,
    phone: input.phone || null,
    dateOfBirth: input.dateOfBirth || null,
    gender: (input.gender || null) as 'male' | 'female' | null,
    nic: input.nic || null,
    address: input.address || null,
    emergencyContactName: input.emergencyContactName || null,
    emergencyContactPhone: input.emergencyContactPhone || null,
    medicalNote: input.medicalNote || null,
    nfcUid: input.nfcUid || null,
    locale: input.locale,
    status: input.status as 'active' | 'inactive' | 'suspended' | 'frozen',
    joinedAt: input.joinedAt,
    updatedAt: new Date(),
  };
}

const createMemberAction = defineAction(
  memberSchema,
  {
    permission: { action: 'create', subject: 'member' },
    audit: { entity: 'member', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const seqResult = await db
      .select({ nextSeq: sql<number>`COALESCE(MAX(member_seq), 0) + 1` })
      .from(members)
      .where(eq(members.gymId, gymId));
    const nextSeq = seqResult[0]?.nextSeq ?? 1;

    const [member] = await db
      .insert(members)
      .values({ ...toRow(input), gymId, memberSeq: nextSeq })
      .returning();

    if (!member) throw new NotFoundError('Could not create member');

    // If a plan was selected, create a subscription
    if (input.planId) {
      const [plan] = await db.select().from(plans).where(eq(plans.id, input.planId)).limit(1);

      if (plan) {
        const today = input.joinedAt;
        const [subscription] = await db
          .insert(subscriptions)
          .values({
            gymId,
            planId: plan.id,
            payerMemberId: member.id,
            status: 'active',
            startsOn: today,
            priceCentsSnapshot: plan.basePriceCents,
            vatRateBpSnapshot: 1500,
            nextInvoiceOn: today,
          })
          .returning();

        if (subscription) {
          await db
            .insert(subscriptionMembers)
            .values({ subscriptionId: subscription.id, memberId: member.id, gymId })
            .onConflictDoNothing();
        }
      }
    }

    revalidatePath('/members');
    revalidatePath('/subscriptions');
    return { id: member.id, code: formatMemberCode(member.memberSeq) };
  },
);

const updateSchema = memberSchema.extend({ memberId: z.string().uuid() });

const updateMemberAction = defineAction(
  updateSchema,
  {
    permission: { action: 'update', subject: 'member' },
    audit: {
      entity: 'member',
      action: 'update',
      entityId: (result) => (result as { id: string }).id,
    },
  },
  async (input, { db }) => {
    const [member] = await db
      .update(members)
      .set(toRow(input))
      .where(eq(members.id, input.memberId))
      .returning();

    if (!member) throw new NotFoundError('Member not found');

    revalidatePath('/members');
    revalidatePath(`/members/${input.memberId}`);
    return { id: member.id };
  },
);

export async function createMemberAndRedirect(input: unknown) {
  const result = await createMemberAction(input);
  if (result.ok) {
    redirect(`/members/${result.data.id}`);
  }
  return result;
}

export async function updateMemberAndRedirect(input: unknown) {
  const result = await updateMemberAction(input);
  if (result.ok) {
    const memberId = (input as { memberId?: string }).memberId;
    redirect(`/members/${memberId}`);
  }
  return result;
}

const deleteSchema = z.object({ memberId: z.string().uuid() });

const deleteMemberAction = defineAction(
  deleteSchema,
  {
    permission: { action: 'delete', subject: 'member' },
    audit: { entity: 'member', action: 'delete' },
  },
  async (input, { db }) => {
    // A member covered by any subscription cannot be deleted — the subscription
    // and its invoices would be left pointing at a hole. Archive instead.
    const subscriptionCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(subscriptions)
      .innerJoin(subscriptionMembers, eq(subscriptionMembers.subscriptionId, subscriptions.id))
      .where(eq(subscriptionMembers.memberId, input.memberId))
      .then((r) => r[0]?.count ?? 0);

    // Thrown, not returned: defineAction wraps a returned value as the action's
    // `data`, so a returned {ok:false} becomes {ok:true, data:{ok:false}} and the
    // caller reads it as success.
    if (subscriptionCount > 0) {
      throw new ConflictError(
        'Cannot delete a member who is covered by a subscription. Archive them instead.',
      );
    }

    await db.delete(members).where(eq(members.id, input.memberId));

    revalidatePath('/members');
    return { id: input.memberId };
  },
);

const setPhotoSchema = z.object({
  memberId: z.string().uuid(),
  photoKey: z.string().min(1).max(512),
  photoUrl: z.string().url().max(1024),
});

const setMemberPhotoAction = defineAction(
  setPhotoSchema,
  {
    permission: { action: 'update', subject: 'member' },
    audit: { entity: 'member', action: 'photo_set' },
  },
  async (input, { db, actor }) => {
    // Both values come back from our own upload route, but they arrive over the
    // wire like any other action input. Without these two checks a signed-in
    // user could point a member's photo at an arbitrary external URL — a
    // tracking pixel that fires for every colleague who opens the list.
    if (!input.photoKey.startsWith(`gyms/${actor.gymId}/`)) {
      throw new ValidationError('That photo does not belong to this gym.', {
        photoKey: ['Unexpected storage key'],
      });
    }
    if (!isBlobUrl(input.photoUrl)) {
      throw new ValidationError('That photo URL is not a storage URL.', {
        photoUrl: ['Unexpected host'],
      });
    }

    const [member] = await db
      .update(members)
      .set({ photoKey: input.photoKey, photoUrl: input.photoUrl, updatedAt: new Date() })
      .where(eq(members.id, input.memberId))
      .returning();

    if (!member) throw new NotFoundError('Member not found');

    revalidatePath('/members');
    revalidatePath(`/members/${input.memberId}`);
    return { id: member.id };
  },
);

const deleteMemberPhotoAction = defineAction(
  z.object({ memberId: z.string().uuid() }),
  {
    permission: { action: 'update', subject: 'member' },
    audit: { entity: 'member', action: 'photo_deleted' },
  },
  async (input, { db }) => {
    const [existing] = await db
      .select({ photoKey: members.photoKey })
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1);

    if (!existing) throw new NotFoundError('Member not found');

    // Clear the reference first: a member whose photo failed to delete from
    // storage is recoverable, a row still pointing at a deleted blob renders a
    // broken image to the front desk.
    await db
      .update(members)
      .set({ photoKey: null, photoUrl: null, updatedAt: new Date() })
      .where(eq(members.id, input.memberId));

    if (existing.photoKey) {
      try {
        await getStorage().delete(existing.photoKey);
      } catch (error) {
        console.error('[members] photo row cleared but blob delete failed', error);
      }
    }

    revalidatePath('/members');
    revalidatePath(`/members/${input.memberId}`);
    return { id: input.memberId };
  },
);

function isBlobUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === 'https:' && hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

const archiveSchema = z.object({ memberId: z.string().uuid() });

const archiveMemberAction = defineAction(
  archiveSchema,
  {
    permission: { action: 'update', subject: 'member' },
    audit: { entity: 'member', action: 'archive' },
  },
  async (input, { db }) => {
    const [member] = await db
      .update(members)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(members.id, input.memberId))
      .returning();

    if (!member) throw new NotFoundError('Member not found');

    revalidatePath('/members');
    revalidatePath(`/members/${input.memberId}`);
    return { id: member.id };
  },
);

/**
 * Client-callable wrappers.
 *
 * A 'use server' module only yields a usable client reference for a statically
 * recognisable async function declaration. `export const x = defineAction(...)`
 * is a const whose value happens to be a function, which Next cannot see
 * through — importing one into a client component sends the module itself and
 * fails with "Only plain objects can be passed to Client Components".
 *
 * The actions above stay as they are for server-side callers; these are what
 * client components import.
 */
export async function archiveMember(input: unknown) {
  return archiveMemberAction(input);
}

export async function deleteMember(input: unknown) {
  return deleteMemberAction(input);
}

export async function setMemberPhoto(input: unknown) {
  return setMemberPhotoAction(input);
}

export async function deleteMemberPhoto(input: unknown) {
  return deleteMemberPhotoAction(input);
}
