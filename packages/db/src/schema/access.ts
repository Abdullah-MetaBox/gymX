import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { members } from './members';
import { gyms, users } from './platform';

/**
 * Phase 5 — Access control: entitlement engine, entry/exit, occupancy.
 *
 * Two append-only tables enforce audit completeness:
 *   1. access_events — every entry/exit attempt, decision, reason_code
 *   2. visits — derived nightly from access_events; dwell time calculated
 *
 * Money rule (as everywhere): reason_code is machine-readable (member_inactive,
 * no_active_subscription, outside_access_window, payment_overdue), so a UI
 * can render it in the user's locale without another round trip.
 */

// ---------------------------------------------------------------------------
// Access events (append-only audit trail)
// ---------------------------------------------------------------------------

export const accessDirectionEnum = pgEnum('access_direction', ['in', 'out']);

export const accessResultEnum = pgEnum('access_result', ['granted', 'denied']);

/**
 * Machine-readable reason codes that eval() returns. Used to render
 * human-readable messages in the member's language without a DB call.
 */
export const accessReasonEnum = pgEnum('access_reason', [
  'granted',
  'member_inactive',
  'no_active_subscription',
  'outside_access_window',
  'payment_overdue',
  'module_hook_deny',
]);

export const accessMethodEnum = pgEnum('access_method', ['nfc', 'qr', 'manual', 'api']);

export const accessEvents = pgTable(
  'access_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull().references(() => members.id),
    enteredAt: timestamp('entered_at', { withTimezone: true }).notNull(),
    direction: accessDirectionEnum('direction').notNull(),
    method: accessMethodEnum('method').notNull(),
    area: text('area').notNull(), // 'gym', 'pool', 'classes', etc.
    result: accessResultEnum('result').notNull(),
    reasonCode: accessReasonEnum('reason_code').notNull(),
    overriddenBy: uuid('overridden_by').references(() => users.id),
    overrideReason: text('override_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('access_events_gym_idx').on(t.gymId),
    index('access_events_member_idx').on(t.gymId, t.memberId),
    index('access_events_entered_idx').on(t.gymId, t.enteredAt),
    index('access_events_result_idx').on(t.gymId, t.result),
  ],
);

// ---------------------------------------------------------------------------
// Visits (derived from access_events, built nightly)
// ---------------------------------------------------------------------------

/**
 * Calculated every night from access_events: pairs of (in, out) to derive
 * occupancy and dwell time. A dangling 'in' from yesterday is force-closed
 * by a scheduled job to prevent a stuck count.
 *
 * This table is NOT append-only — rows are inserted nightly and may be updated
 * if the visit is still open or a dangling close is needed.
 */
export const visits = pgTable(
  'visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').notNull().references(() => members.id),
    enteredAt: timestamp('entered_at', { withTimezone: true }).notNull(),
    exitedAt: timestamp('exited_at', { withTimezone: true }),
    dwellMinutes: bigint('dwell_minutes', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('visits_gym_idx').on(t.gymId),
    index('visits_member_idx').on(t.gymId, t.memberId),
    index('visits_entered_idx').on(t.gymId, t.enteredAt),
  ],
);
