// EPIC-O FR-O-11 — the managed redirect-rules read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors saved-properties.ts /
// feedback-queue.ts); the live queries run tenant-scoped (RLS) via withTenant. Two
// reads: `listRedirects` for the admin table (newest first), and
// `findActiveRedirect` — the exact-path lookup the proxy consults on every request to
// decide whether an incoming path should redirect.

/** A redirect rule row shown in the admin table. */
export interface RedirectRow {
  id: string;
  sourcePath: string;
  destinationPath: string;
  type: string;
  hitCount: number;
  lastHitAt: Date | null;
}

/** The minimal shape `findActiveRedirect` returns (what the proxy needs to act). */
export interface ActiveRedirect {
  id: string;
  destinationPath: string;
  type: string;
}

/** Minimal read surface the list + lookup need (a Prisma tx satisfies it). */
export interface RedirectReader {
  redirect: {
    findMany(args: { orderBy?: unknown; take?: number }): Promise<RedirectRow[]>;
    findFirst(args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }): Promise<ActiveRedirect | null>;
  };
}

/** The most rules to load into the admin table at once. */
const MAX_ROWS = 500;

/**
 * The tenant's redirect rules, newest-created first, for the admin table. Tenant
 * scoping is applied by the caller (withTenant — RLS); this just shapes the query.
 */
export async function listRedirects(reader: RedirectReader): Promise<RedirectRow[]> {
  return reader.redirect.findMany({ orderBy: { createdAt: 'desc' }, take: MAX_ROWS });
}

/**
 * The active redirect rule for an exact incoming path, or null if there is none.
 * An exact-path match (FR-O-11 — wildcard matching is a later refinement); the
 * caller (the proxy) applies the status + destination. Returns only the fields the
 * proxy needs. Tenant scoping is applied by the caller (withTenant — RLS).
 */
export async function findActiveRedirect(
  reader: RedirectReader,
  sourcePath: string,
): Promise<ActiveRedirect | null> {
  return reader.redirect.findFirst({
    where: { sourcePath },
    select: { id: true, destinationPath: true, type: true },
  });
}
