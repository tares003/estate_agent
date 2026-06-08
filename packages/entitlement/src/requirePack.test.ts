import { describe, expect, it } from 'vitest';
import { createInMemoryPackSource } from './source.js';
import { PackNotEnabledError, requirePack } from './requirePack.js';

describe('requirePack', () => {
  const source = createInMemoryPackSource({ 'tenant-a': ['sales_plus'] });

  it('resolves (no throw) for the always-on core pack', async () => {
    await expect(requirePack('tenant-a', 'core', source)).resolves.toBeUndefined();
  });

  it('resolves for an optional pack the tenant has enabled', async () => {
    await expect(requirePack('tenant-a', 'sales_plus', source)).resolves.toBeUndefined();
  });

  it('throws PackNotEnabledError for a pack the tenant has not enabled', async () => {
    await expect(requirePack('tenant-a', 'ai_assistant', source)).rejects.toBeInstanceOf(
      PackNotEnabledError,
    );
  });

  it('the thrown error carries the tenant id and pack slug', async () => {
    const error = await requirePack('tenant-a', 'ai_assistant', source).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PackNotEnabledError);
    const packError = error as PackNotEnabledError;
    expect(packError.name).toBe('PackNotEnabledError');
    expect(packError.tenantId).toBe('tenant-a');
    expect(packError.packSlug).toBe('ai_assistant');
    expect(packError.message).toContain('ai_assistant');
  });
});
