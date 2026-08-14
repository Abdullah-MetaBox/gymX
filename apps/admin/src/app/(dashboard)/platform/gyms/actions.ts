'use server';

import { Time } from '@gymx/core';
import { ConflictError, NotFoundError } from '@gymx/core/errors';
import type { TxDatabase } from '@gymx/db';
import { diffOf, gyms } from '@gymx/db';
import { LOCALES } from '@gymx/i18n';
import { allModules, runSeeds } from '@gymx/modules';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../../lib/action';

/** Slug is immutable after creation: it appears in URLs and, later, in exports. */
const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

const timezoneSchema = z
  .string()
  .refine((value) => Time.isValidTimeZone(value), 'Not a recognised IANA time zone');

const localeSchema = z.enum(LOCALES);

const settingsSchema = z.object({
  name: z.string().min(2).max(120),
  brn: z.string().max(40).optional().or(z.literal('')),
  vatNumber: z.string().max(40).optional().or(z.literal('')),
  timezone: timezoneSchema,
  currency: z.string().length(3).toUpperCase(),
  /** Entered as a percentage, stored as basis points — integers only, never a float. */
  vatRatePercent: z.coerce.number().min(0).max(100),
  defaultLocale: localeSchema,
  locales: z.array(localeSchema).min(1),
  minContractMonths: z.coerce.number().int().min(0).max(60),
  overdueGraceDays: z.coerce.number().int().min(0).max(90),
  atRiskDays: z.coerce.number().int().min(1).max(365),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour')
    .optional()
    .or(z.literal('')),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour')
    .optional()
    .or(z.literal('')),
  logoUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  enabledModules: z.array(z.string()).default([]),
});

const createSchema = settingsSchema.extend({ slug: slugSchema });

function toRow(input: z.infer<typeof settingsSchema>) {
  const branding: Record<string, string> = {};
  if (input.primaryColor) branding.primaryColor = input.primaryColor;
  if (input.accentColor) branding.accentColor = input.accentColor;
  if (input.logoUrl) branding.logoUrl = input.logoUrl;

  return {
    name: input.name,
    brn: input.brn || null,
    vatNumber: input.vatNumber || null,
    timezone: input.timezone,
    currency: input.currency,
    vatRateBp: Math.round(input.vatRatePercent * 100),
    defaultLocale: input.defaultLocale,
    locales: input.locales,
    minContractMonths: input.minContractMonths,
    overdueGraceDays: input.overdueGraceDays,
    atRiskDays: input.atRiskDays,
    branding,
    enabledModules: input.enabledModules.filter((id) =>
      allModules().some((module) => module.id === id),
    ),
  };
}

/**
 * Create a gym. Platform scope: it writes to `gyms`, which no tenant context
 * can insert into — the RLS policy requires the platform flag.
 */
export const createGymAction = defineAction(
  createSchema,
  {
    permission: { action: 'create', subject: 'gym' },
    scope: 'platform',
    audit: { entity: 'gym', action: 'create' },
  },
  async (input, { db }) => {
    const existing = await db.select().from(gyms).where(eq(gyms.slug, input.slug)).limit(1);
    if (existing.length > 0) {
      throw new ConflictError(`A gym with the slug "${input.slug}" already exists`);
    }

    const [gym] = await db
      .insert(gyms)
      .values({ ...toRow(input), slug: input.slug })
      .returning();

    if (!gym) throw new ConflictError('Could not create the gym');

    // Enabled modules get a chance to seed themselves into the new tenant.
    await runSeeds(gym.enabledModules, { gymId: gym.id });

    revalidatePath('/platform/gyms');
    return { id: gym.id, slug: gym.slug };
  },
);

const updateSchema = settingsSchema.extend({ gymId: z.string().uuid() });

/**
 * Shared update logic. The two actions below differ only in the context they
 * run inside, and that difference is the point — see the note on
 * `updateGymOnPlatformAction`.
 */
async function applyGymUpdate(db: TxDatabase, input: z.infer<typeof updateSchema>) {
  const [before] = await db.select().from(gyms).where(eq(gyms.id, input.gymId)).limit(1);
  if (!before) throw new NotFoundError('Gym not found');

  const [after] = await db
    .update(gyms)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(gyms.id, input.gymId))
    .returning();

  if (!after) throw new NotFoundError('Gym not found');

  revalidatePath('/settings');
  revalidatePath('/platform/gyms');

  // Only changed fields reach the audit log — a trail that repeats every
  // column on every edit is a trail nobody reads.
  return { id: after.id, changes: diffOf(before, after) };
}

const updateAudit = {
  entity: 'gym',
  action: 'update',
  entityId: (result: unknown) => (result as { id: string }).id,
  diff: (_input: unknown, result: unknown) =>
    (result as { changes: Record<string, unknown> }).changes,
} as const;

/**
 * A gym manager editing their own gym, from Settings.
 *
 * Tenant scope: RLS confines the UPDATE to the active gym, so pointing this at
 * someone else's `gymId` does not fail a permission check — it matches no row.
 */
export const updateGymAction = defineAction(
  updateSchema,
  { permission: { action: 'update', subject: 'gym' }, audit: updateAudit },
  async (input, { db }) => applyGymUpdate(db, input),
);

/**
 * A platform admin editing any gym, from the platform console.
 *
 * A separate action rather than a flag on the one above: the console edits a
 * gym the admin has not entered, so there is no tenant context to run in. The
 * audit row still lands in the edited gym's trail — a gym owner should be able
 * to see that Metabox changed their VAT rate.
 */
export const updateGymOnPlatformAction = defineAction(
  updateSchema,
  {
    permission: { action: 'update', subject: 'gym' },
    scope: 'platform',
    audit: { ...updateAudit, gymId: (input) => (input as { gymId: string }).gymId },
  },
  async (input, { db }) => applyGymUpdate(db, input),
);
