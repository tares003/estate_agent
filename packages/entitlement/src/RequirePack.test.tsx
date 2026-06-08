// pack: core — exercises the core entitlement gate; references slugs as fixtures only.
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { RequirePack } from './RequirePack.jsx';
import { createInMemoryPackSource } from './source.js';

const source = createInMemoryPackSource({ 'tenant-a': ['sales_plus'] });

describe('RequirePack', () => {
  it('returns the children when the pack is enabled for the tenant', async () => {
    const children = 'gated-content' as unknown as ReactElement;
    const result = await RequirePack({
      pack: 'sales_plus',
      tenantId: 'tenant-a',
      source,
      children,
    });
    expect(result).toBe(children);
  });

  it('always returns the children for the core pack', async () => {
    const children = 'core-content' as unknown as ReactElement;
    const empty = createInMemoryPackSource();
    const result = await RequirePack({
      pack: 'core',
      tenantId: 'tenant-a',
      source: empty,
      children,
    });
    expect(result).toBe(children);
  });

  it('returns the fallback when the pack is not enabled', async () => {
    const fallback = 'upsell' as unknown as ReactElement;
    const result = await RequirePack({
      pack: 'ai_assistant',
      tenantId: 'tenant-a',
      source,
      children: 'gated' as unknown as ReactElement,
      fallback,
    });
    expect(result).toBe(fallback);
  });

  it('returns null when the pack is not enabled and no fallback is given', async () => {
    const result = await RequirePack({
      pack: 'ai_assistant',
      tenantId: 'tenant-a',
      source,
      children: 'gated' as unknown as ReactElement,
    });
    expect(result).toBeNull();
  });
});
