import { closeDb } from '@gymx/db';
import { allJobs, createLogger, JOB_BATCHES, runJobs } from '@gymx/jobs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '../../.env', quiet: true });

/**
 * Run a job, or a named batch, locally.
 *
 *   pnpm worker:run heartbeat
 *   pnpm worker:run nightly
 *
 * In production these are triggered by GitHub Actions calling
 * `POST /api/jobs/run` on the deployed app — there is no long-running worker,
 * because the MVP deploys to Vercel where nothing runs between requests. This
 * CLI exists so every later phase can be tested without waiting for 02:00 or
 * pushing a commit to trigger a workflow.
 */
async function main() {
  const logger = createLogger({ service: 'worker' });
  const target = process.argv[2];

  if (!target) {
    console.log('Usage: pnpm worker:run <job|batch>\n');
    console.log('Batches:');
    for (const [name, jobs] of Object.entries(JOB_BATCHES)) {
      console.log(`  ${name.padEnd(26)} ${jobs.join(', ') || '(empty)'}`);
    }
    console.log('\nJobs:');
    for (const job of allJobs()) {
      console.log(`  ${job.name.padEnd(26)} ${job.description}`);
      if (job.schedule) {
        console.log(`  ${''.padEnd(26)} ${job.schedule} (${job.timezone ?? 'UTC'})`);
      }
    }
    process.exit(1);
  }

  const names = JOB_BATCHES[target] ?? [target];

  try {
    const results = await runJobs(names, { logger, now: new Date() });
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      console.error(`\n✗ ${failed.length} of ${results.length} job(s) failed`);
      process.exit(1);
    }
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('job runner failed:', error);
  process.exit(1);
});
