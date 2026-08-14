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
  // Performance optimizations. Note: no `swcMinify` -- it is not a valid key in
  // Next 15 (SWC minification is always on) and setting it warns on every build.
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Cache strategy for Vercel
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default withNextIntl(config);
