'use server';

import { Money } from '@gymx/core';
import { ConflictError, NotFoundError } from '@gymx/core/errors';
import {
  creditNotes,
  paymentAllocations,
  paymentMethodEnum,
  payments,
  tillShifts,
  tills,
  writeOffs,
} from '@gymx/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { defineAction } from '../../../lib/action';

// ---------------------------------------------------------------------------
// Till Management
// ---------------------------------------------------------------------------

const createTillSchema = z.object({
  name: z.string().min(1).max(100),
});

const createTillAction = defineAction(
  createTillSchema,
  {
    permission: { action: 'create', subject: 'till' },
    audit: { entity: 'till', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const [till] = await db.insert(tills).values({ gymId, name: input.name }).returning();

    if (!till) throw new NotFoundError('Could not create till');

    revalidatePath('/cash-drawer');
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

const openTillShiftAction = defineAction(
  openTillShiftSchema,
  {
    permission: { action: 'create', subject: 'till_shift' },
    audit: { entity: 'till_shift', action: 'open' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const openingFloatCents = Money.fromMajor(input.openingFloatMajor);

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

    revalidatePath('/cash-drawer');
    return { id: shift.id };
  },
);

const closeTillShiftSchema = z.object({
  tillShiftId: z.string().uuid(),
  countedMajor: z.coerce.number().min(0),
  notes: z.string().max(1000).optional(),
});

const closeTillShiftAction = defineAction(
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
    const countedCents = Money.fromMajor(input.countedMajor);

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
      .where(and(eq(payments.tillShiftId, input.tillShiftId), eq(payments.gymId, gymId)));

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

    revalidatePath('/cash-drawer');
    revalidatePath(`/cash-drawer/${input.tillShiftId}`);
    return {
      id: closed.id,
      varianceCents,
      varianceMajor: Money.toMajor(Money.cents(varianceCents)),
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

const createPaymentAction = defineAction(
  createPaymentSchema,
  {
    permission: { action: 'create', subject: 'payment' },
    audit: { entity: 'payment', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    /**
     * Cash cannot exist outside an open till shift.
     *
     * This is the invariant the product is built around. A VAT period at the
     * client's gym showed 200 payments in the gateway, 400 in the system and
     * 600 actually taken — the missing 200 was cash that entered the building
     * and never entered a system, because nothing forced it to. Making the
     * shift optional here re-opens exactly that hole, so cash without one is
     * refused rather than silently recorded with a null shift.
     *
     * Non-cash methods leave their own trail (a card terminal, a bank line, a
     * cheque), so they are allowed without a drawer.
     */
    if (input.method === 'cash') {
      if (!input.tillShiftId) {
        throw new ConflictError('Open a till shift before recording a cash payment.');
      }

      const [shift] = await db
        .select({ id: tillShifts.id, status: tillShifts.status })
        .from(tillShifts)
        .where(and(eq(tillShifts.id, input.tillShiftId), eq(tillShifts.gymId, gymId)))
        .limit(1);

      if (!shift) throw new NotFoundError('That till shift does not exist.');
      if (shift.status !== 'open') {
        throw new ConflictError('That till shift is closed. Open a new one to take cash.');
      }
    }

    const [payment] = await db
      .insert(payments)
      .values({
        gymId,
        payerMemberId: input.payerMemberId,
        method: input.method,
        amountCents: Money.fromMajor(input.amountMajor),
        receivedAt: input.receivedOn,
        reference: input.reference || null,
        tillShiftId: input.tillShiftId || null,
        recordedBy: actor.userId!,
      })
      .returning();

    if (!payment) throw new NotFoundError('Could not create payment');

    revalidatePath('/payments');
    revalidatePath('/cash-drawer');
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

const allocatePaymentAction = defineAction(
  allocatePaymentSchema,
  {
    permission: { action: 'create', subject: 'payment_allocation' },
    audit: { entity: 'payment_allocation', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Money.fromMajor(input.amountMajor);

    // Verify payment exists and is from the right gym
    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, input.paymentId), eq(payments.gymId, gymId)))
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

const createCreditNoteAction = defineAction(
  createCreditNoteSchema,
  {
    permission: { action: 'create', subject: 'credit_note' },
    audit: { entity: 'credit_note', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Money.fromMajor(input.amountMajor);

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

const createWriteOffAction = defineAction(
  createWriteOffSchema,
  {
    permission: { action: 'create', subject: 'write_off' },
    audit: { entity: 'write_off', action: 'create' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;
    const amountCents = Money.fromMajor(input.amountMajor);

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

/** Client-callable wrappers — see the note in members/actions.ts. */
export async function createTill(input: unknown) {
  return createTillAction(input);
}

export async function openTillShift(input: unknown) {
  return openTillShiftAction(input);
}

export async function closeTillShift(input: unknown) {
  return closeTillShiftAction(input);
}

export async function createPayment(input: unknown) {
  return createPaymentAction(input);
}

export async function allocatePayment(input: unknown) {
  return allocatePaymentAction(input);
}
