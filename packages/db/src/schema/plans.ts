import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
/** Translatable content column: { en: '...', fr: '...' }. Mirrors @gymx/i18n's I18nText. */
type I18nText = Partial<Record<string, string>>;
import { gyms } from './platform';

/**
 * Phase 2 — Plans, pricing tiers, and access rules.
 *
 * Money convention (same as everywhere): prices are bigint MINOR UNITS.
 * MUR has two decimal places, so Rs 1,800 is stored as 180000.
 * VAT rates are basis points: 15% = 1500 bp.
 *
 * The access rule shape mirrors the entitlement engine that Phase 5 evaluates:
 *   area × weekday-set × time-window → grant or deny
 * Building it here means Phase 5 has a real dataset to evaluate, not mock data.
 */

export const planTypeEnum = pgEnum('plan_type', ['contract', 'pass']);

export const planCategoryEnum = pgEnum('plan_category', [
  'solo',
  'couple',
  'family',
  'group',
  'student',
  'lunch',
  'full',
]);

export const billingIntervalEnum = pgEnum('billing_interval', [
  'monthly',
  'quarterly',
  'annual',
]);

export const pricingModelEnum = pgEnum('pricing_model', [
  'flat',
  'flat_by_size',
  'per_head_by_size',
]);

export const planAreaEnum = pgEnum('plan_area', ['gym', 'pool', 'classes']);

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),

    /** Gym-authored name, one value per locale. */
    nameI18n: jsonb('name_i18n').$type<I18nText>().notNull().default({}),
    descriptionI18n: jsonb('description_i18n').$type<I18nText>().notNull().default({}),

    type: planTypeEnum('type').notNull(),
    category: planCategoryEnum('category').notNull(),

    /** Only for contract plans. */
    billingInterval: billingIntervalEnum('billing_interval'),

    /**
     * Price in minor units (MUR cents). For size-based models this is the
     * solo price; tiers in plan_price_tiers override it for larger households.
     */
    basePriceCents: bigint('base_price_cents', { mode: 'number' }).notNull(),

    /** True when the base_price_cents figure already includes VAT. */
    vatInclusive: boolean('vat_inclusive').notNull().default(false),

    /** One-off joining fee in minor units. 0 = no joining fee. */
    joiningFeeCents: bigint('joining_fee_cents', { mode: 'number' }).notNull().default(0),

    /**
     * Minimum contract length in months. 0 = no minimum.
     * GymABC: 12.
     */
    minTermMonths: integer('min_term_months').notNull().default(0),

    /** Only for pass plans: how many calendar days the pass is valid. */
    passDurationDays: integer('pass_duration_days'),

    /**
     * flat            — one price, any household size
     * flat_by_size    — price_tiers define a per-size flat price (couple = Rs 1,800)
     * per_head_by_size — price_tiers define a per-head rate that scales with size
     */
    pricingModel: pricingModelEnum('pricing_model').notNull().default('flat'),

    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('plans_gym_id_idx').on(t.gymId),
    index('plans_gym_active_idx').on(t.gymId, t.active),
  ],
);

/**
 * Price override tiers for size-based pricing models.
 *
 * flat_by_size example (GymABC couple plan):
 *   size_from=2, size_to=2, price_cents=180000  → Rs 1,800 for exactly 2 members
 *
 * per_head_by_size example (Rs 1,000 solo, Rs 900 each for 2, Rs 800 each for 3+):
 *   size_from=1, size_to=1, price_cents=100000  (Rs 1,000 × 1)
 *   size_from=2, size_to=2, price_cents=90000   (Rs 900/head)
 *   size_from=3, size_to=null, price_cents=80000 (Rs 800/head, 3 or more)
 */
export const planPriceTiers = pgTable(
  'plan_price_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    /** Minimum household size this tier applies to. */
    sizeFrom: integer('size_from').notNull(),
    /** Maximum household size, or null for "this size and above". */
    sizeTo: integer('size_to'),
    /** Price in minor units. Meaning depends on pricingModel: total or per-head. */
    priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('plan_price_tiers_plan_id_idx').on(t.planId),
    index('plan_price_tiers_gym_id_idx').on(t.gymId),
  ],
);

/**
 * Access entitlement rules for a plan.
 *
 * One row = one area that the plan covers, optionally restricted by day-of-week
 * and time window. The entitlement engine (Phase 5) evaluates all matching rows
 * and grants access if any rule covers the requested area, time, and weekday.
 *
 * Weekdays are stored as a Postgres integer array: 0=Sunday … 6=Saturday.
 * A null weekdays column means "every day".
 * A null start_time / end_time means "all day".
 *
 * GymABC Lunch rule: area=gym, weekdays=[1,2,3,4,5,6], start=11:00, end=13:00
 * GymABC Full rule: two rows — area=gym (all day) + area=pool (all day)
 */
export const planAccessRules = pgTable(
  'plan_access_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    area: planAreaEnum('area').notNull(),
    /** Allowed weekdays (0=Sun … 6=Sat). Null = all days. */
    weekdays: integer('weekdays').array(),
    /** Wall-clock start in HH:MM. Null = from midnight. */
    startTime: text('start_time'),
    /** Wall-clock end in HH:MM. Null = to midnight. */
    endTime: text('end_time'),
  },
  (t) => [
    index('plan_access_rules_plan_id_idx').on(t.planId),
    index('plan_access_rules_gym_id_idx').on(t.gymId),
  ],
);
