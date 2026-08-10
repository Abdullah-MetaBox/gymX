'use server';

import {
  creditNotes,
  paymentAllocations,
  paymentMethodEnum,
  payments,
  tillShifts,
  tills,
  writeOffs,
} from '@gymx/db';
import { NotFoundError } from '@gymx/core/errors';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

// ---------------------------------------------------------------------------
// Till Management
// ---------------------------------------------------------------------------

const createTillSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createTillAction = defineAction(
  createTillSchema,
  {
    permission: { action: 'create', subject: 'till' },
    audit: { entity: 'till', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [till] = await db
      .insert(tills)
      .values({ gymId, name: input.name })
      .returning();

    if (!till) throw new NotFoundError('Could not create till');

    revalidatePath('/till-shifts');
    return { id: till.id };
  },
);

// ---------------------------------------------------------------------------
// Till Shifts (open/close with accountability)
// ---------------------------------------------------------------------------

const openTillShiftSchema = z.object({
  tillId: z.string().uuid(),
  openingFloatMajor: z.coerce.number().min(0).default(0),
});

export const openTillShiftAction = defineAction(
  openTillShiftSchema,
  {
    permission: { action: 'create', subject: 'till_shift' },
    audit: { entity: 'till_shift', action: 'open' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const openingFloatCents = Math.round(input.openingFloatMajor * 100);

    const [shift] = await db
      .insert(tillShifts)
      .values({
        gymId,
        tillId: input.tillId,
        openedBy: actor.userId!,
        openedAt: new Date(),
        openingFloatCents,
        status: 'open',
      })
      .returning();

    if (!shift) throw new NotFoundError('Could not open till shift');

    revalidatePath('/till-shifts');
    return { id: shift.id };
  },
);

const closeTillShiftSchema = z.object({
  tillShiftId: z.string().uuid(),
  countedMajor: z.coerce.number().min(0),
  notes: z.string().max(1000).optional(),
});

export const closeTillShiftAction = defineAction(
  closeTillShiftSchema,
  {
    permission: { action: 'update', subject: 'till_shift' },
    audit: {
      entity: 'till_shift',
      action: 'close',
      entityId: (input) => (input as { tillShiftId: string }).tillShiftId,
    },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const countedCents = Math.round(input.countedMajor * 100);

    // Fetch the shift
    const [shift] = await db
      .select()
      .from(tillShifts)
      .where(
        and(
          eq(tillShifts.id, input.tillShiftId),
          eq(tillShifts.gymId, gymId),
          eq(tillShifts.status, 'open'),
        ),
      )
      .limit(1);

    if (!shift) throw new NotFoundError('Till shift not found or not open');

    // Sum all payments in this shift
    const shiftPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.tillShiftId, input.tillShiftId),
          eq(payments.gymId, gymId),
        ),
      );

    const totalPaymentsCents = shiftPayments.reduce((sum, p) => sum + p.amountCents, 0);

    // Expected = opening float + total payments
    const expectedCents = shift.openingFloatCents + totalPaymentsCents;

    // Variance = counted - expected (positive = over, negative = short)
    const varianceCents = countedCents - expectedCents;

    const [closed] = await db
      .update(tillShifts)
      .set({
        closedBy: actor.userId!,
        closedAt: new Date(),
        countedCents,
        expectedCents,
        varianceCents,
        status: 'closed',
      })
      .where(eq(tillShifts.id, input.tillShiftId))
      .returning();

    if (!closed) throw new NotFoundError('Could not close till shift');

    revalidatePath('/till-shifts');
    revalidatePath(`/till-shifts/${input.tillShiftId}`);
    return {
      id: closed.id,
      varianceCents,
      varianceMajor: varianceCents / 100,
    };
  },
);

// ---------------------------------------------------------------------------
// Payments (append-only, cash or card)
// ---------------------------------------------------------------------------

