// EPIC-T FR-T-11 — the customer-profile read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors saved-searches.ts); the
// live query runs tenant-scoped (RLS) + user-scoped via withTenant in the
// /account/profile route. Reads only the profile-editable fields the form
// prefills (name, phone, contact preferences, marketing opt-in) for the acting
// customer's OWN user row, so the page never over-fetches the rest of the record.

/** The profile fields the /account/profile form prefills + edits. */
export interface CustomerProfile {
  name: string;
  /** The optional contact phone (null when the customer has not set one). */
  phone: string | null;
  /** Whether the agency may contact the customer by email about their account. */
  contactByEmail: boolean;
  /** Whether the agency may contact the customer by SMS about their account. */
  contactBySms: boolean;
  /** The marketing opt-in (separate from the account-contact preferences). */
  marketingOptIn: boolean;
}

/** The raw shape Prisma returns for the selected profile columns. */
interface CustomerProfileRecord {
  name: string;
  phone: string | null;
  contactByEmail: boolean;
  contactBySms: boolean;
  marketingOptIn: boolean;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface CustomerProfileReader {
  user: {
    findFirst(args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<CustomerProfileRecord | null>;
  };
}

/**
 * The acting customer's editable profile, scoped to their own `userId` (and the
 * tenant, via the surrounding RLS transaction) and to `type=customer` so a stray
 * staff id can never resolve. Returns null when no such customer row exists.
 */
export async function getCustomerProfile(
  db: CustomerProfileReader,
  userId: string,
): Promise<CustomerProfile | null> {
  const row = await db.user.findFirst({
    where: { id: userId, type: 'customer' },
    select: {
      name: true,
      phone: true,
      contactByEmail: true,
      contactBySms: true,
      marketingOptIn: true,
    },
  });
  if (!row) return null;
  return {
    name: row.name,
    phone: row.phone,
    contactByEmail: row.contactByEmail,
    contactBySms: row.contactBySms,
    marketingOptIn: row.marketingOptIn,
  };
}
