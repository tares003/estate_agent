// EPIC-T — resolving a customer's session from their user record. Pure mapping +
// a structural read (DB-free to unit-test), mirroring the staff-user seam. The live
// lookup runs tenant-scoped (RLS already isolates users) via withTenant in the
// customer-session seam. Only a `type=customer` row resolves: a staff row (or no
// row) yields null, so the customer gates can never honour a staff identity. The
// verified-email flag is carried through unchanged; the FR-T-2 gate decides on it.

/** The customer-user columns the session needs. */
export interface CustomerUserRow {
  id: string;
  /** `customer` for an account holder; `staff` for a back-office user (rejected). */
  type: string;
  /** Whether the customer has verified their email (null treated as not verified). */
  emailVerified: boolean | null;
}

/** The structural client the resolver needs (a real PrismaClient satisfies it). */
export interface CustomerUserReader {
  user: {
    findFirst(args: { where: Record<string, unknown> }): Promise<CustomerUserRow | null>;
  };
}

/** The resolved customer session used by the save gates + audit actor. */
export interface CustomerSession {
  /** The customer user id (for FK columns). */
  userId: string;
  /** Whether the customer's email is verified (FR-T-2 save gate). */
  emailVerified: boolean;
  /** The audit actor string (`customer:<id>`). */
  actor: string;
}

/**
 * Map a customer user row to a session, or null when the row is NOT a customer
 * (a staff identity must never satisfy a customer gate). A null email-verified
 * column is coerced to `false` — fail-closed for the FR-T-2 gate.
 */
export function customerSessionFromUser(user: CustomerUserRow): CustomerSession | null {
  if (user.type !== 'customer') return null;
  return {
    userId: user.id,
    emailVerified: user.emailVerified === true,
    actor: `customer:${user.id}`,
  };
}

/**
 * Load + resolve the customer session for `userId` (null if no such user in the
 * tenant, or the user is staff rather than a customer).
 */
export async function loadCustomerSession(
  db: CustomerUserReader,
  userId: string,
): Promise<CustomerSession | null> {
  const user = await db.user.findFirst({ where: { id: userId, type: 'customer' } });
  return user ? customerSessionFromUser(user) : null;
}
