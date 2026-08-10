import { auditLog } from './schema/platform';
import type { TxDatabase } from './tenant';

/**
 * The audit trail.
 *
 * Written by the server-action pipeline on every mutation, so "who changed
 * what" is a property of the plumbing rather than something each feature has
 * to remember. The table is append-only in Postgres — UPDATE and DELETE are
 * revoked from the application role — so the record cannot be rewritten by the
 * code that produced it.
 */

export interface AuditEntry {
  /** Null for platform-level actions such as creating a gym. */
  gymId?: string | null;
  userId?: string | null;
  /** Denormalised so the trail survives deletion of the user under a DPA request. */
  actorEmail?: string | null;
  /** Set when a platform admin was acting inside a gym via assumeGym(). */
  assumedGymId?: string | null;
  entity: string;
  entityId?: string | null;
  action: string;
  diff?: Record<string, unknown> | null;
}

export async function recordAudit(db: TxDatabase, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    gymId: entry.gymId ?? null,
    userId: entry.userId ?? null,
    actorEmail: entry.actorEmail ?? null,
    assumedGymId: entry.assumedGymId ?? null,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    action: entry.action,
    diff: entry.diff ?? null,
  });
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

/**
 * Field-level diff for the audit trail. Only changed fields are recorded —
 * a log that repeats every column on every edit is a log nobody reads.
 *
 * `redact` drops sensitive fields (password hashes) while still recording that
 * they changed, so a credential reset is visible without being reproducible.
 */
export function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  redact: readonly string[] = ['passwordHash', 'password_hash', 'password'],
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = before[key];
    const to = after[key];
    if (equivalent(from, to)) continue;

    changes[key] = redact.includes(key)
      ? { from: '[redacted]', to: '[redacted]' }
      : { from: serialise(from), to: serialise(to) };
  }

  return changes;
}

function equivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(serialise(a)) === JSON.stringify(serialise(b));
  }
  return false;
}

function serialise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialise(v)]),
    );
  }
  return value;
}
