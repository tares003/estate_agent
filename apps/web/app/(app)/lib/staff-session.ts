import { cache } from 'react';
import { requirePermission, type Permission, type StaffRole } from '@estate/auth';
import { withTenant } from '@estate/db';

import { getDb } from './db.js';
import { loadStaffSession, type StaffSession, type StaffUserReader } from './staff-user.js';
import { getCurrentTenantId } from './tenant.js';

// The staff-session seam (EPIC-N). Resolves the acting staff member's session — the
// audit actor, the RBAC role, the user id — and gates state-changing admin actions.
//
// Resolution order:
//   1. A configured dev session: `DEV_STAFF_USER_ID` names a real staff user; the
//      seam loads them tenant-scoped and uses their stored role (validated, fail-safe
//      to least privilege). This is the dev-login until the Better Auth staff session
//      cookie is wired (TODO below) — set it to act as any seeded staff member and
//      see RBAC enforce that role.
//   2. The DEV FALLBACK: a super-admin, so local dev without a configured user keeps
//      the admin exercisable.
//
// Glue (reads env / the DB / — later — the session cookie) — excluded from unit
// coverage; callers mock it. The pure resolution lives in staff-user.ts + @estate/auth.

// TODO(EPIC-N): replace the DEV_STAFF_USER_ID lookup with the Better Auth staff
// session — read the signed session cookie (it carries the staff user + tenant),
// then `loadStaffSession` for that user. OAuth / magic-link / WebAuthn sign-in is the
// follow-on (needs provider credentials).
const DEV_FALLBACK: StaffSession = {
  userId: null,
  role: 'super_admin',
  actor: 'agent:dev-staff',
};

/** Resolve the current request's staff session (memoised per request). */
const getStaffSession = cache(async (): Promise<StaffSession> => {
  const devUserId = process.env['DEV_STAFF_USER_ID'];
  if (devUserId) {
    const tenantId = await getCurrentTenantId();
    const session = await withTenant(getDb(), tenantId, (tx) =>
      loadStaffSession(tx as unknown as StaffUserReader, devUserId),
    );
    if (session) return session;
  }
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
