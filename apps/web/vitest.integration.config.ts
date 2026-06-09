import { defineConfig } from 'vitest/config';

// Opt-in integration suite for apps/web data-layer code that needs real
// PostgreSQL 16 + PostGIS (the radius search). Node environment (no jsdom/React),
// generous timeouts for container boot. Requires Docker; run via
// `pnpm --filter @estate/web test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.integration.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
