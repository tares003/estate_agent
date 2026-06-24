import { headers } from 'next/headers';

/** Header the EPIC-S middleware sets from the request hostname. */
export const TENANT_HEADER = 'x-estate-tenant';

/** Header the proxy sets to the request path (for active-nav matching). */
export const PATHNAME_HEADER = 'x-estate-pathname';

/** The current request path (set by the proxy), for marking the active nav link. */
export async function getCurrentPathname(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get(PATHNAME_HEADER);
}

/**
 * Resolve the current request's platform tenant id (set by middleware from the
 * hostname). Throws if unresolved — every tenant-scoped query needs it, and a
 * missing tenant must fail rather than silently cross tenants.
 */
export async function getCurrentTenantId(): Promise<string> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get(TENANT_HEADER);
  if (!tenantId) {
    throw new Error('No platform tenant resolved for this request (EPIC-S middleware).');
  }
  return tenantId;
}

/**
 * The absolute origin (`https://host`) for the current request, for canonical /
 * Open-Graph / sitemap URLs (EPIC-O). Multi-tenant, so it derives from the
 * request host (honouring the proxy's forwarded host/proto) rather than a fixed
 * env — each tenant's domain canonicalises to itself.
 */
export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

/**
 * Best-effort originating IP for the current request, for audit + GDPR-consent
 * provenance (master spec §S.7). Reads the standard proxy headers in priority
 * order; the first hop of `x-forwarded-for` is the real client. Returns null when
 * none is present (e.g. in tests) — provenance is best-effort, never a hard gate.
 */
export async function getRequestIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return requestHeaders.get('x-real-ip')?.trim() || null;
}

/**
 * The originating User-Agent for the current request, for consent-log + audit
 * provenance (master spec §J: a consent record captures the client IP + UA).
 * Returns null when absent (e.g. in tests) — provenance is best-effort.
 */
export async function getRequestUserAgent(): Promise<string | null> {
  const requestHeaders = await headers();
  return requestHeaders.get('user-agent')?.trim() || null;
}

/** The platform-tenant columns the public chrome / SEO needs. */
export interface PlatformTenantRow {
  name: string;
}

/**
 * Structural reader for the operator-owned `platform_tenants` registry. That
 * table is intentionally NOT under RLS (CLAUDE.md §9), so it is read on the base
 * client by id — not inside `withTenant` — which is why this takes the client
 * directly. Kept structural (not the full PrismaClient) so it unit-tests with a
 * fake.
 */
export interface PlatformTenantReader {
  platformTenant: {
    findUnique(args: { where: { id: string } }): Promise<PlatformTenantRow | null>;
  };
}

/**
 * The current tenant agency's display name (for SEO structured data + chrome),
 * or null when the tenant row is missing. Reads the un-RLS'd registry directly.
 */
export async function getTenantName(
  reader: PlatformTenantReader,
  tenantId: string,
): Promise<string | null> {
  const row = await reader.platformTenant.findUnique({ where: { id: tenantId } });
  return row?.name ?? null;
}
