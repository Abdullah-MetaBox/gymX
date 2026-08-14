'use server';

import { Money } from '@gymx/core';
import { ConflictError, NotFoundError } from '@gymx/core/errors';
import { invoiceLines, invoices, subscriptionMembers, subscriptions, members } from '@gymx/db';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';
import { sendInvoiceEmail } from '../../../lib/email';

const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  payerMemberId: z.string().uuid(),
  startsOn: z.string().date(),
  priceMajor: z.coerce.number().min(0),
  vatRateBp: z.coerce.number().int().min(0).max(10000).default(1500),
});

function toSubscriptionRow(
  input: z.infer<typeof createSubscriptionSchema>,
  gymId: string,
  vatRateBp: number,
) {
  return {
    gymId,
    planId: input.planId,
    payerMemberId: input.payerMemberId,
    status: 'active' as const,
    startsOn: input.startsOn,
    endsOn: null,
    minTermEndsOn: null,
    priceCentsSnapshot: Money.fromMajor(input.priceMajor),
    vatRateBpSnapshot: vatRateBp,
    nextInvoiceOn: input.startsOn,
    cancelledAt: null,
    cancelReason: null,
  };
}

export const createSubscriptionAction = defineAction(
  createSubscriptionSchema,
  {
    permission: { action: 'create', subject: 'subscription' },
    audit: { entity: 'subscription', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [subscription] = await db
      .insert(subscriptions)
      .values(toSubscriptionRow(input, gymId, input.vatRateBp))
      .returning();

    if (!subscription) throw new NotFoundError('Could not create subscription');

    // Add payer as a subscription member
    await db
      .insert(subscriptionMembers)
      .values({ subscriptionId: subscription.id, memberId: input.payerMemberId, gymId })
      .onConflictDoNothing();

    revalidatePath('/subscriptions');
    return { id: subscription.id };
  },
);

// Cancel a subscription
const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const cancelSubscriptionAction = defineAction(
  cancelSubscriptionSchema,
  {
    permission: { action: 'update', subject: 'subscription' },
    audit: {
      entity: 'subscription',
      action: 'cancel',
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [subscription] = await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: input.reason || null,
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.gymId, gymId)))
      .returning();

    if (!subscription) throw new NotFoundError('Subscription not found');

    revalidatePath('/subscriptions');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: subscription.id };
  },
);

// Create an invoice for a subscription
const createInvoiceSchema = z.object({
  subscriptionId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  dueOn: z.string().date(),
});

