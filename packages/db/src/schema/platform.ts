import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Platform tables — Phase 0.
 *
 * Conventions enforced here and inherited by every later phase:
 *
 *   - Tenant-scoped tables carry `gym_id uuid NOT NULL`, indexed, and leading
 *     every composite index. Row-level security policies key off it.
 *   - Instants are `timestamptz`. Wall-clock rules are evaluated against the
 *     gym's own timezone by `@gymx/core/time`, never the server's.
 *   - Money is `bigint` minor units. Rates are integer basis points, so no
 *     float ever participates in a figure that reaches a VAT return.
 *   - Append-only tables are marked in APPEND_ONLY_TABLES below and have
 *     UPDATE/DELETE revoked from the application role in sql/rls.sql.
 */

export const roleEnum = pgEnum('role', ['platform_admin', 'gym_manager', 'staff', 'accountant']);

export const userStatusEnum = pgEnum('user_status', ['active', 'disabled']);

export const gymStatusEnum = pgEnum('gym_status', ['active', 'suspended', 'archived']);

export interface GymBranding {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
}

export const gyms = pgTable(
  'gyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** Business Registration Number (Mauritius). */
    brn: text('brn'),
    vatNumber: text('vat_number'),

    /** IANA zone. Every access rule and billing date is evaluated in this zone. */
    timezone: text('timezone').notNull().default('Indian/Mauritius'),
    currency: text('currency').notNull().default('MUR'),
    /**
     * VAT rate in basis points — 1500 = 15.00%. An integer, because a rate that
     * multiplies money must not introduce a float into the ledger.
     */
    vatRateBp: integer('vat_rate_bp').notNull().default(1500),

    locales: text('locales').array().notNull().default(sql`ARRAY['en']::text[]`),
    defaultLocale: text('default_locale').notNull().default('en'),

    /** Minimum contract length the gym enforces. GymABC: 12. */
    minContractMonths: integer('min_contract_months').notNull().default(0),
    /** Days past due before access is cut. Dimitri asked for "the next day at latest". */
    overdueGraceDays: integer('overdue_grace_days').notNull().default(1),
    /** Days without a visit before a member is flagged at risk. */
    atRiskDays: integer('at_risk_days').notNull().default(21),
    /** MRA expects a gapless sequence per VAT-registered entity. Format confirmed in Phase 3. */
    invoiceNumberFormat: text('invoice_number_format').notNull().default('INV-{YYYY}-{SEQ:5}'),

    branding: jsonb('branding').$type<GymBranding>().notNull().default({}),
    enabledModules: text('enabled_modules').array().notNull().default(sql`ARRAY[]::text[]`),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),

    status: gymStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('gyms_slug_key').on(table.slug)],
);

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('locations_gym_id_idx').on(table.gymId)],
);

/**
 * Global identity. Deliberately NOT tenant-scoped.
 *
 * A person is one account. Which gyms they may touch, and as what, lives in
 * `user_roles`. That separation is what lets a login resolve memberships
 * before any tenant context exists — and it means an accountant serving two
 * gyms has one password, not two.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Always stored lowercased — normalise at the boundary with
     * `normaliseEmail()` rather than relying on a `lower(email)` expression
     * index, which cannot be used as an ON CONFLICT target.
     */
    email: text('email').notNull(),
    name: text('name').notNull(),
    /** argon2id. Null for accounts that only ever sign in by magic link (Phase 6). */
    passwordHash: text('password_hash'),
    locale: text('locale').notNull().default('en'),
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_key').on(table.email)],
);

/** Emails are stored and compared lowercased. Normalise at every boundary. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Metabox staff. A separate table rather than a `role` value with a null gym,
 * so "platform admin" cannot be expressed as a malformed tenant membership —
 * and so `user_roles.gym_id` can stay NOT NULL, which every RLS policy relies on.
 */
export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A user's role within one gym. One row per (user, gym). */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_roles_user_gym_key').on(table.userId, table.gymId),
    index('user_roles_gym_id_idx').on(table.gymId),
    index('user_roles_user_id_idx').on(table.userId),
  ],
);

/**
 * Who changed what. APPEND ONLY — UPDATE and DELETE are revoked from the
 * application role in sql/rls.sql.
 *
 * `gym_id` is nullable so platform-level actions (creating a gym) are recorded
 * too. `actorEmail` is denormalised on purpose: the trail must still read
 * correctly after the user row is deleted under a data-protection request.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').references(() => gyms.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    /** Set when a platform admin was acting inside a gym via assumeGym(). */
    assumedGymId: uuid('assumed_gym_id').references(() => gyms.id, { onDelete: 'set null' }),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    action: text('action').notNull(),
    diff: jsonb('diff').$type<Record<string, unknown>>(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_gym_id_at_idx').on(table.gymId, table.at),
    index('audit_log_entity_idx').on(table.entity, table.entityId),
  ],
);

/**
 * Tables that row-level security applies to, and the column it keys off.
 *
 * sql/rls.sql is generated to match this list. A new tenant-scoped table added
 * in a later phase must be registered here, and `rls.test.ts` fails if a table
 * carrying a `gym_id` column is missing from it.
 */
export const TENANT_TABLES = [
  'gyms',
  'locations',
  'user_roles',
  'audit_log',
  // Phase 1
  'members',
  'member_documents',
  'households',
  'consents',
  'guest_passes',
  'import_jobs',
  'import_rows',
  // Phase 2
  'plans',
  'plan_price_tiers',
  'plan_access_rules',
  // Phase 3
  'subscriptions',
  'subscription_members',
  'subscription_holds',
  'invoices',
  'invoice_lines',
  // Phase 4
  'tills',
  'till_shifts',
  'payments',
  'payment_allocations',
  'credit_notes',
  'write_offs',
  // Phase 5
  'access_events',
  'visits',
] as const;

/** Tables whose rows are immutable once written. UPDATE/DELETE revoked from gymx_app. */
export const APPEND_ONLY_TABLES = ['audit_log', 'payments', 'credit_notes', 'access_events'] as const;
