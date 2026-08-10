/**
 * Access control decision engine.
 *
 * Evaluates whether a member should be granted access to an area at a specific
 * time, returning a decision + machine-readable reason code that can be rendered
 * in the user's locale without another round trip.
 *
 * The decision pipeline:
 *   1. Member status check (not inactive/suspended)
 *   2. Active subscription or valid pass covering the area
 *   3. Plan access rules allow (area, weekday, time-in-tz)
 *   4. No invoice overdue beyond grace period
 *   5. Module hooks may downgrade, never upgrade
 *
 * All comparisons are done in the member's local timezone (passed explicitly).
 */

export type AccessReason =
  | 'granted'
  | 'member_inactive'
  | 'no_active_subscription'
  | 'outside_access_window'
  | 'payment_overdue'
  | 'module_hook_deny';

export interface AccessDecision {
  result: 'granted' | 'denied';
  reasonCode: AccessReason;
}

/**
 * Evaluate access decision for a member entering/exiting a gym area.
 *
 * @param subject Member to evaluate
 * @param area Area being accessed (e.g., 'gym', 'pool', 'classes')
 * @param at Instant of access attempt (UTC)
 * @param timeZone IANA timezone identifier (e.g., 'Indian/Mauritius')
 * @param context Subscription, invoice, and rule data (from the caller)
 * @returns Access decision with reason code
 */
export async function evaluate(
  subject: {
    memberId: string;
    status: 'active' | 'inactive' | 'suspended' | 'frozen';
  },
  area: string,
  at: Date,
  timeZone: string,
  context: {
    isActive: (now: Date) => boolean;
    isAllowedByPlanRules: (area: string, at: Date, tz: string) => boolean;
    isOverdue: (graceDays: number) => boolean;
    moduleCanAccess?: (decision: AccessDecision) => Promise<AccessDecision>;
  },
): Promise<AccessDecision> {
  // 1. Check member status
  if (subject.status === 'inactive' || subject.status === 'suspended') {
    return { result: 'denied', reasonCode: 'member_inactive' };
  }

  // 2. Check for active subscription
  if (!context.isActive(at)) {
    return { result: 'denied', reasonCode: 'no_active_subscription' };
  }

  // 3. Check plan access rules
  if (!context.isAllowedByPlanRules(area, at, timeZone)) {
    return { result: 'denied', reasonCode: 'outside_access_window' };
  }

  // 4. Check overdue standing
  // Standard grace is 1 day; caller can override via context
  if (context.isOverdue(1)) {
    return { result: 'denied', reasonCode: 'payment_overdue' };
  }

  // 5. Allow module hooks to downgrade
  let decision: AccessDecision = { result: 'granted', reasonCode: 'granted' };
  if (context.moduleCanAccess) {
    decision = await context.moduleCanAccess(decision);
  }

  return decision;
}
