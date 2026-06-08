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
