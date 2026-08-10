import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { invoices, members } from './index';
import { gyms, users } from './platform';

/**
 * Phase 4 — Payments, allocation, till shifts, credit notes, write-offs.
 *
 * The heart of the reconciliation design. Five immutable tables enforce the
 * invariants that prevent a 200/400/600 situation:
 *
 *   1. payments — append-only, every rupee recorded with source (cash/card/check)
 *   2. payment_allocations — links payments to invoices; unallocated is a visible worklist
 *   3. credit_notes — reversals (not edits) for refunds and adjustments
 *   4. write_offs — debt forgiveness (audited, approved)
 *   5. till_shifts — daily accountability; variance signed and unerasable
 *
 * Money rule (as everywhere): all amounts are bigint minor units (cents).
 */

// ---------------------------------------------------------------------------
// Till registers and shifts (daily accountability)
// ---------------------------------------------------------------------------

export const tills = pgTable(
  'tills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Front desk", "Reception"
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tills_gym_idx').on(t.gymId)],
);

export const tillShiftStatusEnum = pgEnum('till_shift_status', [
  'open',
  'closed',
]);

export const tillShifts = pgTable(
  'till_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    tillId: uuid('till_id').notNull().references(() => tills.id),
    openedBy: uuid('opened_by').notNull().references(() => users.id),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    openingFloatCents: bigint('opening_float_cents', { mode: 'number' }).notNull().default(0),
    closedBy: uuid('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** Total counted when closing the shift. */
    countedCents: bigint('counted_cents', { mode: 'number' }),
    /** Expected: opening float + payments in shift. */
    expectedCents: bigint('expected_cents', { mode: 'number' }),
    /** countedCents - expectedCents. Positive = over, negative = short. */
    varianceCents: bigint('variance_cents', { mode: 'number' }),
    notes: text('notes'),
    status: tillShiftStatusEnum('status').notNull().default('open'),
  },
  (t) => [
    index('till_shifts_gym_idx').on(t.gymId),
    index('till_shifts_till_idx').on(t.tillId),
    index('till_shifts_status_idx').on(t.gymId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Payments (append-only)
// ---------------------------------------------------------------------------

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'card',
  'transfer',
  'cheque',
  'juice', // local payment processor
]);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    payerMemberId: uuid('payer_member_id').notNull().references(() => members.id),
    method: paymentMethodEnum('method').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    receivedAt: date('received_at').notNull(),
    reference: text('reference'),
    tillShiftId: uuid('till_shift_id').references(() => tillShifts.id),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    reversalOf: uuid('reversal_of'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_gym_idx').on(t.gymId),
    index('payments_payer_idx').on(t.gymId, t.payerMemberId),
    index('payments_till_shift_idx').on(t.tillShiftId),
    index('payments_received_idx').on(t.gymId, t.receivedAt),
  ],
);

// ---------------------------------------------------------------------------
// Payment allocations — explicit linking to invoices
// ---------------------------------------------------------------------------

export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.paymentId, t.invoiceId] }),
    index('payment_allocations_gym_idx').on(t.gymId),
    index('payment_allocations_payment_idx').on(t.paymentId),
    index('payment_allocations_invoice_idx').on(t.invoiceId),
  ],
);

// ---------------------------------------------------------------------------
// Credit notes and write-offs
// ---------------------------------------------------------------------------

export const creditNotes = pgTable(
  'credit_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_notes_gym_idx').on(t.gymId),
    index('credit_notes_invoice_idx').on(t.invoiceId),
  ],
);

export const writeOffs = pgTable(
  'write_offs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    approvedBy: uuid('approved_by').notNull().references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('write_offs_gym_idx').on(t.gymId),
    index('write_offs_invoice_idx').on(t.invoiceId),
  ],
);
