import {
  bigint,
  boolean,
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
import { members } from './members';
import { plans } from './plans';
import { gyms, users } from './platform';

/**
 * Phase 3 — Subscriptions, holds, invoices, and invoice lines.
 *
 * Money rules (same as everywhere): all prices are bigint MINOR UNITS (cents).
 * VAT rates are integer basis points. Never a float.
 *
 * Design decisions recorded here:
 *   - subscriptions.price_cents_snapshot captures the resolved price at
 *     enrolment time. A manager raising a plan's rate must not silently change
 *     what existing members owe.
 *   - invoice_lines is append-only: corrections are credit notes, not edits.
 *     The UK-style approach where you void and reissue is not used — MRA
 *     expects a gapless number sequence, so voiding is the exception and
 *     `invoice_status = 'void'` records the act.
 *   - A subscription may have a min_term_ends_on that is extended whenever a
 *     hold with extends_term = true is applied. The scheduled job
 *     `resume-holds` handles the transition back to 'active'.
 */

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'frozen',     // on a hold
  'suspended',  // payment overdue, access blocked
  'cancelled',
  'expired',    // ended at scheduled end date
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').notNull().references(() => plans.id),
    payerMemberId: uuid('payer_member_id').notNull().references(() => members.id),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    /** The date through which the member is contractually committed. Extended by holds. */
    minTermEndsOn: date('min_term_ends_on'),
    /** Price locked at enrolment — immune to future plan-price changes. */
    priceCentsSnapshot: bigint('price_cents_snapshot', { mode: 'number' }).notNull(),
    vatRateBpSnapshot: integer('vat_rate_bp_snapshot').notNull().default(0),
    /** Next date the billing engine should generate an invoice for this subscription. */
    nextInvoiceOn: date('next_invoice_on'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subscriptions_gym_idx').on(t.gymId),
    index('subscriptions_payer_idx').on(t.gymId, t.payerMemberId),
    index('subscriptions_next_invoice_idx').on(t.gymId, t.nextInvoiceOn),
    index('subscriptions_status_idx').on(t.gymId, t.status),
  ],
);

// Members covered by a subscription (payer + any household members on the plan).
export const subscriptionMembers = pgTable(
  'subscription_members',
  {
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.subscriptionId, t.memberId] }),
    index('sub_members_gym_idx').on(t.gymId),
    index('sub_members_member_idx').on(t.gymId, t.memberId),
  ],
);

// ---------------------------------------------------------------------------
// Holds / freezes
// ---------------------------------------------------------------------------

export const subscriptionHolds = pgTable(
  'subscription_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    reason: text('reason'),
    /** When true the hold duration is added to min_term_ends_on. */
    extendsTerm: boolean('extends_term').notNull().default(true),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sub_holds_gym_idx').on(t.gymId),
    index('sub_holds_sub_idx').on(t.gymId, t.subscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'paid',
  'partially_paid',
  'overdue',
  'void',
  'written_off',
]);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    /** Gapless per-gym sequence, formatted by gyms.invoice_number_format. */
    number: text('number').notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    payerMemberId: uuid('payer_member_id').notNull().references(() => members.id),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    issuedOn: date('issued_on').notNull(),
    dueOn: date('due_on').notNull(),
    subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull(),
    discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
    vatCents: bigint('vat_cents', { mode: 'number' }).notNull().default(0),
    totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
    status: invoiceStatusEnum('status').notNull().default('issued'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invoices_gym_idx').on(t.gymId),
    index('invoices_payer_idx').on(t.gymId, t.payerMemberId),
    index('invoices_sub_idx').on(t.subscriptionId),
    index('invoices_status_idx').on(t.gymId, t.status),
    uniqueIndex('invoices_gym_number_key').on(t.gymId, t.number),
  ],
);

// ---------------------------------------------------------------------------
// Invoice lines — immutable once issued
// ---------------------------------------------------------------------------

export const invoiceLineSourceEnum = pgEnum('invoice_line_source', [
  'subscription',
  'joining_fee',
  'adjustment',
]);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    source: invoiceLineSourceEnum('source').notNull(),
    qty: integer('qty').notNull().default(1),
    unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
    /** Basis points on this line (may differ from gym default for historical lines). */
    vatRateBp: integer('vat_rate_bp').notNull().default(0),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('invoice_lines_gym_idx').on(t.gymId),
    index('invoice_lines_invoice_idx').on(t.invoiceId),
  ],
);
