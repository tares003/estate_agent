import { defineConfig, devices } from '@playwright/test';
import { E2E_DB_URL } from './e2e/global-setup.js';

// Page-level e2e: real Next app (next dev) over a real Postgres+PostGIS (stood up
// in global-setup), driven in Chromium with axe accessibility checks. Opt-in
// (`pnpm --filter @estate/web test:e2e`); requires Docker. Generous timeouts
// because next dev compiles routes on first hit.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  // Dedicated port so the e2e server (pointed at the e2e Postgres) never collides
  // with a dev/preview server a developer may already have on 3000.
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm exec next dev -p 3100',
    url: 'http://localhost:3100',
    timeout: 180_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_DB_URL },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