export const createInvoiceAction = defineAction(
  createInvoiceSchema,
  {
    permission: { action: 'create', subject: 'invoice' },
    audit: { entity: 'invoice', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    // Fetch subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.gymId, gymId)))
      .limit(1);

    if (!sub) throw new NotFoundError('Subscription not found');

    // Get next invoice number (for now, simple sequence)
    const lastInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.gymId, gymId))
      .limit(1);
    const lastInvoice = lastInvoices[0];

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Number(lastInvoice?.number?.split('-')[2] || 0) + 1).padStart(5, '0')}`;

    // Calculate VAT (snapshot is stored excluding VAT, so calculate what's owed)
    const vatRatePercent = sub.vatRateBpSnapshot / 100;
    const netAmount = sub.priceCentsSnapshot;
    const vatAmount = Math.round((netAmount * vatRatePercent) / (100 + vatRatePercent));
    const grossAmount = netAmount + vatAmount;

    // Create invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        gymId,
        number: invoiceNumber,
        subscriptionId: input.subscriptionId,
        payerMemberId: sub.payerMemberId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        issuedOn: new Date().toISOString().split('T')[0]!,
        dueOn: input.dueOn,
        subtotalCents: netAmount,
        discountCents: 0,
        vatCents: vatAmount,
        totalCents: grossAmount,
        status: 'issued' as const,
      })
      .returning();

    if (!invoice) throw new NotFoundError('Could not create invoice');

    // Create invoice line for the subscription
    await db.insert(invoiceLines).values({
      gymId,
      invoiceId: invoice.id,
      description: `Membership (${input.periodStart} to ${input.periodEnd})`,
      source: 'subscription' as const,
      qty: 1,
      unitPriceCents: netAmount,
      vatRateBp: sub.vatRateBpSnapshot,
      amountCents: netAmount,
    });

    // Send invoice email to payer
    const [payer] = await db
      .select({ email: members.email, firstName: members.firstName })
      .from(members)
      .where(eq(members.id, sub.payerMemberId))
      .limit(1);

    if (payer?.email) {
      await sendInvoiceEmail(payer.email, payer.firstName, invoice.number, grossAmount, input.dueOn);
    }

    revalidatePath('/invoices');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: invoice.id };
  },
);

// Update subscription (price, payer, end date)
const updateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  payerMemberId: z.string().uuid().optional(),
  priceMajor: z.coerce.number().min(0).optional(),
  endsOn: z.string().date().optional().or(z.literal('')),
});

export const updateSubscriptionAction = defineAction(
  updateSubscriptionSchema,
  {
    permission: { action: 'update', subject: 'subscription' },
    audit: { entity: 'subscription', action: 'update' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const updateData: Partial<typeof subscriptions.$inferInsert> = { updatedAt: new Date() };

    if (input.payerMemberId) updateData.payerMemberId = input.payerMemberId;
    if (input.priceMajor !== undefined) {
      updateData.priceCentsSnapshot = Money.fromMajor(input.priceMajor);
    }
    if (input.endsOn) updateData.endsOn = input.endsOn;

    const [subscription] = await db
      .update(subscriptions)
      .set(updateData)
      .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.gymId, gymId)))
      .returning();

    if (!subscription) throw new NotFoundError('Subscription not found');

    revalidatePath('/subscriptions');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: subscription.id };
  },
);

// Hold a subscription (pause)
const holdSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  holdStartsOn: z.string().date(),
  holdEndsOn: z.string().date(),
  reason: z.string().max(500).optional(),
});

export const holdSubscriptionAction = defineAction(
  holdSubscriptionSchema,
  {
    permission: { action: 'update', subject: 'subscription' },
    audit: {
      entity: 'subscription',
      action: 'hold',
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    // This is a simplified implementation. In Phase 5, this would create a hold record
    // and extend the subscription end date by the hold duration
    const holdDurationDays = new Date(input.holdEndsOn).getTime() - new Date(input.holdStartsOn).getTime();
    const durationMs = holdDurationDays / (1000 * 60 * 60 * 24);

    const [subscription] = await db
      .update(subscriptions)
      .set({
        status: 'frozen',
        updatedAt: new Date(),
      })
      .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.gymId, gymId)))
      .returning();

    if (!subscription) throw new NotFoundError('Subscription not found');

    revalidatePath('/subscriptions');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: subscription.id };
  },
);

// Resume a subscription
const resumeSubscriptionSchema = z.object({ subscriptionId: z.string().uuid() });

export const resumeSubscriptionAction = defineAction(
  resumeSubscriptionSchema,
  {
    permission: { action: 'update', subject: 'subscription' },
    audit: {
      entity: 'subscription',
      action: 'resume',
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [subscription] = await db
      .update(subscriptions)
      .set({ status: 'active', updatedAt: new Date() })
      .where(and(eq(subscriptions.id, input.subscriptionId), eq(subscriptions.gymId, gymId)))
      .returning();

    if (!subscription) throw new NotFoundError('Subscription not found');

    revalidatePath('/subscriptions');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: subscription.id };
  },
);

// Delete a subscription (only if no invoices exist)
const deleteSubscriptionSchema = z.object({ subscriptionId: z.string().uuid() });

export const deleteSubscriptionAction = defineAction(
  deleteSubscriptionSchema,
  {
    permission: { action: 'delete', subject: 'subscription' },
    audit: { entity: 'subscription', action: 'delete' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const invoiceCount = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(invoices)
      .where(and(eq(invoices.subscriptionId, input.subscriptionId), eq(invoices.gymId, gymId)))
      .then((r) => r[0]?.count ?? 0);

    // Thrown, not returned — see deleteMemberAction. An invoiced subscription is
    // money already owed; deleting it would orphan the invoice.
    if (invoiceCount > 0) {
      throw new ConflictError(
        'Cannot delete a subscription that has been invoiced. Cancel it instead.',
      );
    }

    await db
      .delete(subscriptionMembers)
      .where(eq(subscriptionMembers.subscriptionId, input.subscriptionId));
    await db.delete(subscriptions).where(eq(subscriptions.id, input.subscriptionId));

    revalidatePath('/subscriptions');
    return { id: input.subscriptionId };
  },
);
