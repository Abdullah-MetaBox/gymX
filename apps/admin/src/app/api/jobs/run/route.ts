import { timingSafeEqual } from 'node:crypto';
import { closeDb } from '@gymx/db';
import { allJobs, createLogger, JOB_BATCHES, runJobs } from '@gymx/jobs';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '../../../../lib/env';

/**
 * Scheduled job trigger.
 *
 *   POST /api/jobs/run?target=nightly
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Called by .github/workflows/cron.yml. The MVP deploys to Vercel, where
 * nothing runs between requests, so "scheduled work" is an authenticated HTTP
 * call from an external scheduler rather than a resident process.
 *
 * Auth is a shared secret compared in constant time. It is deliberately NOT the
 * normal session path: there is no signed-in user, and giving the scheduler a
 * user account would mean a credential with real permissions sitting in CI.
 */

export const runtime = 'nodejs';
// Jobs touch the database on every call; a cached response would be a job that
// silently stopped running.
export const dynamic = 'force-dynamic';
// Vercel Hobby caps this lower than the value asked for; it is honoured on Pro.
// Phase 3's invoicing run is the first job likely to need it.
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this endpoint exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const target = request.nextUrl.searchParams.get('target') ?? 'nightly';
  const names = JOB_BATCHES[target] ?? (allJobs().some((j) => j.name === target) ? [target] : null);

  if (!names) {
    return NextResponse.json(
      {
        error: `Unknown job or batch "${target}"`,
        batches: Object.keys(JOB_BATCHES),
        jobs: allJobs().map((job) => job.name),
      },
      { status: 400 },
    );
  }

  if (names.length === 0) {
    return NextResponse.json({ target, results: [], note: 'Batch is empty' });
  }

  const logger = createLogger({ service: 'cron', target });
  const startedAt = Date.now();

  const results = await runJobs(names, { logger, now: new Date() });
  await closeDb();

  const failed = results.filter((result) => !result.ok);

  // 500 when anything failed, so a red workflow run is the alert. Individual
  // results are still returned — a partial batch failure should be legible in
  // the Actions log without opening the application logs.
  return NextResponse.json(
    { target, ms: Date.now() - startedAt, results },
    { status: failed.length > 0 ? 500 : 200 },
  );
}

/** Liveness probe for the workflow, so a broken deploy fails loudly and early. */
export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    batches: JOB_BATCHES,
    jobs: allJobs().map((job) => ({
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      timezone: job.timezone,
      idempotent: job.idempotent,
    })),
  });
}
