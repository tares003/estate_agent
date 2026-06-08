import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // auth.ts is the better-auth construction glue — `createAuth` wires
      // betterAuth({...}) with the prisma adapter and the OAuth/magic-link/2FA
      // plugins. Its branch-free config assembly is asserted by the shape test
      // in auth.test.ts (providers + plugins present, no DB connection), but the
      // file is excluded from the coverage gate the same way @estate/db excludes
      // client.ts: the live OAuth / magic-link / WebAuthn flows it configures are
      // integration-tested via Testcontainers in CI (Docker is unavailable in
      // this dev env), not unit-tested here. The pure logic (roles.ts, access.ts)
      // carries the 100/100 shared-package gate.
      exclude: ['src/**/*.test.ts', 'src/auth.ts'],
    },
  },
});
