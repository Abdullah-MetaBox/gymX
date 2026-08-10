# Conventions

Non-negotiable rules. Each exists because breaking it produces a bug that is
effectively unfixable once features are built on top of it.

---

## 1. Money is integer cents

Every monetary value is an integer number of **minor units**. `bigint` in
Postgres, `Cents` (a branded `number`) in TypeScript.

```ts
import { Money } from '@gymx/core';

const couple = Money.fromMajor(1800);        // 180_000 cents
const vat = Money.vatFromGross(couple, 15);  // { net, vat, gross }
```

- **Never** use `number` arithmetic on prices. `0.1 + 0.2 !== 0.3` is not an
  acceptable property for a system whose purpose is making a VAT declaration
  reconcile.
- Rates are **integer basis points**: `gyms.vat_rate_bp = 1500` is 15.00%. A
  rate that multiplies money must not smuggle a float into the ledger.
- Splitting money across people uses `Money.allocate` / `Money.split`, which
  use the largest-remainder method. Rs 3,500 across 3 family members is
  1167 + 1167 + 1166 — never 3 × 1167, which would put the books one cent out
  every month forever.
- `Money.format` is for display only. Never parse it back.

## 2. Time is UTC, rules are local

Instants are `timestamptz`, stored UTC. Every *rule* about time is expressed in
the **gym's** timezone and evaluated with an explicit zone argument.

```ts
import { Time } from '@gymx/core';

Time.isWithinWindow(instant, gym.timezone, lunchWindow); // correct
Time.isWithinWindow(instant, 'UTC', lunchWindow);        // wrong, and silent
```

- No function in `packages/core` reads the ambient system timezone.
- The test suite runs in `America/New_York` on purpose (`vitest.config.ts`). A
  suite that ran in `Indian/Mauritius` would pass while proving nothing.
- Gym ABC's entire Lunch tier is an 11:00–13:00 window. Read the wall clock in
  the wrong zone and the door opens at the wrong hour, quietly, for everyone.

## 3. Tenancy: `gym_id`, RLS, and `withTenant`

- Every tenant-scoped table has `gym_id uuid NOT NULL`, indexed, leading every
  composite index.
- Every such table has RLS **enabled and forced**, with a policy in
  `packages/db/sql/rls.sql`. `tenant.test.ts` fails if a table carrying a
  `gym_id` has no policy.
- **The application connects as `gymx_app`**, which owns nothing and is
  `NOBYPASSRLS`. Postgres exempts a table's owner from RLS, so an app running
  as the owner sails through every policy without a single error. `DATABASE_URL`
  (owner) is for migrations and seeds only.
- All tenant data access goes through `withTenant`, which opens a transaction
  and sets `app.gym_id` with `SET LOCAL` — the setting dies with the
  transaction, so a pooled connection cannot carry one gym's context into the
  next request.

### The four contexts

| Context | Sets | Use for |
|---|---|---|
| `withTenant({ gymId, userId, role })` | `app.gym_id` | Everything inside one gym |
| `withActor(userId)` | `app.user_id` | Sign-in: listing your own memberships |
| `withPlatform(userId)` | `app.is_platform` after verifying `platform_admins` | The platform console, cross-gym |
| `withAnonymous()` | nothing | Finding an account by email at sign-in |

### On Neon specifically

`gymx_app` must be created by `pnpm db:bootstrap`, **never through the Neon
console** — console-created roles inherit `neon_superuser`, which carries
`BYPASSRLS` and would void every policy without raising a single error. The
bootstrap script verifies this and exits non-zero if it finds it.

Use the **direct** endpoint for migrations and the **pooled** one for the app.
`SET LOCAL` is transaction-scoped, so it works correctly under PgBouncer's
transaction mode; session-level `SET` would have been silently broken.

`withTenant` **cannot** set the platform flag. Entering a gym is an act of
*narrowing*; the flag means "operate across tenants". Conflating the two once
made a platform admin viewing one gym's team page see every gym's staff.

## 4. Append-only tables

`payments`, `access_events`, `audit_log`, `notifications` have `UPDATE` and
`DELETE` revoked from `gymx_app`. Corrections are new rows (reversals, credit
notes), never edits.

The permission matrix in `@gymx/core/auth` mirrors this, so the UI never offers
an action the database will refuse.

## 5. Authorisation is data

`packages/core/src/auth/policy.ts` holds the matrix. Never write
`if (role === 'accountant')` in a route.

- `can(role, action, subject)` — check
- `assertCan(...)` — throw (server actions)
- `requirePageAccess(action, subject)` — `notFound()` (pages)

The accountant is read-only **by construction**: no write action is granted on
any subject, so a mutation added in a later phase is denied by default rather
than because someone remembered.

Pages use `requirePageAccess`, not `assertCan`. A denied page must render as a
404, not a 500 — a page you may not see should look absent, not broken.

## 6. Mutations go through the action pipeline

```ts
export const updateThing = defineAction(schema, { permission, audit }, handler);
```

Parse → resolve actor → authorise → `withTenant` → run → **write the audit row
in the same transaction** → typed result.

The audit write sharing the transaction is the point. A trail written afterwards
is missing exactly the entries you most want: the ones where the request died
between the change and the log.

The action's input parameter is typed `unknown` on purpose — it arrives from a
form over the wire, and the Zod parse is the boundary.

## 7. i18n: two mechanisms

- **UI chrome** → message catalogues in `packages/i18n/messages/`, via
  `next-intl`. Untranslated keys deep-merge over English, so a partial locale
  renders English rather than a raw key.
- **Content the gym types** (plan names, descriptions) → JSONB `*_i18n` columns
  shaped `{"en": "...", "fr": "..."}`, read with `Content.text(field, locale)`.

English strings only through development; French lands as one pass in Phase 10.
See `docs/roadmap.md` for why.

## 8. Scheduled jobs must be idempotent

There is no queue and therefore no retry with backoff — the next scheduled run
*is* the retry. Running `generate-invoices` twice on the same night must not
invoice a member twice.

`JobDefinition` has a required `idempotent: boolean`. It exists to force the
question at the moment a job is written rather than after a member is
double-charged. If you cannot honestly set it to `true`, the job needs a guard
(a period key, a unique constraint) before it ships.

## 9. Imports

Relative imports carry **no file extension** (`from './policy'`, not
`'./policy.js'`). Next.js's webpack does not resolve `.js` → `.tsx`, and the
workspace packages ship TypeScript source that Next transpiles directly.
