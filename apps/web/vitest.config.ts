import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The app's tsconfig uses jsx: "preserve" (Next compiles JSX itself), so Vitest
// needs the React plugin to transform JSX (automatic runtime) for tests.
export default defineConfig({
  plugins: [react()],
  test: {
    css: false,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    include: ['app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'proxy.test.{ts,tsx}'],
    // Integration tests (real Postgres + PostGIS via Testcontainers) are opt-in —
    // `pnpm test:integration`; kept out of the fast, Docker-free unit run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'proxy.ts'],
      exclude: [
        'app/**/*.test.{ts,tsx}',
        'app/**/layout.tsx',
        // Request/connection glue (Prisma client construction) — exercised via
        // integration/e2e, not unit tests (constructing Prisma overflows jsdom).
        'app/lib/db.ts',
        '**/*.config.*',
      ],
    },
  },
});
