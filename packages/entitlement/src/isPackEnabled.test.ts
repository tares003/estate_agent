import { describe, expect, it } from 'vitest';
import { isPackEnabled } from './isPackEnabled.js';
import { createInMemoryPackSource } from './source.js';

describe('isPackEnabled', () => {
  const source = createInMemoryPackSource({
    'tenant-a': ['sales_plus', 'calculators'],
  });

  it('is always true for the implicit core pack, even with no enabled packs', async () => {
    const empty = createInMemoryPackSource();
    await expect(isPackEnabled('tenant-a', 'core', empty)).resolves.toBe(true);
  });

  it('is true for an optional pack the tenant has enabled', async () => {
    await expect(isPackEnabled('tenant-a', 'sales_plus', source)).resolves.toBe(true);
  });

  it('is false for an optional pack the tenant has not enabled', async () => {
    await expect(isPackEnabled('tenant-a', 'ai_assistant', source)).resolves.toBe(false);
  });

  it('is false for any optional pack when the tenant has none enabled', async () => {
    const empty = createInMemoryPackSource();
    await expect(isPackEnabled('tenant-b', 'calculators', empty)).resolves.toBe(false);
  });
});
