import type { AlertFrequency, PropertySearch } from '@estate/validators';

// EPIC-T FR-T-8 — the saved-searches read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors saved-properties.ts); the
// live query runs tenant-scoped (RLS) + user-scoped via withTenant in the
// /account/searches route. The list is newest-first so a customer's most recent
// search sits at the top of their management list.

/** A saved-search row as the management list needs it. */
export interface SavedSearchRow {
  id: string;
  name: string;
  /** The persisted catalogue filter object (the /properties URL filter shape). */
  filters: PropertySearch;
  /** The alert cadence (off / instant / daily / weekly). */
  alertFrequency: AlertFrequency;
  createdAt: Date;
}

/** The raw shape Prisma returns (filters is opaque JSON until we narrow it). */
interface SavedSearchRecord {
  id: string;
  name: string;
  filters: unknown;
  alertFrequency: AlertFrequency;
  createdAt: Date;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface SavedSearchReader {
  savedSearch: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<SavedSearchRecord[]>;
  };
}

/**
 * Narrow the opaque `filters` JSON to a {@link PropertySearch}. The value was
 * written by `savedSearchCreateSchema` (which normalises through the catalogue
 * schema), so at rest it is already the catalogue filter shape; the cast records
 * that contract for the renderer without re-parsing on every read.
 */
function toFilters(value: unknown): PropertySearch {
  return (value ?? {}) as PropertySearch;
}

/**
 * The current customer's saved searches, newest-first. Scoped to `userId` (and the
 * tenant, via the surrounding RLS transaction). The returned filters are typed as
 * the catalogue {@link PropertySearch} so the row can render its criteria summary
 * and link back to /properties with the saved filters re-applied.
 */
export async function listSavedSearches(
  db: SavedSearchReader,
  userId: string,
): Promise<SavedSearchRow[]> {
  const rows = await db.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      filters: true,
      alertFrequency: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    filters: toFilters(row.filters),
    alertFrequency: row.alertFrequency,
    createdAt: row.createdAt,
  }));
}
