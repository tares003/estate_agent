import type { NextConfig } from 'next';
import { withPayload } from '@payloadcms/next/withPayload';

const config: NextConfig = {
  reactStrictMode: true,
  // The @estate/* workspace packages are published as TypeScript source; Next
  // must transpile them (and handle their co-located component CSS).
  transpilePackages: [
    '@estate/ui',
    '@estate/tokens',
    '@estate/db',
    '@estate/validators',
    '@estate/entitlement',
    '@estate/i18n',
  ],
  // The @estate/* packages import siblings with explicit `.js` extensions (NodeNext
  // style) that resolve to `.ts`/`.tsx` source. Vite/tsc/Vitest handle this; tell
  // webpack to try the TS extensions for a requested `.js` too.
  //
  // Next 16 defaults to Turbopack, so the app builds/runs with `--webpack` (see the
  // package.json scripts): this webpack config is honoured, and Payload's
  // `withPayload` (which injects a webpack config) composes over it (CLAUDE.md §9).
  webpack(config) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

// withPayload mounts the CMS: it sets the `@payload-config` alias, externalises
// Payload's server-only packages, and wraps the webpack config above.
export default withPayload(config);
