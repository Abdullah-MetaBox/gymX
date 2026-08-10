'use server';

// Money helpers for conversions
import { NotFoundError } from '@gymx/core/errors';
import { invoiceLines, invoices, subscriptionMembers, subscriptions } from '@gymx/db';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

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
    priceCentsSnapshot: Math.round(input.priceMajor * 100),
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
      entityId: (input) => (input as { subscriptionId: string }).subscriptionId,
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

    revalidatePath('/invoices');
    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { id: invoice.id };
  },
);
