import { defineConfig, devices } from '@playwright/experimental-ct-react';
import react from '@vitejs/plugin-react';

// Playwright component testing for @estate/ui. Real-browser rendering at the
// seven canonical breakpoints — this is where genuinely responsive surfaces
// (PropertyCard, organisms) get their G11/G9 verification (jsdom has no layout).
// Unit/behaviour tests stay in Vitest (*.test.tsx); CT specs are *.spec.tsx.
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.tsx',
  snapshotDir: './__snapshots__',
  timeout: 30_000,
  fullyParallel: true,
  use: {
    trace: 'off',
    ctViteConfig: {
      plugins: [react()],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
