import { isStaffRole, type StaffRole } from '@estate/auth';

// EPIC-N — resolving a staff member's session from their user record. Pure mapping +
// a structural read (DB-free to unit-test); the live lookup runs tenant-scoped (RLS
// already isolates users) via withTenant in the staff-session seam. The role stored
// on the user is validated against the canonical catalogue and FAILS SAFE to the
// least-privilege role, so a corrupt/unknown role can never escalate access.

/** The staff-user columns the session needs. */
export interface StaffUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** The structural client the resolver needs (a real PrismaClient satisfies it). */
export interface StaffUserReader {
  user: {
    findFirst(args: { where: Record<string, unknown> }): Promise<StaffUserRow | null>;
  };
}

/** The resolved staff session used by the RBAC gate + audit actor. */
export interface StaffSession {
  /** The staff user id (for FK columns); null only for the dev fallback. */
  userId: string | null;
  role: StaffRole;
  /** The audit actor string (`agent:<id>`). */
  actor: string;
}

/** Map a staff user row to a session; an unrecognised role fails safe to least privilege. */
export function staffSessionFromUser(user: StaffUserRow): StaffSession {
  const role: StaffRole = isStaffRole(user.role) ? user.role : 'read_only_auditor';
  return { userId: user.id, role, actor: `agent:${user.id}` };
}

/** Load + resolve the staff session for `userId` (null if no such user in the tenant). */
export async function loadStaffSession(
  db: StaffUserReader,
  userId: string,
): Promise<StaffSession | null> {
  const user = await db.user.findFirst({ where: { id: userId } });
  return user ? staffSessionFromUser(user) : null;
}
