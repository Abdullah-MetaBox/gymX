import type { Logger } from './logger';

/**
 * The job registry.
 *
 * Jobs live in a package rather than in a long-running worker because the MVP
 * deploys to Vercel, where nothing runs between requests. The same definitions
 * are invoked two ways:
 *
 *   - `POST /api/jobs/run` in the admin app, called on a schedule by a GitHub
 *     Actions workflow (see .github/workflows/cron.yml)
 *   - `pnpm worker:run <name>` locally, for development and testing
 *
 * What this costs, stated plainly: there is no queue any more. A job that
 * throws is not retried with backoff — the next scheduled run is the retry.
 * Every job must therefore be **idempotent**: running it twice on the same day
 * must not invoice a member twice. That is a constraint on Phase 3 onwards, and
 * it is the single most important thing to remember about this file.
 *
 * Phase 0 ships one trivial job. The roadmap's jobs plug in here:
 *
 *   generate-invoices        nightly    Phase 3
 *   refresh-payment-standing nightly    Phase 4  (suspends access past grace)
 *   run-dunning              nightly    Phase 6
 *   expire-subscriptions     nightly    Phase 3
 *   resume-holds             nightly    Phase 3
 *   flag-at-risk             daily      Phase 6
 *   close-visits             nightly    Phase 5  (pairs entry/exit)
 *   send-notifications       frequent   Phase 6  (drains the queue)
 */

export interface JobContext {
  logger: Logger;
  /** When the run was triggered. Passed in rather than read, so runs are reproducible in tests. */
  now: Date;
}

export interface JobDefinition<TPayload = unknown> {
  name: string;
  description: string;
  /**
   * Cron expression, for documentation and for the GitHub Actions workflow to
   * mirror. Nothing reads it at runtime — the schedule lives in the workflow.
   */
  schedule?: string;
  /** The gym's zone matters: "nightly" means nightly in Mauritius, not in UTC. */
  timezone?: string;
  /**
   * True when the job may safely run more than once for the same period.
   * Without a queue there are no retries, so every scheduled job must be able
   * to say yes here before it ships.
   */
  idempotent: boolean;
  handler(payload: TPayload, context: JobContext): Promise<void>;
}

const jobs = new Map<string, JobDefinition<never>>();

export function registerJob<TPayload>(job: JobDefinition<TPayload>): void {
  if (jobs.has(job.name)) return; // Hot reload re-imports the module; not an error.
  jobs.set(job.name, job as JobDefinition<never>);
}

export function getJob(name: string): JobDefinition<never> | undefined {
  return jobs.get(name);
}

export function allJobs(): JobDefinition<never>[] {
  return [...jobs.values()];
}

export interface JobRunResult {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
}

/** Run one job by name, capturing the outcome rather than throwing. */
export async function runJob(name: string, context: JobContext): Promise<JobRunResult> {
  const job = getJob(name);
  if (!job) {
    return { name, ok: false, ms: 0, error: `Unknown job "${name}"` };
  }

  const startedAt = Date.now();
  try {
    await job.handler(undefined as never, {
      ...context,
      logger: context.logger.child({ job: name }),
    });
    return { name, ok: true, ms: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run several jobs in sequence, continuing past a failure.
 *
 * One HTTP call triggers the whole nightly batch. A job that fails must not
 * stop the ones after it — an invoicing hiccup should never also mean nobody's
 * membership expired that night.
 */
export async function runJobs(names: string[], context: JobContext): Promise<JobRunResult[]> {
  const results: JobRunResult[] = [];
  for (const name of names) {
    const result = await runJob(name, context);
    results.push(result);
    if (result.ok) {
      context.logger.info('job completed', { job: name, ms: result.ms });
    } else {
      context.logger.error('job failed', { job: name, ms: result.ms, error: result.error });
    }
  }
  return results;
}
