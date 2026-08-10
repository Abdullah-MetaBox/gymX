import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv({ path: '.env', quiet: true });

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    setupFiles: ['./vitest.setup.ts'],
    // Deliberately NOT Indian/Mauritius. Every timezone-sensitive helper must
    // work when the machine running it sits in a different zone to the gym --
    // which is exactly what happens on a cloud host. A suite that runs in the
    // gym's own timezone would pass while proving nothing.
    env: { TZ: 'America/New_York' },
    pool: 'forks',
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
