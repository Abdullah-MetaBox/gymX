import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Next only reads .env from the app directory. This is a monorepo with one
// .env at the root, shared by the admin app, the worker and the db scripts --
// one source of truth beats three copies drifting apart.
loadEnv({ path: '../../.env', quiet: true });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than a build step.
  transpilePackages: [
    '@gymx/core',
    '@gymx/db',
    '@gymx/i18n',
    '@gymx/jobs',
    '@gymx/modules',
    '@gymx/storage',
  ],
  serverExternalPackages: ['@node-rs/argon2', 'postgres'],
};

export default withNextIntl(config);
