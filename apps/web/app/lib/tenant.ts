import { headers } from 'next/headers';

/** Header the EPIC-S middleware sets from the request hostname. */
export const TENANT_HEADER = 'x-estate-tenant';

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
