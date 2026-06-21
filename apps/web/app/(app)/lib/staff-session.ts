import { cache } from 'react';
import { headers } from 'next/headers';
import { requirePermission, type Permission, type StaffRole } from '@estate/auth';
import { runWithAuthTenant, withTenant } from '@estate/db';

import { getAuth } from './auth.js';
import { getDb } from './db.js';
import { staffAuthLookup, type AuthSessionShape } from './staff-session-resolve.js';
import { loadStaffSession, type StaffSession, type StaffUserReader } from './staff-user.js';
import { getCurrentTenantId } from './tenant.js';

// The staff-session seam (EPIC-N). Resolves the acting staff member's session — the
// audit actor, the RBAC role, the user id — and gates state-changing admin actions.
//
// Resolution order:
//   1. A verified Better Auth session cookie (production): getSession reads the
//      signed cookie (carrying the staff user + tenant); staffAuthLookup accepts it
//      only when its tenant equals the request's resolved tenant (no cross-tenant
//      replay), then the staff user is re-loaded tenant-scoped and their stored role
//      validated. getSession runs inside runWithAuthTenant so the BYPASSRLS auth
//      adapter (B78a) scopes the user read to that tenant.
//   2. A configured dev session: `DEV_STAFF_USER_ID` names a real staff user (local
//      dev without sign-in) — load them tenant-scoped, use their stored role.
//   3. The DEV FALLBACK: a super-admin, so local dev without any config keeps the
//      admin exercisable. (Production has BETTER_AUTH_SECRET set and never reaches
//      the fallback for an unauthenticated request — an admin gate elsewhere denies.)
//
// Glue (reads env / the DB / the session cookie) — excluded from unit coverage;
// callers mock it. The pure pieces live in staff-session-resolve.ts (tenant match),
// staff-user.ts (role validation) + @estate/auth (RBAC).
const DEV_FALLBACK: StaffSession = {
  userId: null,
  role: 'super_admin',
  actor: 'agent:dev-staff',
};

/** The (userId, tenantId) of a verified, tenant-matched Better Auth session, or null. */
async function staffFromAuthCookie(): Promise<{ userId: string; tenantId: string } | null> {
  const auth = getAuth();
  if (!auth) return null;
  const requestTenant = await getCurrentTenantId();
  const requestHeaders = await headers();
  // The widened Auth type drops our session/user additionalFields (tenantId), which
  // better-auth populates at runtime — read it through the structural shape.
  const session = (await runWithAuthTenant(requestTenant, () =>
    auth.api.getSession({ headers: requestHeaders }),
  )) as AuthSessionShape | null;
  return staffAuthLookup(session, requestTenant);
}

/** Resolve the current request's staff session (memoised per request). */
const getStaffSession = cache(async (): Promise<StaffSession> => {
  // 1. Verified Better Auth staff session cookie.
  const lookup = await staffFromAuthCookie();
  if (lookup) {
    const session = await withTenant(getDb(), lookup.tenantId, (tx) =>
      loadStaffSession(tx as unknown as StaffUserReader, lookup.userId),
    );
    if (session) return session;
  }
  // 2. Dev override.
  const devUserId = process.env['DEV_STAFF_USER_ID'];
  if (devUserId) {
    const tenantId = await getCurrentTenantId();
    const session = await withTenant(getDb(), tenantId, (tx) =>
      loadStaffSession(tx as unknown as StaffUserReader, devUserId),
    );
    if (session) return session;
  }
  // 3. Dev fallback.
  return DEV_FALLBACK;
});

/** The current staff member's RBAC role. */
export async function getStaffRole(): Promise<StaffRole> {
  return (await getStaffSession()).role;
}

/** The current staff member's audit actor string (`agent:<id>`). */
export async function getStaffActor(): Promise<string> {
  return (await getStaffSession()).actor;
}

/** The current staff member's user id (UUID) for FK columns; null for the dev fallback. */
export async function getStaffUserId(): Promise<string | null> {
  return (await getStaffSession()).userId;
}

/** RBAC gate: throws `PermissionError` if the current staff role lacks `permission`. */
export async function requireStaffPermission(permission: Permission): Promise<void> {
  requirePermission((await getStaffSession()).role, permission);
}
