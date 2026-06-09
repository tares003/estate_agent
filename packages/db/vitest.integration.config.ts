import { defineConfig } from 'vitest/config';

// Opt-in integration suite: real PostgreSQL 16 + PostGIS via Testcontainers.
// Pulling the image + booting a container is slow, so the timeouts are generous
// and these tests are excluded from the default `pnpm test` run. Requires Docker.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
