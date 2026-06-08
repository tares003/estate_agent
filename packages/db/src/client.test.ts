import { describe, expect, it } from 'vitest';
import { createPrismaClient, Prisma, PrismaClient } from './client.js';

// Note: PrismaClient is NOT instantiated here. Constructing the generated client
// under the vitest/esbuild transform overflows the stack, and a real connection
// is an integration concern (exercised via Testcontainers in CI), not a unit
// test. createPrismaClient is the one-line `new PrismaClient(options)` wrapper —
// excluded from unit coverage in vitest.config.ts as DB-connection glue.
describe('@estate/db client surface', () => {
  it('exposes the client factory and PrismaClient export', () => {
    expect(typeof createPrismaClient).toBe('function');
    expect(typeof PrismaClient).toBe('function');
  });

  it('re-exports the Prisma namespace helpers', () => {
    expect(typeof Prisma.sql).toBe('function');
    expect(typeof Prisma.raw).toBe('function');
  });
});
