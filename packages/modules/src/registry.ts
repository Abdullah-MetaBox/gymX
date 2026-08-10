import type {
  AccessDecision,
  GymModule,
  InvoiceLineDraft,
  ModuleContext,
  ModuleId,
  NavItem,
  PriceResult,
  ReportDefinition,
  SeedContext,
} from './types';

/**
 * The module registry.
 *
 * Core imports this; core never imports a module. Modules register themselves
 * here at startup and are activated per gym by `gyms.enabled_modules`.
 */

const registry = new Map<ModuleId, GymModule>();

export function registerModule(module: GymModule): void {
  if (registry.has(module.id)) {
    throw new Error(`Module "${module.id}" is already registered`);
  }
  registry.set(module.id, module);
}

export function getModule(id: ModuleId): GymModule | undefined {
  return registry.get(id);
}

export function allModules(): GymModule[] {
  return [...registry.values()];
}

/** The modules a given gym has switched on, in registration order. */
export function modulesFor(enabledModuleIds: readonly string[]): GymModule[] {
  return enabledModuleIds
    .map((id) => registry.get(id))
    .filter((module): module is GymModule => module !== undefined);
}

/** Reset — tests only. */
export function clearModules(): void {
  registry.clear();
}

// ---------------------------------------------------------------------------
// Hook dispatch
// ---------------------------------------------------------------------------

export function collectNavItems(enabled: readonly string[], context: ModuleContext): NavItem[] {
  return modulesFor(enabled)
    .flatMap((module) => module.navItems?.(context) ?? [])
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export async function runSeeds(enabled: readonly string[], context: SeedContext): Promise<void> {
  for (const module of modulesFor(enabled)) {
    await module.seed?.(context);
  }
}

export function resolveBranding(enabled: readonly string[]): {
  primaryColor?: string;
  accentColor?: string;
} {
  // Mutating a local accumulator rather than spreading per iteration: this runs
  // on every request that renders the shell.
  const merged: { primaryColor?: string; accentColor?: string } = {};
  for (const module of modulesFor(enabled)) {
    Object.assign(merged, module.branding?.() ?? {});
  }
  return merged;
}

/** Phase 2. Each module sees the previous result and may replace it. */
export function resolvePlanPrice(
  enabled: readonly string[],
  context: ModuleContext,
  defaultResult: PriceResult,
): PriceResult {
  return modulesFor(enabled).reduce(
    (result, module) => module.resolvePlanPrice?.(context, result) ?? result,
    defaultResult,
  );
}

/**
 * Phase 5. Modules may only tighten access.
 *
 * The registry enforces it rather than trusting each module: if core granted
 * entry a module can deny it, but a module can never turn core's denial into a
 * grant. A bug in a tenant-specific module must not be able to open a door.
 */
export function evaluateAccess(
  enabled: readonly string[],
  context: ModuleContext,
  defaultDecision: AccessDecision,
): AccessDecision {
  return modulesFor(enabled).reduce((decision, module) => {
    const proposed = module.evaluateAccess?.(context, decision);
    if (!proposed) return decision;
    if (!decision.granted && proposed.granted) {
      // Silently ignored, deliberately: a module cannot escalate.
      return decision;
    }
    return proposed;
  }, defaultDecision);
}

/** Phase 3. */
export function buildInvoiceLines(
  enabled: readonly string[],
  context: ModuleContext,
  lines: InvoiceLineDraft[],
): InvoiceLineDraft[] {
  return modulesFor(enabled).reduce(
    (current, module) => module.onInvoiceBuild?.(context, current) ?? current,
    lines,
  );
}

/** Phase 9. */
export function collectReports(enabled: readonly string[]): ReportDefinition[] {
  return modulesFor(enabled).flatMap((module) => module.reports?.() ?? []);
}
