import { isStaffRole, type StaffRole } from '@estate/auth';

// EPIC-N — resolving a staff member's session from their user record. Pure mapping +
// a structural read (DB-free to unit-test); the live lookup runs tenant-scoped (RLS
// already isolates users) via withTenant in the staff-session seam. Only a
// `type=staff` row resolves: a customer row (or any other type, or no row) yields
// null, mirroring the customer seam's rejection of staff rows (customer-user.ts) —
// audit finding staff-seam-missing-customer-type-check. The role stored on the user
// is validated against the canonical catalogue and FAILS SAFE to the
// least-privilege role, so a corrupt/unknown role can never escalate access.

/** The staff-user columns the session needs. */
export interface StaffUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  /** `staff` for a back-office user; `customer` (or anything else) is rejected. */
  type: string;
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

/**
 * Map a staff user row to a session, or null when the row is NOT staff (a
 * customer identity must never satisfy a staff gate — even read_only_auditor
 * grants every `.read` permission). An unrecognised role fails safe to least
 * privilege.
 */
export function staffSessionFromUser(user: StaffUserRow): StaffSession | null {
  if (user.type !== 'staff') return null;
  const role: StaffRole = isStaffRole(user.role) ? user.role : 'read_only_auditor';
  return { userId: user.id, role, actor: `agent:${user.id}` };
}

/**
 * Load + resolve the staff session for `userId` (null if no such STAFF user in
 * the tenant — the WHERE carries the type filter as belt to the mapper's braces).
 */
export async function loadStaffSession(
  db: StaffUserReader,
  userId: string,
): Promise<StaffSession | null> {
  const user = await db.user.findFirst({ where: { id: userId, type: 'staff' } });
  return user ? staffSessionFromUser(user) : null;
}
