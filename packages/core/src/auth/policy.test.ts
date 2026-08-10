import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../errors';
import {
  ACTIONS,
  APPEND_ONLY_SUBJECTS,
  assertCan,
  can,
  isPlatformRole,
  isRole,
  permissionsFor,
  ROLES,
  SUBJECTS,
  WRITE_ACTIONS,
} from './policy';

describe('structural guarantees', () => {
  it('the accountant holds NO write permission on ANY subject', () => {
    // The property that makes "read-only" true by construction: a mutation
    // added in a later phase is denied by default, not by remembering to check.
    for (const subject of SUBJECTS) {
      for (const action of WRITE_ACTIONS) {
        expect(
          can('accountant', action, subject),
          `accountant must not be able to ${action} ${subject}`,
        ).toBe(false);
      }
    }
  });

  it('append-only subjects are never updatable or deletable by a gym role', () => {
    // Postgres revokes UPDATE/DELETE from the app role as well. This keeps the
    // policy layer from offering something the database will refuse.
    for (const role of ['gym_manager', 'staff', 'accountant'] as const) {
      for (const subject of APPEND_ONLY_SUBJECTS) {
        expect(can(role, 'update', subject), `${role} must not update ${subject}`).toBe(false);
        expect(can(role, 'delete', subject), `${role} must not delete ${subject}`).toBe(false);
      }
    }
  });

  it('every role grants at least a read somewhere, so none is inert', () => {
    for (const role of ROLES) {
      expect(permissionsFor(role).size).toBeGreaterThan(0);
    }
  });
});

describe('platform admin', () => {
  it('can do everything once inside a gym', () => {
    for (const subject of SUBJECTS) {
      for (const action of ACTIONS) {
        expect(can('platform_admin', action, subject)).toBe(true);
      }
    }
  });

  it('is the only platform role', () => {
    expect(isPlatformRole('platform_admin')).toBe(true);
    expect(isPlatformRole('gym_manager')).toBe(false);
  });
});

describe('gym manager', () => {
  it('runs their gym', () => {
    expect(can('gym_manager', 'update', 'plan')).toBe(true);
    expect(can('gym_manager', 'create', 'user')).toBe(true);
    expect(can('gym_manager', 'read', 'financial_report')).toBe(true);
    expect(can('gym_manager', 'export', 'financial_report')).toBe(true);
  });

  it('cannot create or delete gyms — that is the platform"s job', () => {
    expect(can('gym_manager', 'create', 'gym')).toBe(false);
    expect(can('gym_manager', 'delete', 'gym')).toBe(false);
    expect(can('gym_manager', 'update', 'gym')).toBe(true);
  });

  it('cannot rewrite history', () => {
    expect(can('gym_manager', 'read', 'audit_log')).toBe(true);
    expect(can('gym_manager', 'update', 'audit_log')).toBe(false);
    expect(can('gym_manager', 'delete', 'payment')).toBe(false);
  });
});

describe('front-desk staff', () => {
  it('can run the day', () => {
    expect(can('staff', 'create', 'member')).toBe(true);
    expect(can('staff', 'create', 'access_event')).toBe(true);
    expect(can('staff', 'create', 'payment')).toBe(true);
    expect(can('staff', 'update', 'till_shift')).toBe(true);
  });

  it('cannot change pricing', () => {
    expect(can('staff', 'read', 'plan')).toBe(true);
    expect(can('staff', 'update', 'plan')).toBe(false);
    expect(can('staff', 'create', 'plan')).toBe(false);
  });

  it('cannot see revenue or VAT', () => {
    expect(can('staff', 'read', 'report')).toBe(true);
    expect(can('staff', 'read', 'financial_report')).toBe(false);
    expect(can('staff', 'export', 'financial_report')).toBe(false);
  });

  it('cannot delete a member', () => {
    expect(can('staff', 'delete', 'member')).toBe(false);
  });
});

describe('accountant', () => {
  it('can read and export the financial record', () => {
    expect(can('accountant', 'read', 'invoice')).toBe(true);
    expect(can('accountant', 'export', 'payment')).toBe(true);
    expect(can('accountant', 'read', 'financial_report')).toBe(true);
    expect(can('accountant', 'read', 'till_shift')).toBe(true);
    expect(can('accountant', 'read', 'audit_log')).toBe(true);
  });

  it('cannot touch members or take payments', () => {
    expect(can('accountant', 'update', 'member')).toBe(false);
    expect(can('accountant', 'create', 'payment')).toBe(false);
    expect(can('accountant', 'create', 'write_off')).toBe(false);
  });
});

describe('assertCan', () => {
  it('passes silently when permitted', () => {
    expect(() => assertCan('staff', 'create', 'member')).not.toThrow();
  });

  it('throws ForbiddenError when not', () => {
    expect(() => assertCan('accountant', 'create', 'payment')).toThrow(ForbiddenError);
  });
});

describe('isRole', () => {
  it('narrows known roles and rejects anything else', () => {
    expect(isRole('staff')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
