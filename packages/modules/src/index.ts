import { gymAbcModule } from './gym-abc/index';
import { getModule, registerModule } from './registry';

export * from './registry';
export * from './types';
export { gymAbcModule };

/**
 * Register the built-in modules exactly once.
 *
 * Next.js re-evaluates modules on hot reload, so this is guarded rather than
 * run at import time — a double registration would otherwise throw on the
 * second render in development.
 */
export function registerBuiltInModules(): void {
  if (!getModule(gymAbcModule.id)) {
    registerModule(gymAbcModule);
  }
}
