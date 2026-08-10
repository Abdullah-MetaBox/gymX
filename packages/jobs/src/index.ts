import './definitions/heartbeat';

export * from './logger';
export * from './registry';

/**
 * Named batches, mirrored by the schedules in .github/workflows/cron.yml.
 *
 * One HTTP call runs a whole batch, which keeps the number of scheduled
 * triggers small and the ordering explicit — Phase 4's payment-standing refresh
 * has to run after Phase 3's invoicing, and a list makes that visible instead
 * of implicit in eight separate cron expressions.
 */
export const JOB_BATCHES: Record<string, string[]> = {
  /** 02:00 Indian/Mauritius. Order matters once Phases 3-6 land. */
  nightly: ['heartbeat'],
  /** Frequent, short work. Phase 6's notification drain goes here. */
  frequent: [],
};
