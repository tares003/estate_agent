// EPIC-S FR-S-1: resolve the platform tenant from the request hostname. Pure
// parsing + a registry lookup, so it is fully unit-testable and reusable by the
// proxy. A tenant is reachable on its `<slug>.<base>` subdomain and on its custom
// domain; the base apex, `www`, and the `admin` operator subdomain are NOT
// tenants. Only ACTIVE tenants resolve (suspended/deprovisioned do not serve).

/** The classification of a request host relative to the platform base domain. */
export type TenantHost =
  | { kind: 'apex' } // the base domain / www / localhost — marketing, no tenant
  | { kind: 'operator' } // admin.<base> — the operator admin, no tenant
  | { kind: 'subdomain'; slug: string } // <slug>.<base> — a tenant by slug
  | { kind: 'custom'; host: string }; // a domain not under <base> — a tenant by custom domain

/** Looks up ACTIVE tenant ids by slug or custom domain (Prisma-backed in prod). */
export interface TenantRegistry {
  findActiveTenantIdBySlug(slug: string): Promise<string | null>;
  findActiveTenantIdByDomain(host: string): Promise<string | null>;
}

/** Lowercase + strip the port from a host header value. */
function normaliseHost(rawHost: string): string {
  const withoutPort = rawHost.split(':')[0] ?? rawHost;
  return withoutPort.trim().toLowerCase();
}

/** Classify a request host relative to the platform base domain (pure). */
export function parseTenantHost(rawHost: string, baseDomain: string): TenantHost {
  const host = normaliseHost(rawHost);
  const base = baseDomain.trim().toLowerCase();

  if (host === '' || host === 'localhost' || host === base || host === `www.${base}`) {
    return { kind: 'apex' };
  }
  if (host === `admin.${base}`) {
    return { kind: 'operator' };
  }
  if (host.endsWith(`.${base}`)) {
    const slug = host.slice(0, host.length - `.${base}`.length);
    // A tenant subdomain is a single label; an empty or multi-level sub is not.
    if (slug === '' || slug.includes('.')) {
      return { kind: 'apex' };
    }
    return { kind: 'subdomain', slug };
  }
  return { kind: 'custom', host };
}

/** Resolve a request host to an ACTIVE tenant id, or null (apex/operator/unknown). */
export async function resolveTenantIdByHost(
  rawHost: string,
  baseDomain: string,
  registry: TenantRegistry,
): Promise<string | null> {
  const parsed = parseTenantHost(rawHost, baseDomain);
  switch (parsed.kind) {
    case 'subdomain':
      return registry.findActiveTenantIdBySlug(parsed.slug);
    case 'custom':
      return registry.findActiveTenantIdByDomain(parsed.host);
    default:
      return null;
  }
}

/** The slice of the Prisma client the registry needs — structural so it is
 * DB-free to unit-test (the real PlatformTenant delegate satisfies it). */
export interface TenantLookupClient {
  platformTenant: {
    findFirst(args: {
      where: Record<string, unknown>;
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

/**
 * Build a {@link TenantRegistry} backed by the platform_tenants registry table.
 * That table is NOT tenant-scoped (it is the registry itself), so the lookups run
 * without a tenant GUC. Only `active` tenants resolve.
 */
export function createTenantRegistry(db: TenantLookupClient): TenantRegistry {
  return {
    findActiveTenantIdBySlug: async (slug) =>
      (
        await db.platformTenant.findFirst({
          where: { slug, status: 'active' },
          select: { id: true },
        })
      )?.id ?? null,
    findActiveTenantIdByDomain: async (host) =>
      (
        await db.platformTenant.findFirst({
          where: { customDomain: host, status: 'active' },
          select: { id: true },
        })
      )?.id ?? null,
  };
}
