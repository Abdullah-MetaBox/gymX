import type { Action, Subject } from '@gymx/core/auth';
import { assertCan } from '@gymx/core/auth';
import { isGymXError, ValidationError } from '@gymx/core/errors';
import type { TxDatabase } from '@gymx/db';
import { recordAudit, withPlatform, withTenant } from '@gymx/db';
import type { z } from 'zod';
import { type ActiveContext, requireActiveContext } from './session';

/**
 * The server-action pipeline.
 *
 * Every mutation goes through here, so the safety properties are structural
 * rather than remembered:
 *
 *   1. Zod parse            -> typed input, field-level errors
 *   2. Resolve the actor    -> 401 when absent
 *   3. Permission check     -> 403 from the matrix in @gymx/core/auth
 *   4. Open a tenant context-> RLS applies; one transaction for the whole handler
 *   5. Run the handler
 *   6. Write the audit row  -> in the SAME transaction as the change
 *   7. Return a typed result
 *
 * Step 6 sharing the transaction is the part that matters. An audit trail
 * written afterwards can be missing precisely the entries you most want — the
 * ones where the request died between the change and the log.
 *
 * Failures come back as data, not thrown, so forms can render field errors
 * without an error boundary swallowing the page.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; fieldErrors?: Record<string, string[]> };

export interface AuditSpec {
  entity: string;
  action: string;
  /** Derive the entity id from the handler's return value. */
  entityId?: (result: unknown) => string | null;
  /** Extra detail for the trail. Never include secrets — `diffOf` redacts hashes. */
  diff?: (input: unknown, result: unknown) => Record<string, unknown> | null;
  /**
   * Platform-scope actions only: which gym's trail the entry belongs in.
   * Without this a platform admin's change to a gym would be recorded with a
   * null gym_id and be invisible to the owner it affected.
   */
  gymId?: (input: unknown, result: unknown) => string | null;
}

export interface ActionOptions {
  permission: { action: Action; subject: Subject };
  /** Runs without a gym context, against the platform tables. */
  scope?: 'tenant' | 'platform';
  audit?: AuditSpec;
}

export interface ActionContext extends ActiveContext {
  db: TxDatabase;
}

/**
 * Define a server action.
 *
 * ```ts
 * export const updateGym = defineAction(
 *   updateGymSchema,
 *   { permission: { action: 'update', subject: 'gym' }, audit: { entity: 'gym', action: 'update' } },
 *   async (input, ctx) => { ... },
 * );
 * ```
 */
export function defineAction<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  options: ActionOptions,
  handler: (input: z.infer<TSchema>, context: ActionContext) => Promise<TResult>,
  // The parameter is `unknown` on purpose. A server action's input arrives over
  // the wire from a form; typing it as the schema's input would claim a
  // guarantee that does not exist before the Zod parse on the next line. The
  // parse is the boundary — the type should say so.
): (input: unknown) => Promise<ActionResult<TResult>> {
  return async (rawInput) => {
    try {
      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(
          'Invalid input',
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        );
      }
      const input = parsed.data as z.infer<TSchema>;

      const context = await requireActiveContext();
      assertCan(context.actor.role, options.permission.action, options.permission.subject);

      const scope = options.scope ?? 'tenant';

      if (scope === 'platform') {
        const data = await withPlatform(context.actor.userId, async (db) => {
          const result = await handler(input, { ...context, db });
          await writeAudit(db, options, context, input, result, null);
          return result;
        });
        return { ok: true, data };
      }

      const gymId = context.actor.gymId;
      if (!gymId) {
        return {
          ok: false,
          code: 'forbidden',
          error: 'Select a gym before making changes.',
        };
      }

      const data = await withTenant(
        {
          gymId,
          userId: context.actor.userId,
          role: context.actor.role,
        },
        async (db) => {
          const result = await handler(input, { ...context, db });
          await writeAudit(db, options, context, input, result, gymId);
          return result;
        },
      );

      return { ok: true, data };
    } catch (error) {
      return toActionResult(error);
    }
  };
}

async function writeAudit(
  db: TxDatabase,
  options: ActionOptions,
  context: ActiveContext,
  input: unknown,
  result: unknown,
  gymId: string | null,
): Promise<void> {
  if (!options.audit) return;

  await recordAudit(db, {
    gymId: options.audit.gymId?.(input, result) ?? gymId,
    userId: context.actor.userId,
    actorEmail: context.actor.email,
    assumedGymId: context.actor.assumedGymId ?? null,
    entity: options.audit.entity,
    entityId: options.audit.entityId?.(result) ?? extractId(result),
    action: options.audit.action,
    diff: options.audit.diff?.(input, result) ?? null,
  });
}

function extractId(result: unknown): string | null {
  if (result && typeof result === 'object' && 'id' in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return null;
}

function toActionResult<T>(error: unknown): ActionResult<T> {
  if (error instanceof ValidationError) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      fieldErrors: error.fieldErrors,
    };
  }
  if (isGymXError(error)) {
    return { ok: false, code: error.code, error: error.message };
  }

  // Unexpected failures are logged server-side and generalised for the client:
  // a Postgres error message can name tables and constraints.
  console.error('[action] unexpected failure', error);
  return { ok: false, code: 'internal', error: 'Something went wrong. Please try again.' };
}

/**
 * Read-side helper: run a query in the active gym's context.
 *
 * Pages use this rather than opening a context by hand, so a page cannot
 * accidentally query without one — the guard in @gymx/db would throw, but this
 * makes the correct path the shortest one.
 */
export async function queryInGym<T>(
  permission: { action: Action; subject: Subject },
  handler: (db: TxDatabase, context: ActiveContext) => Promise<T>,
): Promise<T> {
  const context = await requireActiveContext();
  assertCan(context.actor.role, permission.action, permission.subject);

  const gymId = context.actor.gymId;
  if (!gymId) throw new ValidationError('No gym selected');

  return withTenant(
    {
      gymId,
      userId: context.actor.userId,
      role: context.actor.role,
    },
    (db) => handler(db, context),
  );
}

/** Read-side helper for the platform console. */
export async function queryOnPlatform<T>(
  permission: { action: Action; subject: Subject },
  handler: (db: TxDatabase, context: ActiveContext) => Promise<T>,
): Promise<T> {
  const context = await requireActiveContext();
  assertCan(context.actor.role, permission.action, permission.subject);
  return withPlatform(context.actor.userId, (db) => handler(db, context));
}
