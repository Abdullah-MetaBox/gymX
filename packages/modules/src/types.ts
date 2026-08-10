import type { Action, Role, Subject } from '@gymx/core/auth';

/**
 * The module seam.
 *
 * GymX core knows nothing about any particular gym. A gym with genuinely
 * bespoke behaviour gets a module, enabled per tenant via
 * `gyms.enabled_modules`. Core never imports a module directly — only the
 * registry does — so a module can be removed without touching core code.
 *
 * A caution worth writing down: roughly 90% of what the Gym ABC meeting notes
 * call "customisations" (three tiers, a 12-month minimum, Rs 1,800 for a
 * couple, an 11:00-13:00 lunch window) is *configuration*, expressible through
 * the plan builder with no code at all. The seam exists for the remaining 10%.
 * Keeping `gym-abc` thin is a design goal, not a shortfall — a fat module
 * means something belonged in core and was put in the wrong place.
 *
 * Most hooks below are declared now and implemented in the phase that needs
 * them. Declaring them early is what stops a later phase from discovering that
 * the extension point it needs does not exist.
 */

export interface ModuleContext {
  gymId: string;
  locale: string;
  timeZone: string;
}

export interface NavItem {
  /** Stable id, also used as the i18n message key when `label` is absent. */
  id: string;
  href: string;
  label: string;
  /** Lucide icon name, resolved by the shell. */
  icon?: string;
  /** Hidden unless the signed-in role holds this permission. */
  requires?: { action: Action; subject: Subject };
  order?: number;
}

/** Phase 2. Lets a module override the price core resolved. */
export interface PriceResult {
  amountCents: number;
  explanation: string;
}

/** Phase 5. A module may DOWNGRADE an access decision, never upgrade one. */
export interface AccessDecision {
  granted: boolean;
  reasonCode: string;
}

/** Phase 3. Extra lines a module contributes to an invoice. */
export interface InvoiceLineDraft {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatRateBp: number;
  source: string;
}

/** Phase 9. A report a module adds to the reporting menu. */
export interface ReportDefinition {
  id: string;
  title: string;
  requires?: { action: Action; subject: Subject };
}

export interface SeedContext {
  gymId: string;
}

export interface GymModule {
  /** Matches the value stored in `gyms.enabled_modules`. */
  id: string;
  name: string;
  description: string;

  /** Navigation entries contributed to the admin shell. */
  navItems?(context: ModuleContext): NavItem[];

  /** Run when the module is enabled for a gym. Idempotent. */
  seed?(context: SeedContext): Promise<void>;

  /** Branding overrides merged over the gym's own settings. */
  branding?(): { primaryColor?: string; accentColor?: string };

  // --- Declared now, implemented in the phase that needs them --------------

  /** Phase 2. Receives core's answer and may replace it. */
  resolvePlanPrice?(context: ModuleContext, defaultResult: PriceResult): PriceResult;

  /**
   * Phase 5. Receives core's decision. The registry enforces that a module can
   * only turn a grant into a denial — never the reverse — so a buggy module
   * cannot open a door that core wanted shut.
   */
  evaluateAccess?(context: ModuleContext, defaultDecision: AccessDecision): AccessDecision;

  /** Phase 3. Append extra invoice lines. */
  onInvoiceBuild?(context: ModuleContext, lines: InvoiceLineDraft[]): InvoiceLineDraft[];

  /** Phase 9. Extra reports. */
  reports?(): ReportDefinition[];
}

export type ModuleId = string;

export interface RoleAwareContext extends ModuleContext {
  role: Role;
}
