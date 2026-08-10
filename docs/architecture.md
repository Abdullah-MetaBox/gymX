# Architecture

## Layout

```
apps/
  admin/      Next.js 15 App Router — the product, deployed to Vercel
  worker/     Local CLI for running jobs by hand (not deployed)
packages/
  core/       Framework-agnostic domain logic: Money, Time, the policy matrix
  db/         Drizzle schema, migrations, RLS, tenant contexts, seeds
  i18n/       Locale config, message catalogues, translatable-content helpers
  jobs/       Scheduled job definitions + registry
  modules/    Module registry + the gym-abc module
  storage/    File storage adapter (Vercel Blob)
docs/
```

## Deployment shape

Neon (Postgres) + Vercel (app) + Vercel Blob (files) + GitHub Actions
(scheduled jobs). See [`deployment.md`](deployment.md) for the setup, the
tier caveats, and the traps — of which the sharpest is that **Neon roles created
through the console inherit `neon_superuser` and therefore `BYPASSRLS`**, which
would silently void the entire tenancy model.

Serverless changes one thing structurally: **nothing runs between requests**, so
there is no resident worker and no queue. Scheduled work is an authenticated
HTTP call from GitHub Actions. The consequence that reaches into feature code is
that jobs get no automatic retries — the next run is the retry — so every job
must be idempotent. `JobDefinition` carries a required `idempotent` flag to
force that decision at the point a job is written.

## Why `packages/core` is separate

Every rule that matters — can this person enter, what does this family pay,
what is owed — lives in pure TypeScript with no framework imports. The admin
app calls it through server actions today. The member mobile app and the future
`/api/v1` layer will call the same functions. No business logic gets stranded
inside a React component.

## Request flow

```
browser
  │
  ├─ middleware.ts ......... cookie present? redirect if not. NOT the gate.
  │
  ├─ (dashboard)/layout .... getActiveContext() — resolves the actor against
  │                          the DB. THIS is the gate.
  │
  ├─ page .................. requirePageAccess(action, subject)
  │                          queryInGym(...) → withTenant → RLS applies
  │
  └─ server action ......... defineAction(schema, options, handler)
                             parse → authorise → withTenant → run → audit
```

The middleware only checks that a session cookie exists, because `@gymx/db`
cannot run on the edge runtime. Treating it as the security boundary would be
the classic mistake: a forged cookie gets past it, and gets nowhere afterwards.

## Two database roles

| Role | URL | Endpoint | Used by | RLS applies? |
|---|---|---|---|---|
| owner | `DATABASE_URL` | **direct** | migrations, bootstrap, seeds | **No** — Postgres exempts a table's owner |
| `gymx_app` | `APP_DATABASE_URL` | **pooled** | the admin app, job handlers | **Yes** — owns nothing, `NOBYPASSRLS` |

`pnpm db:bootstrap` creates `gymx_app` and asserts four things: not a superuser,
no `BYPASSRLS`, inherits no superuser role, owns no tables. It exits non-zero on
any of them. Without that separation, every policy in
`packages/db/sql/rls.sql` is decoration.

The endpoint split is not cosmetic. Migrations take advisory locks and issue
DDL, neither of which survives Neon's transaction-mode pooler; the app needs the
pooler because serverless functions open far more connections than a database
wants. The driver disables prepared statements automatically on a `-pooler.`
host, because PgBouncer in transaction mode does not carry them between queries.

## Sessions and gym selection

- **Identity** lives in a JWT (Auth.js v5, credentials provider). The token
  carries a user id and nothing else — no role, no gym.
- **Roles** are read from the database on every request, so revoking someone's
  access takes effect immediately rather than whenever their token expires.
- **The active gym** lives in the `gymx.gym` cookie, validated against that
  user's memberships server-side. A tampered cookie names a gym they hold no
  role in and is ignored.
- **A platform admin** entering a gym they have no role in calls `assumeGym()`,
  which writes an audit row before setting the cookie. Inside that gym they are
  scoped exactly as its own manager would be.

## The module seam

`packages/modules/registry.ts` exposes typed extension points. Core imports the
registry; core never imports a module. Modules are enabled per gym via
`gyms.enabled_modules`.

Access hooks may only **downgrade** a decision — the registry enforces it, so a
bug in a tenant-specific module cannot open a door core wanted shut.

`gym-abc` is deliberately thin. Almost everything the meeting notes called a
"customisation" turned out to be configuration; see the comment at the top of
`packages/modules/src/gym-abc/index.ts`.

## Jobs

Definitions live in `packages/jobs` and are invoked two ways:

- `POST /api/jobs/run?target=<batch>` in the admin app, called on a schedule by
  `.github/workflows/cron.yml` and authenticated with a shared secret compared
  in constant time.
- `pnpm worker:run <job|batch>` locally, for development and testing.

Job handlers reach application data through `withTenant` / `withPlatform` on the
`gymx_app` connection, so RLS applies to background work exactly as it does to a
request. A job that legitimately spans gyms borrows a platform admin's identity,
which `withPlatform` verifies against `platform_admins` inside the transaction —
a job cannot assert access nobody holds.

Batches are named lists in `JOB_BATCHES`, so one HTTP call runs the whole
nightly sequence and the ordering is explicit in one place rather than implicit
across eight cron expressions. A failing job does not stop the ones after it: an
invoicing hiccup should not also mean nobody's membership expired that night.

**No queue means no retries.** See the note under "Deployment shape".

## Known deviations from the Phase 0 plan

- **Neon + Vercel instead of a VPS with a resident worker.** The plan assumed a
  long-running `apps/worker` process running pg-boss. Vercel runs nothing
  between requests, so pg-boss and the queue are gone; `apps/worker` survives
  only as a local CLI. The trade is stated under "Jobs" above: no retries, so
  jobs must be idempotent.
- **Vercel Hobby prohibits commercial use.** The free deployment is for building
  and demos; the client's live system needs a paid plan. Tracked in
  `docs/deployment.md`.

- **Magic-link sign-in moved to Phase 6.** It needs an email transport, which is
  itself a Phase 6 deliverable; building it now would wire a provider to
  nothing. Phase 0 ships credentials only.
- **No `roles` lookup table.** Roles are a Postgres enum plus the matrix in
  `@gymx/core/auth`. The set is fixed in code, so a table would be a join that
  can drift from the code that actually decides.
- **`users` is not tenant-scoped.** A person is one account; which gyms they may
  touch lives in `user_roles`. This is what lets sign-in resolve memberships
  before a tenant context exists, and means an accountant serving two gyms has
  one password rather than two.
