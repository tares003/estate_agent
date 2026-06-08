import { describe, expect, it } from 'vitest';
import * as db from './index.js';

describe('@estate/db barrel', () => {
  it('exports the public API', () => {
    expect(typeof db.createPrismaClient).toBe('function');
    expect(typeof db.tenantGucStatement).toBe('function');
    expect(typeof db.withTenant).toBe('function');
    expect(typeof db.PrismaPackSource).toBe('function');
    expect(typeof db.PrismaClient).toBe('function');
    expect(typeof db.Prisma).toBe('object');
  });
});
