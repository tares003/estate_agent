import { cache } from 'react';
import { headers } from 'next/headers';
import { runWithAuthTenant, withTenant } from '@estate/db';

import { getAuth } from './auth.js';
import { customerAuthLookup, type AuthSessionShape } from './customer-session-resolve.js';
import {
  loadCustomerSession,
  type CustomerSession,
  type CustomerUserReader,
} from './customer-user.js';
import { getDb } from './db.js';
import { getCurrentTenantId } from './tenant.js';

// The customer-session seam (EPIC-T). Resolves the acting customer's session — the
// audit actor, the user id, and the verified-email flag — and gates the customer
// save flows. Mirrors the staff-session seam (staff-session.ts) exactly, EXCEPT it
// FAILS CLOSED to `null` (signed out) rather than to a dev super-admin: there is no
// "default customer", so an unresolved session means no save is permitted.
//
// Resolution order:
//   1. A verified Better Auth session cookie (production): getSession reads the
//      signed cookie (carrying the user + tenant); customerAuthLookup accepts it
//      only when its tenant equals the request's resolved tenant (no cross-tenant
//      replay), then the user is re-loaded tenant-scoped and confirmed to be a
//      `type=customer` account. getSession runs inside runWithAuthTenant so the
//      BYPASSRLS auth adapter scopes the user read to that tenant.
//   2. A configured dev session: `DEV_CUSTOMER_USER_ID` names a real customer user
//      (local dev without sign-in) — load them tenant-scoped.
//
// Glue (reads env / the DB / the session cookie) — excluded from unit coverage;
// callers mock it. The pure pieces live in customer-session-resolve.ts (tenant
// match) + customer-user.ts (type gate + verified-email mapping).

/** The (userId, tenantId) of a verified, tenant-matched Better Auth session, or null. */
async function customerFromAuthCookie(): Promise<{ userId: string; tenantId: string } | null> {
  const auth = getAuth();
  if (!auth) return null;
  const requestTenant = await getCurrentTenantId();
  const requestHeaders = await headers();
  // The widened Auth type drops our session/user additionalFields (tenantId), which
  // better-auth populates at runtime — read it through the structural shape.
  const session = (await runWithAuthTenant(requestTenant, () =>
    auth.api.getSession({ headers: requestHeaders }),
  )) as AuthSessionShape | null;
  return customerAuthLookup(session, requestTenant);
}

/** Resolve the current request's customer session, or null when signed out (memoised). */
export const getCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  // 1. Verified Better Auth customer session cookie.
  const lookup = await customerFromAuthCookie();
  if (lookup) {
    const session = await withTenant(getDb(), lookup.tenantId, (tx) =>
      loadCustomerSession(tx as unknown as CustomerUserReader, lookup.userId),
    );
    if (session) return session;
  }
  // 2. Dev override.
  const devUserId = process.env['DEV_CUSTOMER_USER_ID'];
  if (devUserId) {
    const tenantId = await getCurrentTenantId();
    const session = await withTenant(getDb(), tenantId, (tx) =>
      loadCustomerSession(tx as unknown as CustomerUserReader, devUserId),
    );
    if (session) return session;
  }
  // 3. Fail closed — no default customer (unlike the staff dev fallback).
  return null;
});

/** The current customer's user id (UUID), or null when signed out. */
export async function getCustomerUserId(): Promise<string | null> {
  return (await getCustomerSession())?.userId ?? null;
}
