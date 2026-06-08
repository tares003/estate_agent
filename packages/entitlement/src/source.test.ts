// pack: core — exercises the core entitlement source; references slugs as fixtures only.
import { describe, expect, it } from 'vitest';
import { createInMemoryPackSource } from './source.js';

describe('createInMemoryPackSource', () => {
  it('returns the configured enabled packs for a known tenant', async () => {
    const source = createInMemoryPackSource({
      'tenant-a': ['sales_plus', 'calculators'],
    });
    await expect(source.getEnabledPacks('tenant-a')).resolves.toEqual([
      'sales_plus',
      'calculators',
    ]);
  });

  it('returns an empty list for an unknown tenant', async () => {
    const source = createInMemoryPackSource({ 'tenant-a': ['sales_plus'] });
    await expect(source.getEnabledPacks('tenant-unknown')).resolves.toEqual([]);
  });

  it('returns an empty list when constructed with no map', async () => {
    const source = createInMemoryPackSource();
    await expect(source.getEnabledPacks('any-tenant')).resolves.toEqual([]);
  });
});
