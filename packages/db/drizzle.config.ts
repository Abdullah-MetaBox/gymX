import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: '../../.env', quiet: true });

export default defineConfig({
  // Concrete files, not the barrel: drizzle-kit loads these through CJS, which
  // does not resolve the `.js` specifiers the barrel uses. Later phases add
  // their schema file here.
  schema: ['./src/schema/platform.ts', './src/schema/members.ts', './src/schema/plans.ts', './src/schema/subscriptions.ts', './src/schema/payments.ts', './src/schema/access.ts', './src/schema/reconciliation.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations run as the OWNER. The application never uses this URL.
    url: process.env.DATABASE_URL as string,
  },
  strict: true,
  verbose: true,
});
