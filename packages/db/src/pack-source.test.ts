import { describe, expect, it } from 'vitest';
import { PrismaPackSource, type TenantPackReader } from './pack-source.js';

function reader(result: { enabledPacks: unknown } | null): TenantPackReader {
  return { platformTenant: { findUnique: async () => result } };
}

describe('PrismaPackSource', () => {
  it("returns the tenant's enabled packs", async () => {
    const source = new PrismaPackSource(reader({ enabledPacks: ['sales_plus', 'calculators'] }));
    expect(await source.getEnabledPacks('tenant-1')).toEqual(['sales_plus', 'calculators']);
  });

  it('returns [] for an unknown tenant', async () => {
    const source = new PrismaPackSource(reader(null));
    expect(await source.getEnabledPacks('tenant-1')).toEqual([]);
  });

  it('defensively ignores a non-array enabled_packs value', async () => {
    const source = new PrismaPackSource(reader({ enabledPacks: 'oops' }));
    expect(await source.getEnabledPacks('tenant-1')).toEqual([]);
  });

  it('filters out non-string members of enabled_packs', async () => {
    const source = new PrismaPackSource(reader({ enabledPacks: ['ok', 42, null, 'fine'] }));
    expect(await source.getEnabledPacks('tenant-1')).toEqual(['ok', 'fine']);
  });
});
