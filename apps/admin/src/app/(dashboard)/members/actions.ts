'use server';

import { can } from '@gymx/core/auth';
import { NotFoundError } from '@gymx/core/errors';
import { formatMemberCode, members, subscriptions, subscriptionMembers, plans } from '@gymx/db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const memberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
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

export const createMemberAction = defineAction(
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
      const [plan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);

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

export const updateMemberAction = defineAction(
  updateSchema,
  {
    permission: { action: 'update', subject: 'member' },
    audit: {
      entity: 'member',
      action: 'update',
      entityId: (result) => (result as { id: string }).id,
    },
  },
  async (input, { db, actor }) => {
    const canEditNfc = can(actor.role, 'update', 'member');
    const base = toRow(input);
    const updateData = canEditNfc ? base : { ...base, nfcUid: undefined };

    const [member] = await db
      .update(members)
      .set(updateData)
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
