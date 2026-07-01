// EPIC-T (master spec §C.17) — the account-dashboard summary read model. Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// saved-searches.ts / feedback-alerts.ts); the live queries run tenant-scoped (RLS)
// + user-scoped via withTenant in the /account route. Returns exactly what the
// dashboard landing shows at a glance: the customer's own display name (for the
// greeting) and the counts of their saved properties and saved searches. Counts are
// scoped to the acting `userId`; the name read is additionally pinned to
// `type=customer` so a stray staff id can never resolve a customer greeting.

/** The at-a-glance summary the /account dashboard renders. */
export interface AccountSummary {
  /** The customer's display name (for the greeting), or null when the row is gone. */
  name: string | null;
  /** How many properties the customer has saved to favourites. */
  savedPropertiesCount: number;
  /** How many searches the customer has saved. */
  savedSearchesCount: number;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface AccountSummaryReader {
  user: {
    findFirst(args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<{ name: string } | null>;
  };
  savedProperty: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
  savedSearch: {
    count(args: { where?: Record<string, unknown> }): Promise<number>;
  };
}

/**
 * The acting customer's dashboard summary, scoped to their own `userId` (and the
 * tenant, via the surrounding RLS transaction). The three reads run concurrently;
 * the name read is pinned to `type=customer` so a stray staff id resolves no name.
 * A missing user row yields a null name (the caller renders a generic greeting)
 * rather than throwing — the counts are still meaningful (zero).
 */
export async function getAccountSummary(
  db: AccountSummaryReader,
  userId: string,
): Promise<AccountSummary> {
  const [user, savedPropertiesCount, savedSearchesCount] = await Promise.all([
    db.user.findFirst({ where: { id: userId, type: 'customer' }, select: { name: true } }),
    db.savedProperty.count({ where: { userId } }),
    db.savedSearch.count({ where: { userId } }),
  ]);
  return {
    name: user?.name ?? null,
    savedPropertiesCount,
    savedSearchesCount,
  };
}
