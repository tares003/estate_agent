// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  createTenantRegistry,
  parseTenantHost,
  resolveTenantIdByHost,
  type TenantLookupClient,
  type TenantRegistry,
} from './tenant-host.js';

// EPIC-S FR-S-1: resolve the platform tenant from the request hostname. A tenant
// is reachable on its `<slug>.<base>` subdomain and on its custom domain; the
// base apex + the `www`/`admin` (operator) subdomains are NOT tenants. Pure
// parsing + a registry lookup (active tenants only — suspended/deprovisioned
// tenants do not serve).

const BASE = 'estateplatform.co.uk';

describe('parseTenantHost', () => {
  it('treats the base apex and www as non-tenant (apex)', () => {
    expect(parseTenantHost('estateplatform.co.uk', BASE)).toEqual({ kind: 'apex' });
    expect(parseTenantHost('www.estateplatform.co.uk', BASE)).toEqual({ kind: 'apex' });
  });

  it('treats the admin subdomain as the operator (non-tenant)', () => {
    expect(parseTenantHost('admin.estateplatform.co.uk', BASE)).toEqual({ kind: 'operator' });
  });

  it('extracts the tenant slug from a subdomain', () => {
    expect(parseTenantHost('acme.estateplatform.co.uk', BASE)).toEqual({
      kind: 'subdomain',
      slug: 'acme',
    });
  });

  it('strips the port and lowercases', () => {
    expect(parseTenantHost('ACME.EstatePlatform.co.uk:3000', BASE)).toEqual({
      kind: 'subdomain',
      slug: 'acme',
    });
  });

  it('treats a domain not under the base as a custom domain', () => {
    expect(parseTenantHost('www.acme-estates.co.uk', BASE)).toEqual({
      kind: 'custom',
      host: 'www.acme-estates.co.uk',
    });
  });

  it('treats localhost as non-tenant (apex) — dev fallback handles it', () => {
    expect(parseTenantHost('localhost:3000', BASE)).toEqual({ kind: 'apex' });
  });

  it('treats a multi-level subdomain as non-tenant (a slug is a single label)', () => {
    expect(parseTenantHost('a.b.estateplatform.co.uk', BASE)).toEqual({ kind: 'apex' });
  });
});

function registry(over: Partial<TenantRegistry> = {}): TenantRegistry {
  return {
    findActiveTenantIdBySlug: async () => null,
    findActiveTenantIdByDomain: async () => null,
    ...over,
  };
}

describe('resolveTenantIdByHost', () => {
  it('resolves a subdomain to the active tenant id', async () => {
    const id = await resolveTenantIdByHost('acme.estateplatform.co.uk', BASE, {
      ...registry(),
      findActiveTenantIdBySlug: async (slug) => (slug === 'acme' ? 'tenant-acme' : null),
    });
    expect(id).toBe('tenant-acme');
  });

  it('resolves a custom domain to the active tenant id', async () => {
    const id = await resolveTenantIdByHost('www.acme-estates.co.uk', BASE, {
      ...registry(),
      findActiveTenantIdByDomain: async (host) =>
        host === 'www.acme-estates.co.uk' ? 'tenant-acme' : null,
    });
    expect(id).toBe('tenant-acme');
  });

  it('returns null for a subdomain with no active tenant (unknown/suspended)', async () => {
    expect(await resolveTenantIdByHost('ghost.estateplatform.co.uk', BASE, registry())).toBeNull();
  });

  it('returns null for the apex / operator without querying the registry', async () => {
    let queried = false;
    const reg = registry({
      findActiveTenantIdBySlug: async () => {
        queried = true;
        return 'x';
      },
    });
    expect(await resolveTenantIdByHost('admin.estateplatform.co.uk', BASE, reg)).toBeNull();
    expect(await resolveTenantIdByHost('estateplatform.co.uk', BASE, reg)).toBeNull();
    expect(queried).toBe(false);
  });
});

describe('createTenantRegistry', () => {
  function client(rows: { id: string; where: Record<string, unknown> }[]): {
    db: TenantLookupClient;
    calls: Record<string, unknown>[];
  } {
    const calls: Record<string, unknown>[] = [];
    const db: TenantLookupClient = {
      platformTenant: {
        findFirst: async ({ where }) => {
          calls.push(where);
          const match = rows.find((r) => JSON.stringify(r.where) === JSON.stringify(where));
          return match ? { id: match.id } : null;
        },
      },
    };
    return { db, calls };
  }

  it('looks up an active tenant by slug', async () => {
    const { db, calls } = client([{ id: 't1', where: { slug: 'acme', status: 'active' } }]);
    const reg = createTenantRegistry(db);
    expect(await reg.findActiveTenantIdBySlug('acme')).toBe('t1');
    expect(await reg.findActiveTenantIdBySlug('ghost')).toBeNull();
    expect(calls[0]).toEqual({ slug: 'acme', status: 'active' });
  });

  it('looks up an active tenant by custom domain', async () => {
    const { db } = client([{ id: 't2', where: { customDomain: 'acme.co.uk', status: 'active' } }]);
    const reg = createTenantRegistry(db);
    expect(await reg.findActiveTenantIdByDomain('acme.co.uk')).toBe('t2');
    expect(await reg.findActiveTenantIdByDomain('nope.co.uk')).toBeNull();
  });
});
