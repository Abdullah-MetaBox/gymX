import type { Role } from './policy';

/**
 * The authenticated caller, as every layer below the framework sees it.
 *
 * Defined in `@gymx/core` rather than in the Next.js app so the domain, the
 * worker and the future mobile API all agree on what "who is asking" means.
 */
export interface ActorContext {
  userId: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  /**
   * The gym whose data this actor is operating on. Null only for a platform
   * admin who has not yet called `assumeGym`.
   */
  gymId: string | null;
  /**
   * Set when a platform admin is acting inside a gym they do not belong to.
   * Carried into `audit_log` so "who looked at my members?" always has an answer.
   */
  assumedGymId?: string | null;
}

/** An actor guaranteed to have a gym context. */
export interface TenantActorContext extends ActorContext {
  gymId: string;
}

export function hasGymContext(actor: ActorContext): actor is TenantActorContext {
  return actor.gymId !== null;
}
