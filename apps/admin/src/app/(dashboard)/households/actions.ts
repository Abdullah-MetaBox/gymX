'use server';

import { NotFoundError } from '@gymx/core/errors';
import { householdMembers, households } from '@gymx/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  payerMemberId: z.string().uuid().optional().or(z.literal('')),
});

export const createHouseholdAction = defineAction(
  createSchema,
  {
    permission: { action: 'create', subject: 'household' },
    audit: { entity: 'household', action: 'create' },
  },
  async (input, { db, actor }) => {
    const [household] = await db
      .insert(households)
      .values({
        gymId: actor.gymId!,
        name: input.name,
        payerMemberId: input.payerMemberId || null,
      })
      .returning();

    if (!household) throw new NotFoundError('Could not create household');

    revalidatePath('/households');
    return { id: household.id };
  },
);

const addMemberSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
  relationship: z.enum(['primary', 'spouse', 'child', 'other']).default('other'),
});

export const addHouseholdMemberAction = defineAction(
  addMemberSchema,
  {
    permission: { action: 'update', subject: 'household' },
    audit: {
      entity: 'household',
      action: 'add_member',
      entityId: (result) => (result as { householdId: string }).householdId,
    },
  },
  async (input, { db }) => {
    await db
      .insert(householdMembers)
      .values({
        householdId: input.householdId,
        memberId: input.memberId,
        relationship: input.relationship,
      })
      .onConflictDoNothing();

    revalidatePath(`/households/${input.householdId}`);
    return { householdId: input.householdId };
  },
);

const updatePayerSchema = z.object({
  householdId: z.string().uuid(),
  payerMemberId: z.string().uuid().optional().or(z.literal('')),
});

export const updateHouseholdPayerAction = defineAction(
  updatePayerSchema,
  {
    permission: { action: 'update', subject: 'household' },
    audit: { entity: 'household', action: 'update' },
  },
  async (input, { db }) => {
    const [household] = await db
      .update(households)
      .set({ payerMemberId: input.payerMemberId || null, updatedAt: new Date() })
      .where(eq(households.id, input.householdId))
      .returning();

    if (!household) throw new NotFoundError('Household not found');

    revalidatePath(`/households/${input.householdId}`);
    return { id: household.id };
  },
);

export async function createHouseholdAndRedirect(input: unknown) {
  const result = await createHouseholdAction(input);
  if (result.ok) {
    redirect(`/households/${result.data.id}`);
  }
  return result;
}

const updateSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(120),
  payerMemberId: z.string().uuid().optional().or(z.literal('')),
});

export const updateHouseholdAction = defineAction(
  updateSchema,
  {
    permission: { action: 'update', subject: 'household' },
    audit: { entity: 'household', action: 'update' },
  },
  async (input, { db }) => {
    const [household] = await db
      .update(households)
      .set({
        name: input.name,
        payerMemberId: input.payerMemberId || null,
        updatedAt: new Date(),
      })
      .where(eq(households.id, input.householdId))
      .returning();

    if (!household) throw new NotFoundError('Household not found');

    revalidatePath('/households');
    revalidatePath(`/households/${input.householdId}`);
    return { id: household.id };
  },
);

const deleteSchema = z.object({ householdId: z.string().uuid() });

export const deleteHouseholdAction = defineAction(
  deleteSchema,
  {
    permission: { action: 'delete', subject: 'household' },
    audit: { entity: 'household', action: 'delete' },
  },
  async (input, { db }) => {
    // Membership rows go first — the household is the parent.
    await db.delete(householdMembers).where(eq(householdMembers.householdId, input.householdId));
    await db.delete(households).where(eq(households.id, input.householdId));

    revalidatePath('/households');
    return { id: input.householdId };
  },
);
