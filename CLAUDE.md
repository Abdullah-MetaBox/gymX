# GymX

Multi-tenant gym management platform for Mauritius. Built by Metabox; pilot
tenant is Gym ABC (Island Breeze). Currently **Phase 0 complete** — foundations
only, no gym features yet. See `docs/roadmap.md`.

**Stack:** Next.js 15 · Neon (Postgres) · Vercel · Vercel Blob · GitHub Actions
for scheduled jobs.

## Commands

```bash
pnpm install
pnpm db:bootstrap        # once: creates and SAFETY-CHECKS the gymx_app role
pnpm db:migrate          # Drizzle migrations, then sql/rls.sql (idempotent)
pnpm db:seed             # two gyms, five users, one platform admin
pnpm dev                 # admin app on :3000
pnpm worker:run <target> # run a job or batch locally, e.g. heartbeat, nightly
pnpm test                # vitest (needs a migrated + seeded database)
pnpm typecheck
pnpm lint                # biome
pnpm db:reset            # drop and recreate the schema (dev only)
```

Seeded dev password for every account: `GymX!dev2026`
(`admin@metabox.test`, `manager@gymabc.test`, `desk@gymabc.test`,
`accounts@gymabc.test`, `manager@northside.test`, `desk@northside.test`).

## Read before writing code

**`docs/conventions.md`** — the eight non-negotiable rules. Breaking any of them
produces a bug that is effectively unfixable once features sit on top.

The short version:

1. **Money is integer cents.** Use `Money` from `@gymx/core`. Never float
   arithmetic on prices. Rates are integer basis points. Split with
   `Money.allocate` (largest remainder), never by dividing and rounding.
2. **Time is UTC; rules are local.** Every time-comparison helper takes an
   explicit timezone. Never read the ambient system zone.
3. **Tenant data goes through `withTenant`.** The app connects as `gymx_app`,
   which owns nothing and is `NOBYPASSRLS`. `DATABASE_URL` (owner, **direct**
   Neon endpoint) is for migrations and seeds only — RLS does not apply to a
   table's owner. `APP_DATABASE_URL` is the **pooled** endpoint.
   Never create `gymx_app` through the Neon console: console-created roles
   inherit `neon_superuser`, which has `BYPASSRLS`.
4. **New tenant-scoped table?** Add `gym_id uuid NOT NULL`, write its policy in
   `packages/db/sql/rls.sql`, and add its schema file to `drizzle.config.ts`.
   `tenant.test.ts` fails if a table with a `gym_id` has no policy.
5. **Authorisation is data.** Add permissions to the matrix in
   `packages/core/src/auth/policy.ts`. Never `if (role === ...)` in a route.
6. **Mutations use `defineAction`.** Parse → authorise → `withTenant` → run →
   audit, all in one transaction.
7. **Pages use `requirePageAccess`**, not `assertCan` — a denied page must be a
   404, not a 500.
8. **Scheduled jobs must be idempotent.** There is no queue and no retry — the
   next run is the retry. `JobDefinition.idempotent` is required; if you cannot
   honestly set it `true`, the job needs a guard before it ships.
9. **Relative imports carry no file extension.** Next's webpack does not resolve
   `.js` → `.tsx`.

## Layout

```
apps/admin       Next.js 15 App Router — deployed to Vercel
apps/worker      Local CLI for running jobs by hand (not deployed)
packages/core    Money, Time, permission matrix — no framework imports
packages/db      Drizzle schema, migrations, RLS, tenant contexts
packages/i18n    Locales, message catalogues, translatable-content helpers
packages/jobs    Scheduled job definitions + registry
packages/modules Module registry + gym-abc
packages/storage File storage adapter (Vercel Blob)
docs/            product-map, roadmap, architecture, conventions, deployment
```

## Environment

One `.env` at the repo root, shared by the app, the job CLI and the db scripts.
Dev and CI both run against Neon; CI uses a dedicated `ci` branch so a push
cannot rewrite your development data. See `docs/deployment.md`.

## The thing this product exists to fix

A VAT period at the client's gym showed **200 payments in the gateway, 400 in
the system, 600 actually taken**. Three systems each held a partial truth and
never reconciled. When designing anything that touches money or access, that is
the failure to design against — see the invariants in `docs/roadmap.md`.
