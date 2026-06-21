// B78d — the pure decision behind resolving a staff member from a verified Better
// Auth session (EPIC-N). The orchestration (call auth.api.getSession, then load the
// staff user) is glue in staff-session.ts; this is the security-bearing part.

/** The slice of better-auth's getSession result this resolver reads. */
export interface AuthSessionShape {
  user?: { id?: string | null; tenantId?: string | null } | null;
  session?: { tenantId?: string | null } | null;
}

/**
 * Decide whether a verified Better Auth session may act as a staff session on this
 * request, returning the `(userId, tenantId)` to load — or null to reject.
 *
 * The session carries the user id and the tenant it was issued for. We accept it
 * ONLY when that tenant equals `requestTenantId` (the tenant the EPIC-S middleware
 * resolved from the request hostname). better-auth's cookie-cache can return a
 * session from the signed cookie without a DB read, so a tenant-A cookie replayed
 * on tenant-B's subdomain is rejected here rather than trusted.
 */
export function staffAuthLookup(
  auth: AuthSessionShape | null,
  requestTenantId: string,
): { userId: string; tenantId: string } | null {
  if (!auth) return null;
  const userId = auth.user?.id;
  const tenantId = auth.session?.tenantId ?? auth.user?.tenantId ?? null;
  if (!userId || !tenantId) return null;
  // The session's tenant MUST be the request's resolved tenant — no cross-tenant
  // session is ever honoured (defends against signed-cookie replay across hosts).
  if (tenantId !== requestTenantId) return null;
  return { userId, tenantId };
}
