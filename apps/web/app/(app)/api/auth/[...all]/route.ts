import { runWithAuthTenant } from '@estate/db';

import { getAuth } from '../../../lib/auth.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';

// B78c — the Better Auth catch-all endpoint (CLAUDE.md §9, EPIC-N). Every auth
// flow (sign-in, OAuth callback, magic-link verify, get-session, 2FA) is served by
// better-auth's own handler, mounted here at /api/auth/*.
//
// SECURITY — tenant binding. The auth adapter runs on a BYPASSRLS connection whose
// isolation is the per-request `runWithAuthTenant(<tenant>)` context (B78a). The
// tenant MUST be the one the EPIC-S middleware (proxy.ts) resolved from the request
// HOSTNAME against the tenant registry — `getCurrentTenantId()` reads that
// server-set, registry-validated header. We never derive the tenant from a raw
// `Host` (the proxy strips any inbound tenant header), so a forged host cannot run
// the handler in another tenant's context.
//
// When Better Auth is not configured (no BETTER_AUTH_SECRET) the endpoint 404s and
// touches nothing — the app is unaffected until an operator wires the secrets.

export const dynamic = 'force-dynamic';

async function handle(request: Request): Promise<Response> {
  const auth = getAuth();
  if (!auth) {
    return new Response('Not found', { status: 404 });
  }
  // Throws if no tenant resolved for the host — auth is only valid on a tenant
  // subdomain, so failing closed here is correct.
  const tenantId = await getCurrentTenantId();
  return runWithAuthTenant(tenantId, () => auth.handler(request));
}

export const GET = handle;
export const POST = handle;
