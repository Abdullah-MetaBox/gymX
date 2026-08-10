# Deployment

MVP target: **Neon** (Postgres) + **Vercel** (app) + **Vercel Blob** (files) +
**GitHub Actions** (scheduled jobs).

---

## Read this before deploying

**Vercel's Hobby plan prohibits commercial use.** Their terms restrict the free
tier to non-commercial personal projects. Island Breeze is a paid engagement, so
the free deployment is for building and demos; the client's live system needs a
paid plan. This is a contractual risk, not a technical one — the deployment
config below is identical on either tier, so upgrading is a billing change, not
a migration. Raise it with the client as a line item before go-live.

**Neon's free tier autosuspends after ~5 minutes idle.** The first request after
a quiet period pays a cold start. Acceptable for a demo. Not acceptable for
Phase 5's front-desk check-in, where a member is standing at the door — budget
for a paid Neon plan by then, or accept the first scan of the morning being slow.

---

## Neon

### 1. Create the project

One project, one database named `gymx`. Note the region — see the colocation
note below before choosing.

### 2. Two connection strings, and they are not interchangeable

Neon gives every branch a direct host and a pooled host, differing by one
substring:

```
direct  ep-xxx-123456.eu-central-1.aws.neon.tech          → DATABASE_URL
pooled  ep-xxx-123456-pooler.eu-central-1.aws.neon.tech   → APP_DATABASE_URL
```

- **`DATABASE_URL`** — direct, owner role. Migrations and seeds only. Migrations
  take advisory locks and issue DDL, neither of which survives a transaction-mode
  pooler. `pnpm db:bootstrap` refuses to run if this is the pooled host.
- **`APP_DATABASE_URL`** — pooled, `gymx_app` role. Everything the app and the
  jobs do. Serverless functions open far more connections than a database wants
  to see, which is what the pooler is for.

The driver sets `prepare: false` automatically on a `-pooler.` host. PgBouncer
in transaction mode does not keep prepared statements across queries, and the
symptom of getting this wrong is an intermittent "prepared statement does not
exist" under load rather than a clean failure.

Our tenant context uses `set_config(..., true)` — `SET LOCAL` — which is scoped
to a transaction and therefore safe under transaction pooling. Session-level
`SET` would have been silently broken here.

### 3. Create `gymx_app` with the script, never in the Neon console

```bash
pnpm db:bootstrap
```

**Roles created through the Neon console or API are granted `neon_superuser`,
which carries `BYPASSRLS`.** Such a role would defeat every policy in
`packages/db/sql/rls.sql` — the tenancy model would appear to work while
enforcing nothing, with no error anywhere.

`pnpm db:bootstrap` creates the role in plain SQL and then verifies it is not a
superuser, does not have `BYPASSRLS`, inherits no superuser role, and owns no
tables. It exits non-zero if any of those is false. Do not work around it.

### 4. Migrate and seed

```bash
pnpm db:migrate    # schema + RLS policies (idempotent)
pnpm db:seed       # two gyms, five users, one platform admin
```

### 5. A separate branch for CI

CI resets, migrates, seeds and writes probe rows. Pointed at the branch you
develop against, a push will rewrite your data mid-session. Create a `ci` branch
in Neon and set these repository secrets:

| Secret | Value |
|---|---|
| `NEON_CI_DATABASE_URL` | direct endpoint, owner role, `ci` branch |
| `NEON_CI_APP_DATABASE_URL` | pooled endpoint, `gymx_app` role, `ci` branch |
| `NEON_CI_APP_DB_PASSWORD` | the `gymx_app` password on that branch |

---

## Vercel

### Project settings

| Setting | Value |
|---|---|
| Root Directory | `apps/admin` |
| Framework | Next.js (auto-detected) |
| Install Command | default (Vercel detects the pnpm workspace) |
| Function Region | **match the Neon region** |

**Colocation is not a micro-optimisation here.** A page renders several
sequential queries. A function in Washington talking to a database in Frankfurt
pays a transatlantic round trip on each one, and the page takes a second longer
than it should for no visible reason.

### Environment variables

Set in Vercel project settings for Production and Preview:

```
DATABASE_URL            direct Neon endpoint, owner
APP_DATABASE_URL        pooled Neon endpoint, gymx_app
APP_DB_PASSWORD         gymx_app password
AUTH_SECRET             openssl rand -base64 32
AUTH_URL                https://<your-deployment>.vercel.app
BLOB_READ_WRITE_TOKEN   from the Vercel Blob store
CRON_SECRET             openssl rand -hex 32
NODE_ENV                production
```

`AUTH_URL` must match the deployment origin, or the sign-in redirect lands on
the wrong host.

### The native-binary trap

Password hashing uses `@node-rs/argon2`, which ships platform-specific binaries.
Developing on Windows and deploying to Linux, a lockfile recording only the
win32 build produces a Vercel install with no usable binding — and it fails at
**runtime on first sign-in**, not at build time.

`pnpm.supportedArchitectures` in the root `package.json` forces the lockfile to
carry win32, darwin and linux builds. If you ever see sign-in failing on a
deployment that built cleanly, check that first.

---

## Vercel Blob

Create a Blob store and copy its read/write token into `BLOB_READ_WRITE_TOKEN`.

Used from Phase 1 for member photos, student proof, PAR-Q forms and contracts.

**Blob objects are public to anyone holding the URL.** Member photos, NIC
numbers and medical documents must never have their Blob URL handed to a
browser. `packages/storage` keeps the URL internal; Phase 1 serves these through
an authenticated route that resolves the member in a tenant context first.

---

## Scheduled jobs

There is **no long-running worker**. Vercel runs nothing between requests.

`.github/workflows/cron.yml` calls `POST /api/jobs/run?target=<batch>` on a
schedule, authenticated with `CRON_SECRET` compared in constant time. Repository
secrets needed:

| Secret | Value |
|---|---|
| `APP_URL` | `https://<your-deployment>.vercel.app` |
| `CRON_SECRET` | same value as the Vercel env var |

GitHub Actions rather than Vercel Cron because Hobby allows two crons at
once-daily granularity, and the roadmap has eight jobs, one of them frequent.
It also keeps the schedule identical across Hobby, Pro and any future host.

### What this costs, and it matters from Phase 3

**There is no queue, so there are no retries with backoff.** The next scheduled
run is the retry. Every job must be **idempotent** — running `generate-invoices`
twice on the same night must not invoice a member twice. `JobDefinition` has a
required `idempotent` flag to force the question at the point a job is written,
not after a member is double-charged.

GitHub's scheduler is best-effort and can lag under load. No handler should
assume it ran at an exact minute; each derives its period from the gym's
timezone.

Run a batch by hand from the Actions tab (`workflow_dispatch`), or locally:

```bash
pnpm worker:run heartbeat
pnpm worker:run nightly
```

---

## Verifying a deployment

```bash
curl -sS https://<deployment>/api/jobs/run \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Returns the registered jobs and batches. Without the header it returns 404, not
401 — an unauthenticated caller learns nothing about whether the endpoint exists.

Then sign in as a seeded account and confirm the four roles still resolve
correctly (see the table in `README.md`).
