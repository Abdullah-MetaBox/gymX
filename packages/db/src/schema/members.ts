import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { gyms, users } from './platform';

/**
 * Phase 1 — Members, households, documents, consents, guest passes, CSV import.
 *
 * Conventions (same as Phase 0):
 *   - Every tenant table carries gym_id NOT NULL, indexed, leading every
 *     composite index. RLS policies key off it.
 *   - Dates are stored as DATE (PostgreSQL date type), mapped to string
 *     (YYYY-MM-DD) by Drizzle. Time-zone evaluation happens at the query layer.
 *   - No float arithmetic anywhere near money. Phase 2 adds price_cents columns.
 */

export const memberStatusEnum = pgEnum('member_status', [
  'active',
  'inactive',
  'suspended',
  'frozen',
]);

export const genderEnum = pgEnum('gender', [
  'male',
  'female',
]);

export const documentKindEnum = pgEnum('document_kind', [
  'photo_id',
  'medical_certificate',
  'signed_consent',
  'other',
]);

export const consentKindEnum = pgEnum('consent_kind', [
  'marketing',
  'photography',
  'data_processing',
  'terms_and_conditions',
]);

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'done',
  'failed',
]);

export const importRowStatusEnum = pgEnum('import_row_status', [
  'ok',
  'error',
  'duplicate',
  'skipped',
]);

/**
 * A gym's member.
 *
 * `member_seq` is a per-gym counter. The display code is `M{seq:05d}`.
 * The unique constraint on (gym_id, member_seq) is the guard against a
 * concurrent-creation collision — the action increments inside the same
 * transaction, making collisions near-impossible in a gym setting.
 *
 * `nfc_uid` is globally unique across all tenants: one physical card should
 * work at exactly one gym. The door-hardware integration (Phase 5) looks up a
 * member by this UID and then evaluates the entitlement engine.
 *
 * Fingerprint biometrics are explicitly out of scope — the Mauritius Data
 * Protection Act 2017 requires express consent and a deletion right that a
 * gym access-control system cannot reliably honour.
 */
export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    memberSeq: integer('member_seq').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    dateOfBirth: date('date_of_birth'),
    gender: genderEnum('gender'),
    nic: text('nic'),
    address: text('address'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    photoKey: text('photo_key'),
    nfcUid: text('nfc_uid'),
    locale: text('locale').notNull().default('en'),
    status: memberStatusEnum('status').notNull().default('active'),
    medicalNote: text('medical_note'),
    joinedAt: date('joined_at').notNull().default(sql`CURRENT_DATE`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('members_gym_seq_key').on(t.gymId, t.memberSeq),
    uniqueIndex('members_nfc_uid_key').on(t.nfcUid),
    index('members_gym_id_idx').on(t.gymId),
    index('members_gym_status_idx').on(t.gymId, t.status),
    index('members_name_idx').on(t.gymId, t.lastName, t.firstName),
  ],
);

export const memberDocuments = pgTable(
  'member_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    label: text('label'),
    fileKey: text('file_key').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: date('expires_at'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('member_documents_gym_id_idx').on(t.gymId),
    index('member_documents_member_id_idx').on(t.memberId),
  ],
);

export const households = pgTable(
  'households',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    payerMemberId: uuid('payer_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('households_gym_id_idx').on(t.gymId)],
);

export const householdMembers = pgTable(
  'household_members',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    /** primary | spouse | child | other */
    relationship: text('relationship').notNull().default('other'),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.memberId] }),
    index('household_members_member_id_idx').on(t.memberId),
  ],
);

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    kind: consentKindEnum('kind').notNull(),
    granted: boolean('granted').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  },
  (t) => [
    index('consents_gym_id_idx').on(t.gymId),
    index('consents_member_id_idx').on(t.memberId),
  ],
);

export const guestPasses = pgTable(
  'guest_passes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    guestName: text('guest_name').notNull(),
    guestPhone: text('guest_phone'),
    hostMemberId: uuid('host_member_id').references(() => members.id, { onDelete: 'set null' }),
    validOn: date('valid_on').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    issuedBy: uuid('issued_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('guest_passes_gym_id_valid_on_idx').on(t.gymId, t.validOn),
    index('guest_passes_host_member_id_idx').on(t.hostMemberId),
  ],
);

export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fileKey: text('file_key').notNull(),
    mapping: jsonb('mapping').$type<Record<string, string>>().notNull().default({}),
    dryRun: boolean('dry_run').notNull().default(false),
    status: importStatusEnum('status').notNull().default('pending'),
    totalRows: integer('total_rows'),
    okRows: integer('ok_rows'),
    errorRows: integer('error_rows'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('import_jobs_gym_id_idx').on(t.gymId)],
);

export const importRows = pgTable(
  'import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id')
      .notNull()
      .references(() => gyms.id, { onDelete: 'cascade' }),
    importJobId: uuid('import_job_id')
      .notNull()
      .references(() => importJobs.id, { onDelete: 'cascade' }),
    rowNo: integer('row_no').notNull(),
    raw: jsonb('raw').$type<Record<string, string>>().notNull(),
    status: importRowStatusEnum('status').notNull(),
    errors: jsonb('errors').$type<string[]>(),
    entityId: uuid('entity_id'),
  },
  (t) => [
    index('import_rows_job_id_idx').on(t.importJobId),
    index('import_rows_gym_id_idx').on(t.gymId),
  ],
);

/** Display code for a member. E.g. seq=42 → "M00042". */
export function formatMemberCode(seq: number): string {
  return `M${String(seq).padStart(5, '0')}`;
}
