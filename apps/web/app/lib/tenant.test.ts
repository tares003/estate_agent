import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('next/headers', () => ({ headers: async () => ({ get }) }));

const { getCurrentTenantId } = await import('./tenant.js');

describe('getCurrentTenantId', () => {
  it('returns the tenant id from the request header', async () => {
    get.mockReturnValue('00000000-0000-0000-0000-000000000001');
    expect(await getCurrentTenantId()).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('throws when no tenant is resolved (fail-closed)', async () => {
    get.mockReturnValue(null);
    await expect(getCurrentTenantId()).rejects.toThrow(/tenant/i);
  });
});
