import { requirePermission, type Permission, type StaffRole } from '@estate/auth';

// The staff-session seam (EPIC-I uses it; EPIC-N owns it). Resolves the acting
// staff member's audit actor + role and RBAC-gates admin actions. Better Auth
// staff sessions land with EPIC-N — until then this is a documented DEV STUB
// (a super-admin so the admin surfaces are exercisable in dev). Glue (reads the
// session/env once wired) — excluded from unit coverage; callers mock it.

// TODO(EPIC-N): resolve these from the Better Auth session cookie.
const DEV_STAFF_ROLE: StaffRole = 'super_admin';
const DEV_STAFF_ACTOR = 'agent:dev-staff';

/** The current staff member's RBAC role. */
export async function getStaffRole(): Promise<StaffRole> {
  return DEV_STAFF_ROLE;
}

/** The current staff member's audit actor string (`agent:<slug>`). */
export async function getStaffActor(): Promise<string> {
  return DEV_STAFF_ACTOR;
}

/** RBAC gate: throws `PermissionError` if the current staff role lacks `permission`. */
export async function requireStaffPermission(permission: Permission): Promise<void> {
  requirePermission(await getStaffRole(), permission);
}
