'use server';

import { NotFoundError } from '@gymx/core/errors';
import { planAccessRules, planPriceTiers, plans } from '@gymx/db';
// i18n content helpers available via Content namespace if needed
import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

const accessRuleSchema = z.object({
  area: z.enum(['gym', 'pool', 'classes']),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal('')),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal('')),
});

const priceTierSchema = z.object({
  sizeFrom: z.coerce.number().int().min(1),
  sizeTo: z.coerce.number().int().min(1).optional(),
  priceCents: z.coerce.number().int().min(0),
});

const planSchema = z.object({
  nameEn: z.string().min(1).max(120),
  nameFr: z.string().max(120).optional().or(z.literal('')),
  descriptionEn: z.string().max(500).optional().or(z.literal('')),
  descriptionFr: z.string().max(500).optional().or(z.literal('')),
  type: z.enum(['contract', 'pass']),
  category: z.enum(['solo', 'couple', 'family', 'group', 'student', 'lunch', 'full']),
  billingInterval: z.enum(['monthly', 'quarterly', 'annual']).optional().or(z.literal('')),
  /** Entered as major units (e.g. 1800), stored as cents (180000). */
  basePriceMajor: z.coerce.number().min(0),
  vatInclusive: z.coerce.boolean().default(false),
  joiningFeeMajor: z.coerce.number().min(0).default(0),
  minTermMonths: z.coerce.number().int().min(0).default(0),
  passDurationDays: z.coerce.number().int().min(1).optional(),
  pricingModel: z.enum(['flat', 'flat_by_size', 'per_head_by_size']).default('flat'),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  accessRules: z.array(accessRuleSchema).default([]),
  priceTiers: z.array(priceTierSchema).default([]),
});

function toRow(input: z.infer<typeof planSchema>) {
  return {
    nameI18n: {
      en: input.nameEn,
      ...(input.nameFr ? { fr: input.nameFr } : {}),
    },
    descriptionI18n: {
      ...(input.descriptionEn ? { en: input.descriptionEn } : {}),
      ...(input.descriptionFr ? { fr: input.descriptionFr } : {}),
    },
    type: input.type as 'contract' | 'pass',
    category: input.category as
      | 'solo'
      | 'couple'
      | 'family'
      | 'group'
      | 'student'
      | 'lunch'
      | 'full',
    billingInterval: (input.billingInterval || null) as 'monthly' | 'quarterly' | 'annual' | null,
    basePriceCents: Math.round(input.basePriceMajor * 100),
    vatInclusive: input.vatInclusive,
    joiningFeeCents: Math.round(input.joiningFeeMajor * 100),
    minTermMonths: input.minTermMonths,
    passDurationDays: input.passDurationDays ?? null,
    pricingModel: input.pricingModel as 'flat' | 'flat_by_size' | 'per_head_by_size',
    active: input.active,
    sortOrder: input.sortOrder,
    updatedAt: new Date(),
  };
}

const createPlanAction = defineAction(
  planSchema,
  {
    permission: { action: 'create', subject: 'plan' },
    audit: { entity: 'plan', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [plan] = await db
      .insert(plans)
      .values({ ...toRow(input), gymId })
      .returning();

    if (!plan) throw new NotFoundError('Could not create plan');

    if (input.accessRules.length > 0) {
      await db.insert(planAccessRules).values(
        input.accessRules.map((rule) => ({
          gymId,
          planId: plan.id,
          area: rule.area as 'gym' | 'pool' | 'classes',
          weekdays: rule.weekdays ?? null,
          startTime: rule.startTime || null,
          endTime: rule.endTime || null,
        })),
      );
    }

    if (input.priceTiers.length > 0) {
      await db.insert(planPriceTiers).values(
        input.priceTiers.map((tier) => ({
          gymId,
          planId: plan.id,
          sizeFrom: tier.sizeFrom,
          sizeTo: tier.sizeTo ?? null,
          priceCents: tier.priceCents,
        })),
      );
    }

    revalidatePath('/plans');
    return { id: plan.id };
  },
);

const updateSchema = planSchema.extend({ planId: z.string().uuid() });

const updatePlanAction = defineAction(
  updateSchema,
  {
    permission: { action: 'update', subject: 'plan' },
    audit: {
      entity: 'plan',
      action: 'update',
      entityId: (result) => (result as { id: string }).id,
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [plan] = await db
      .update(plans)
      .set(toRow(input))
      .where(eq(plans.id, input.planId))
      .returning();

    if (!plan) throw new NotFoundError('Plan not found');

    // Replace access rules and price tiers wholesale on every edit.
    await db.delete(planAccessRules).where(eq(planAccessRules.planId, input.planId));
    await db.delete(planPriceTiers).where(eq(planPriceTiers.planId, input.planId));

    if (input.accessRules.length > 0) {
      await db.insert(planAccessRules).values(
        input.accessRules.map((rule) => ({
          gymId,
          planId: plan.id,
          area: rule.area as 'gym' | 'pool' | 'classes',
          weekdays: rule.weekdays ?? null,
          startTime: rule.startTime || null,
          endTime: rule.endTime || null,
        })),
      );
    }

    if (input.priceTiers.length > 0) {
      await db.insert(planPriceTiers).values(
        input.priceTiers.map((tier) => ({
          gymId,
          planId: plan.id,
          sizeFrom: tier.sizeFrom,
          sizeTo: tier.sizeTo ?? null,
          priceCents: tier.priceCents,
        })),
      );
    }

    revalidatePath('/plans');
    revalidatePath(`/plans/${input.planId}`);
    return { id: plan.id };
  },
);

export async function createPlanAndRedirect(input: unknown) {
  const result = await createPlanAction(input);
  if (result.ok) redirect(`/plans/${result.data.id}`);
  return result;
}

export async function updatePlanAndRedirect(input: unknown) {
  const result = await updatePlanAction(input);
  if (result.ok) redirect(`/plans/${(input as { planId: string }).planId}`);
  return result;
}
