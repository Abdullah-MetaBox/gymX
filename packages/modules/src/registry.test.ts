import { afterEach, describe, expect, it } from 'vitest';
import {
  allModules,
  clearModules,
  collectNavItems,
  evaluateAccess,
  modulesFor,
  registerModule,
  resolveBranding,
  resolvePlanPrice,
} from './registry';
import type { GymModule, ModuleContext } from './types';

const context: ModuleContext = {
  gymId: '00000000-0000-0000-0000-000000000001',
  locale: 'en',
  timeZone: 'Indian/Mauritius',
};

afterEach(() => clearModules());

function stub(id: string, overrides: Partial<GymModule> = {}): GymModule {
  return { id, name: id, description: id, ...overrides };
}

describe('registration', () => {
  it('registers and looks up modules', () => {
    registerModule(stub('gym-abc'));
    expect(allModules().map((m) => m.id)).toEqual(['gym-abc']);
  });

  it('refuses a duplicate id', () => {
    registerModule(stub('gym-abc'));
    expect(() => registerModule(stub('gym-abc'))).toThrow(/already registered/);
  });

  it('activates only the modules a gym has enabled', () => {
    registerModule(stub('gym-abc'));
    registerModule(stub('other-gym'));

    expect(modulesFor(['gym-abc']).map((m) => m.id)).toEqual(['gym-abc']);
    expect(modulesFor([]).map((m) => m.id)).toEqual([]);
  });

  it('ignores an enabled id with no registered module', () => {
    // A gym row can name a module that has been removed from the build.
    // That must degrade quietly, not crash every page for that tenant.
    expect(modulesFor(['does-not-exist'])).toEqual([]);
  });
});

describe('nav items', () => {
  it('collects and orders contributions', () => {
    registerModule(stub('a', { navItems: () => [{ id: 'z', href: '/z', label: 'Z', order: 20 }] }));
    registerModule(stub('b', { navItems: () => [{ id: 'a', href: '/a', label: 'A', order: 10 }] }));

    expect(collectNavItems(['a', 'b'], context).map((i) => i.id)).toEqual(['a', 'z']);
  });
});

describe('branding', () => {
  it('merges later modules over earlier ones', () => {
    registerModule(stub('a', { branding: () => ({ primaryColor: '#111', accentColor: '#222' }) }));
    registerModule(stub('b', { branding: () => ({ primaryColor: '#333' }) }));

    expect(resolveBranding(['a', 'b'])).toEqual({ primaryColor: '#333', accentColor: '#222' });
  });
});

describe('price resolution (Phase 2 seam)', () => {
  it('chains modules, each seeing the previous result', () => {
    registerModule(
      stub('discount', {
        resolvePlanPrice: (_ctx, previous) => ({
          amountCents: previous.amountCents - 10_000,
          explanation: 'module discount',
        }),
      }),
    );

    const result = resolvePlanPrice(['discount'], context, {
      amountCents: 200_000,
      explanation: 'core',
    });
    expect(result.amountCents).toBe(190_000);
  });

  it('returns core"s answer when no module overrides', () => {
    const base = { amountCents: 180_000, explanation: 'core' };
    expect(resolvePlanPrice([], context, base)).toEqual(base);
  });
});

describe('access evaluation (Phase 5 seam)', () => {
  it('lets a module turn a grant into a denial', () => {
    registerModule(
      stub('strict', {
        evaluateAccess: () => ({ granted: false, reasonCode: 'student_proof_expired' }),
      }),
    );

    const decision = evaluateAccess(['strict'], context, { granted: true, reasonCode: 'ok' });
    expect(decision).toEqual({ granted: false, reasonCode: 'student_proof_expired' });
  });

  it('REFUSES to let a module turn a denial into a grant', () => {
    // The registry enforces this rather than trusting each module. A bug in a
    // tenant-specific module must never be able to open a door core shut.
    registerModule(
      stub('permissive', {
        evaluateAccess: () => ({ granted: true, reasonCode: 'module_says_yes' }),
      }),
    );

    const decision = evaluateAccess(['permissive'], context, {
      granted: false,
      reasonCode: 'payment_overdue',
    });
    expect(decision).toEqual({ granted: false, reasonCode: 'payment_overdue' });
  });

  it('still lets a module deny after another module denied', () => {
    registerModule(
      stub('one', { evaluateAccess: () => ({ granted: false, reasonCode: 'first' }) }),
    );
    registerModule(
      stub('two', { evaluateAccess: (_c, d) => ({ ...d, reasonCode: `${d.reasonCode}+second` }) }),
    );

    expect(evaluateAccess(['one', 'two'], context, { granted: true, reasonCode: 'ok' })).toEqual({
      granted: false,
      reasonCode: 'first+second',
    });
  });
});
