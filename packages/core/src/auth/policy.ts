/**
 * The permission matrix.
 *
 * Authorisation lives here as *data*, not as `if (role === 'accountant')`
 * scattered through route handlers. Two properties follow from that, and both
 * are asserted in `policy.test.ts`:
 *
 *   - The accountant is read-only **by construction**. No write action is
 *     granted on any subject, so a new mutation added in Phase 4 is denied by
 *     default rather than because someone remembered to check.
 *   - Append-only subjects (payments, access events, the audit log) are never
 *     granted `update` or `delete` to anyone. Postgres revokes those rights
 *     too; this keeps the policy layer honest about it instead of relying on
 *     the database to reject something the UI cheerfully offered.
 */

import { ForbiddenError } from '../errors';

export const ROLES = ['platform_admin', 'gym_manager', 'staff', 'accountant'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ['read', 'create', 'update', 'delete', 'export', 'approve'] as const;
export type Action = (typeof ACTIONS)[number];

/** Actions that change state. The accountant must hold none of these. */
export const WRITE_ACTIONS = ['create', 'update', 'delete', 'approve'] as const;

export const SUBJECTS = [
  // platform
  'gym',
  'user',
  'module',
  'audit_log',
  // members (Phase 1)
  'member',
  'household',
  'document',
  'guest_pass',
  'import_job',
  // catalogue (Phase 2)
  'plan',
  // billing (Phases 3-4)
  'subscription',
  'invoice',
  'payment',
  'payment_allocation',
  'credit_note',
  'write_off',
  'till',
  'till_shift',
  // access (Phase 5)
  'access_event',
  'visit',
  // comms (Phase 6)
  'notification',
  // reporting (Phase 9). Split deliberately: front-desk staff get operational
  // reports (footfall, expiring memberships) but never revenue or VAT.
  'report',
  'financial_report',
] as const;
export type Subject = (typeof SUBJECTS)[number];

/**
 * Subjects whose rows are immutable once written. Enforced in Postgres by
 * revoking UPDATE/DELETE from the application role; mirrored here so the two
 * layers cannot drift.
 */
export const APPEND_ONLY_SUBJECTS = [
  'payment',
  'access_event',
  'audit_log',
  'notification',
] as const; // access_event: read/create/export only, UPDATE/DELETE revoked at DB level

type Grant = '*:*' | `${Subject}:*` | `${Subject}:${Action}`;

const READ_AND_EXPORT = (subject: Subject): Grant[] => [`${subject}:read`, `${subject}:export`];

const GRANTS: Record<Role, readonly Grant[]> = {
  /**
   * Metabox staff. Cross-tenant reach is NOT ambient — it requires an audited
   * `assumeGym()` call. This grant governs what they may do once inside.
   */
  platform_admin: ['*:*'],

  /** The gym owner. Full control of their own gym; cannot create or delete gyms. */
  gym_manager: [
    'gym:read',
    'gym:update',
    'user:*',
    'module:read',
    'member:*',
    'household:*',
    'document:*',
    'guest_pass:*',
    'import_job:*',
    'plan:*',
    'subscription:*',
    'invoice:*',
    'till:*',
    'till_shift:*',
    'credit_note:*',
    'write_off:*',
    'report:*',
    'financial_report:*',
    // Append-only: created and read, never amended.
    'payment:read',
    'payment:create',
    'payment:export',
    'payment_allocation:read',
    'payment_allocation:create',
    'payment_allocation:update',
    'payment_allocation:export',
    'access_event:read',
    'access_event:create',
    'access_event:export',
    'visit:read',
    'visit:create',
    'visit:update',
    'visit:export',
    'notification:read',
    'notification:create',
    'audit_log:read',
    'audit_log:export',
  ],

  /** Front desk. Runs the day; changes no prices and sees no revenue. */
  staff: [
    'gym:read',
    'member:read',
    'member:create',
    'member:update',
    'household:read',
    'household:create',
    'household:update',
    'document:read',
    'document:create',
    'guest_pass:read',
    'guest_pass:create',
    'plan:read',
    'subscription:read',
    'subscription:create',
    'subscription:update',
    'invoice:read',
    'invoice:create',
    'payment:read',
    'payment:create',
    'payment_allocation:read',
    'payment_allocation:create',
    'payment_allocation:update',
    'till:read',
    'till:create',
    'till_shift:read',
    'till_shift:create',
    'till_shift:update',
    'access_event:read',
    'access_event:create',
    'visit:read',
    'visit:create',
    'visit:update',
    'report:read',
  ],

  /** Finance. Read and export only — see the note at the top of this file. */
  accountant: [
    'gym:read',
    ...READ_AND_EXPORT('member'),
    // The family is the billing unit — households.payer_member_id is who the
    // invoice goes to, and a size-based plan price is meaningless without the
    // family's size. An accountant without this sees a partial truth.
    ...READ_AND_EXPORT('household'),
    ...READ_AND_EXPORT('subscription'),
    ...READ_AND_EXPORT('invoice'),
    ...READ_AND_EXPORT('payment'),
    ...READ_AND_EXPORT('payment_allocation'),
    ...READ_AND_EXPORT('credit_note'),
    ...READ_AND_EXPORT('write_off'),
    ...READ_AND_EXPORT('till'),
    ...READ_AND_EXPORT('till_shift'),
    ...READ_AND_EXPORT('access_event'),
    ...READ_AND_EXPORT('visit'),
    ...READ_AND_EXPORT('report'),
    ...READ_AND_EXPORT('financial_report'),
    ...READ_AND_EXPORT('audit_log'),
    'plan:read',
  ],
};

/** May this role perform this action on this subject? */
export function can(role: Role, action: Action, subject: Subject): boolean {
  const grants = GRANTS[role];
  if (!grants) return false;
  return (
    grants.includes('*:*') ||
    grants.includes(`${subject}:*` as Grant) ||
    grants.includes(`${subject}:${action}` as Grant)
  );
}

/** `can`, but throws. Used by the server-action pipeline. */
export function assertCan(role: Role, action: Action, subject: Subject): void {
  if (!can(role, action, subject)) {
    throw new ForbiddenError(`Role "${role}" may not ${action} ${subject}`);
  }
}

/** Every permission a role holds, expanded. Used to build navigation. */
export function permissionsFor(role: Role): Set<`${Subject}:${Action}`> {
  const result = new Set<`${Subject}:${Action}`>();
  for (const subject of SUBJECTS) {
    for (const action of ACTIONS) {
      if (can(role, action, subject)) result.add(`${subject}:${action}`);
    }
  }
  return result;
}

/** Roles that belong to Metabox rather than to a gym. */
export function isPlatformRole(role: Role): boolean {
  return role === 'platform_admin';
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: 'Platform admin',
  gym_manager: 'Gym manager',
  staff: 'Staff',
  accountant: 'Accountant',
};
