import { describe, expect, it } from 'vitest';
import * as api from './index.js';

describe('@estate/entitlement public API', () => {
  it('re-exports the catalogue, source factory, helpers and gating component', () => {
    expect(api.OPTIONAL_PACK_SLUGS).toBeDefined();
    expect(api.ALL_PACK_SLUGS).toBeDefined();
    expect(typeof api.createInMemoryPackSource).toBe('function');
    expect(typeof api.isPackEnabled).toBe('function');
    expect(typeof api.requirePack).toBe('function');
    expect(typeof api.PackNotEnabledError).toBe('function');
    expect(typeof api.RequirePack).toBe('function');
  });
});
