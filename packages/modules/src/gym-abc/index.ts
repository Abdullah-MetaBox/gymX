import type { GymModule } from '../types';

/**
 * Gym ABC (Island Breeze) — the pilot tenant's module.
 *
 * It is deliberately small, and that is the finding rather than a gap. Working
 * through the meeting notes, almost everything described as a customisation
 * turns out to be configuration the plan builder already has to support for
 * every gym:
 *
 *   - Lunch / Full / Student tiers      → three `plans` rows
 *   - 11:00-13:00 lunch window          → `plan_access_rules` (Phase 2)
 *   - 12-month contract minimum         → `gyms.min_contract_months`
 *   - Couple Rs 1,800 vs Rs 2,000       → `plan_price_tiers` flat_by_size
 *   - Family Rs 3,500                   → `plan_price_tiers` flat_by_size
 *   - Pool as a gated area              → an `area` value on the access rule
 *   - Access cut a day after due        → `gyms.overdue_grace_days`
 *
 * If any of that had needed code, it would have meant GymX could not express
 * an ordinary Mauritian gym — a core problem wearing a customisation costume.
 *
 * What genuinely belongs here, and lands in the phase that can build it:
 *   - Student-status verification gating activation of a Student plan on an
 *     approved proof document, with annual re-verification (Phase 1/2)
 *   - Their preferred MRA export column layout (Phase 9)
 *   - Hooks for the physically gated pool (hardware phase)
 *
 * Shipping the shell in Phase 0 is the point: the seam gets exercised from day
 * one, so we find out now if it is awkward — not in Phase 10 when it is
 * load-bearing.
 */
export const gymAbcModule: GymModule = {
  id: 'gym-abc',
  name: 'Gym ABC',
  description: 'Tenant-specific behaviour for Gym ABC (Island Breeze).',

  branding() {
    return { primaryColor: '#d946ef', accentColor: '#0f766e' };
  },

  async seed() {
    // GymABC's plan and access-rule seed data lives in packages/db/scripts/seed.ts
    // rather than here because `SeedContext` carries no database client — the
    // module interface exists for runtime hooks, not for bootstrapping data.
    // The seed script inserts plans idempotently (skips if plans already exist).
  },
};
