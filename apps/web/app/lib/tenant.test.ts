import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('next/headers', () => ({ headers: async () => ({ get }) }));

const { getCurrentTenantId, getRequestIp, getRequestOrigin } = await import('./tenant.js');

/** Drive the mocked `headers().get(name)` from a header map. */
function headerMap(map: Record<string, string | null>): void {
  get.mockImplementation((name: string) => map[name] ?? null);
}

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

describe('getRequestIp', () => {
  it('returns the first hop of x-forwarded-for', async () => {
    headerMap({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' });
    expect(await getRequestIp()).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    headerMap({ 'x-forwarded-for': null, 'x-real-ip': '198.51.100.4' });
    expect(await getRequestIp()).toBe('198.51.100.4');
  });

  it('returns null when no originating IP header is present', async () => {
    headerMap({});
    expect(await getRequestIp()).toBeNull();
  });
});

describe('getRequestOrigin', () => {
  it('builds the origin from the forwarded host + proto', async () => {
    headerMap({ 'x-forwarded-host': 'acme.estateplatform.co.uk', 'x-forwarded-proto': 'https' });
    expect(await getRequestOrigin()).toBe('https://acme.estateplatform.co.uk');
  });

  it('falls back to the Host header and https', async () => {
    headerMap({ host: 'acme.test' });
    expect(await getRequestOrigin()).toBe('https://acme.test');
  });
});
