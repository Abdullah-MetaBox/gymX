# GymX

Multi-tenant gym management platform for Mauritius.

**Status: Phase 0 complete** — tenancy, authentication, roles, audit trail,
module seam and scheduled jobs. No gym features yet; those start in Phase 1. See
[`docs/roadmap.md`](docs/roadmap.md).

**Stack:** Next.js 15 · Neon (Postgres) · Vercel · Vercel Blob · GitHub Actions
for scheduled jobs.

## Getting started

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env      # fill in the Neon URLs, then generate the secrets:
                          #   openssl rand -base64 32   → AUTH_SECRET
                          #   openssl rand -hex 32      → CRON_SECRET
pnpm db:bootstrap         # creates the gymx_app role and verifies it safely
pnpm db:migrate           # schema + row-level security policies
pnpm db:seed              # two gyms, five users, one platform admin
pnpm dev                  # http://localhost:3000
```

`.env` needs **two** Neon connection strings, and they are not interchangeable —
the **direct** endpoint for `DATABASE_URL` (migrations) and the **pooled** one
for `APP_DATABASE_URL` (the app). [`docs/deployment.md`](docs/deployment.md)
explains why, along with the Neon console trap that would silently disable
row-level security.

Sign in with any seeded account — password `GymX!dev2026`:

| Account | Role |
|---|---|
| `admin@metabox.mu` | Platform admin |
| `manager@gymabc.mu` | Gym manager |
| `desk@gymabc.mu` | Staff / front desk |
| `accounts@gymabc.mu` | Accountant (read-only) |

A second gym, Northside Fitness, exists so tenant isolation is testable against
real data rather than an empty table.

## Verify

```bash
pnpm test        # 101 tests; needs a migrated + seeded database
pnpm typecheck
pnpm lint
pnpm build
```

The suite runs deliberately in `America/New_York` — a timezone-sensitive test
that ran in the gym's own zone would pass while proving nothing. The tenancy
tests connect as `gymx_app` rather than the database owner, for the same reason:
Postgres exempts a table's owner from row-level security.

## Scheduled jobs

There is no resident worker — Vercel runs nothing between requests. Jobs are
triggered by GitHub Actions calling an authenticated endpoint. Run them locally:

```bash
pnpm worker:run             # list jobs and batches
pnpm worker:run heartbeat
pnpm worker:run nightly
```

## Documentation

- [`docs/conventions.md`](docs/conventions.md) — the rules that matter. Read first.
- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit
- [`docs/deployment.md`](docs/deployment.md) — Neon, Vercel, Blob, cron, and their traps
- [`docs/product-map.md`](docs/product-map.md) — the full feature surface
- [`docs/roadmap.md`](docs/roadmap.md) — phases and open questions