const createPaymentSchema = z.object({
  payerMemberId: z.string().uuid(),
  method: z.enum(['cash', 'card', 'transfer', 'cheque', 'juice']),
  amountMajor: z.coerce.number().min(0.01),
  reference: z.string().max(255).optional(),
  tillShiftId: z.string().uuid().optional(),
  receivedOn: z.string().date(),
});

export const createPaymentAction = defineAction(
  createPaymentSchema,
  {
    permission: { action: 'create', subject: 'payment' },
    audit: { entity: 'payment', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Math.round(input.amountMajor * 100);

    const [payment] = await db
      .insert(payments)
      .values({
        gymId,
        payerMemberId: input.payerMemberId,
        method: input.method,
        amountCents,
        receivedAt: input.receivedOn,
        reference: input.reference || null,
        tillShiftId: input.tillShiftId || null,
        recordedBy: actor.userId!,
      })
      .returning();

    if (!payment) throw new NotFoundError('Could not create payment');

    revalidatePath('/payments');
    return { id: payment.id };
  },
);

// ---------------------------------------------------------------------------
// Payment Allocations (explicit linking to invoices)
// ---------------------------------------------------------------------------

const allocatePaymentSchema = z.object({
  paymentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amountMajor: z.coerce.number().min(0.01),
});

export const allocatePaymentAction = defineAction(
  allocatePaymentSchema,
  {
    permission: { action: 'create', subject: 'payment_allocation' },
    audit: { entity: 'payment_allocation', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Math.round(input.amountMajor * 100);

    // Verify payment exists and is from the right gym
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.gymId, gymId),
        ),
      )
      .limit(1);

    if (!payment) throw new NotFoundError('Payment not found');

    // Upsert allocation (idempotent on the composite key)
    const [allocation] = await db
      .insert(paymentAllocations)
      .values({
        paymentId: input.paymentId,
        invoiceId: input.invoiceId,
        gymId,
        amountCents,
      })
      .onConflictDoUpdate({
        target: [paymentAllocations.paymentId, paymentAllocations.invoiceId],
        set: { amountCents },
      })
      .returning();

    if (!allocation) throw new NotFoundError('Could not allocate payment');

    revalidatePath('/payments');
    return { paymentId: allocation.paymentId, invoiceId: allocation.invoiceId };
  },
);

// ---------------------------------------------------------------------------
// Credit Notes (for reversals and adjustments)
// ---------------------------------------------------------------------------

const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  amountMajor: z.coerce.number().min(0.01),
  reason: z.string().min(1).max(500),
});

export const createCreditNoteAction = defineAction(
  createCreditNoteSchema,
  {
    permission: { action: 'create', subject: 'credit_note' },
    audit: { entity: 'credit_note', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Math.round(input.amountMajor * 100);

    const [creditNote] = await db
      .insert(creditNotes)
      .values({
        gymId,
        invoiceId: input.invoiceId,
        amountCents,
        reason: input.reason,
        createdBy: actor.userId!,
      })
      .returning();

    if (!creditNote) throw new NotFoundError('Could not create credit note');

    revalidatePath('/payments');
    return { id: creditNote.id };
  },
);

// ---------------------------------------------------------------------------
// Write-offs (debt forgiveness, audited)
// ---------------------------------------------------------------------------

const createWriteOffSchema = z.object({
  invoiceId: z.string().uuid(),
  amountMajor: z.coerce.number().min(0.01),
  reason: z.string().min(1).max(500),
});

export const createWriteOffAction = defineAction(
  createWriteOffSchema,
  {
    permission: { action: 'create', subject: 'write_off' },
    audit: { entity: 'write_off', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Math.round(input.amountMajor * 100);

    const [writeOff] = await db
      .insert(writeOffs)
      .values({
        gymId,
        invoiceId: input.invoiceId,
        amountCents,
        reason: input.reason,
        approvedBy: actor.userId!,
      })
      .returning();

    if (!writeOff) throw new NotFoundError('Could not create write-off');

    revalidatePath('/payments');
    return { id: writeOff.id };
  },
);
