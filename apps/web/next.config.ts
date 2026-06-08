import type { NextConfig } from 'next';

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
  webpack(config) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default config;
