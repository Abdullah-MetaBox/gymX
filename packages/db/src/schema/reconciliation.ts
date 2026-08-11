import {
  bigint,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { gyms, users } from './platform';

/**
 * Phase 6 — Payment Reconciliation: Bank statement import, auto-matching, unmatched queue.
 *
 * Two append-only tables:
 *   1. bank_imports — metadata for each bank statement upload
 *   2. bank_transactions — parsed line items; immutable once created
 *
 * Workflow:
 *   1. Staff uploads bank CSV (e.g., from Mauritius Commercial Bank)
 *   2. System extracts reference numbers (SF xxxx pattern)
 *   3. Auto-match: reference → customer → invoice → create payment_allocation
 *   4. Unmatched queue: staff manually resolves with search
 *   5. Reconciliation report: bank total vs system total
 */

export const bankImportStatusEnum = pgEnum('bank_import_status', [
  'pending', // Upload received, processing
  'matched', // Auto-match complete
  'review_needed', // Some transactions failed matching
  'reconciled', // All transactions matched/reviewed
]);

export const transactionMatchStatusEnum = pgEnum('transaction_match_status', [
  'matched', // Auto-matched via reference or manual match
  'unmatched', // No reference found, awaiting manual match
  'review_needed', // Matched but confidence < threshold (e.g., fuzzy match)
  'rejected', // Fees or error; staff marked as skip
]);

// ─────────────────────────────────────────────────────────────────────────────
// Bank Import Record
// ─────────────────────────────────────────────────────────────────────────────

export const bankImports = pgTable(
  'bank_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    bankName: text('bank_name').notNull(), // "Mauritius Commercial Bank", etc.
    statementStartDate: date('statement_start_date').notNull(),
    statementEndDate: date('statement_end_date').notNull(),
    totalTransactions: integer('total_transactions').notNull().default(0),
    matchedTransactions: integer('matched_transactions').notNull().default(0),
    unmatchedTransactions: integer('unmatched_transactions').notNull().default(0),
    status: bankImportStatusEnum('status').notNull().default('pending'),
    totalAmountCents: bigint('total_amount_cents', { mode: 'number' }).notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_imports_gym_idx').on(t.gymId),
    index('bank_imports_status_idx').on(t.gymId, t.status),
    index('bank_imports_date_idx').on(t.statementStartDate, t.statementEndDate),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Bank Transaction (parsed line items from statement)
// ─────────────────────────────────────────────────────────────────────────────

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    bankImportId: uuid('bank_import_id')
      .notNull()
      .references(() => bankImports.id, { onDelete: 'cascade' }),

    // Raw transaction data
    transactionDate: date('transaction_date').notNull(),
    description: text('description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    runningBalanceCents: bigint('running_balance_cents', { mode: 'number' }),

    // Extracted reference (SF xxxx pattern)
    referenceExtracted: text('reference_extracted'), // "SF1234" or null if not found

    // Matching details
    matchStatus: transactionMatchStatusEnum('match_status').notNull().default('unmatched'),
    matchedPaymentId: uuid('matched_payment_id'), // fk to payments.id (no constraint for soft match)
    confidenceScore: integer('confidence_score').default(0), // 100 = exact ref match, <70 = fuzzy

    // Manual override
    matchedBy: uuid('matched_by').references(() => users.id), // who did manual match
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    matchReason: text('match_reason'), // why manual match was needed

    // Staff notes
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bank_transactions_gym_idx').on(t.gymId),
    index('bank_transactions_reference_idx').on(t.referenceExtracted),
    index('bank_transactions_match_status_idx').on(t.matchStatus),
    index('bank_transactions_date_idx').on(t.transactionDate),
    index('bank_transactions_import_idx').on(t.bankImportId),
    index('bank_transactions_amount_idx').on(t.amountCents),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Extensions to existing tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add to subscriptions table:
 *   - discount_percent: SMALLINT (0-100)
 *   - discount_reason: TEXT (e.g., "sibling discount", "loyalty")
 *
 * Migration adds these columns as nullable; default to null for existing subscriptions.
 */

/**
 * Extend payments table:
 *   - reference_format: TEXT (e.g., "SF_XXXX") — pattern for validation
 *     Used during bank import to validate extracted references
 */
