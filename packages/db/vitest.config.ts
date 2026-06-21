import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests (real Postgres + PostGIS via Testcontainers) are opt-in —
    // run with `pnpm test:integration`; kept out of the fast, Docker-free unit run.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.test.ts'],
    // PrismaClient validates the datasource env at construction; tests never
    // connect (they inject fakes or use pglite), so a dummy URL is enough.
    env: { DATABASE_URL: 'postgresql://user:pass@localhost:5432/estate_test?schema=public' },
    // pglite (the in-process Postgres used for the RLS isolation test) loads a
    // WASM module; give those tests headroom.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // client.ts is the `new PrismaClient()` connection glue — not unit-testable
      // without a live DB (its construction is exercised via Testcontainers in CI).
      // auth-tenant-extension.ts is the Prisma.defineExtension binding for the auth
      // client — same rationale (needs a live client + query fn); its decision logic
      // lives in auth-tenant-scope.ts, which carries the gate.
      exclude: ['src/**/*.test.ts', 'src/client.ts', 'src/auth-tenant-extension.ts'],
    },
  },
});
