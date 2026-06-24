import { toCardProps, type CatalogueItem, type PropertyRow } from './properties.js';

// EPIC-T FR-T-5/6 — the saved-properties read model. Pure query-shaping over a
// STRUCTURAL Prisma client (DB-free to unit-test, mirrors users.ts); the live
// queries run tenant-scoped (RLS) via withTenant in the /account/saved route. The
// saved rows are ordered newest-first; the catalogue join preserves that order and
// drops any property that is no longer visible (unpublished / soft-deleted), so a
// stale favourite never renders a broken card.

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface SavedPropertyReader {
  savedProperty: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<Array<{ propertyId: string }>>;
  };
  property: {
    findMany(args: { where?: Record<string, unknown> }): Promise<PropertyRow[]>;
  };
}

/** The saved list plus the set of saved ids (for marking each card's heart). */
export interface SavedPropertiesResult {
  items: CatalogueItem[];
  savedIds: Set<string>;
}

/**
 * The set of property ids (from `candidateIds`) the user has currently saved.
 * Used to mark the heart on catalogue / detail surfaces. Skips the query entirely
 * when there are no candidates (an empty page never needs to ask the DB).
 */
export async function savedPropertyIdsFor(
  db: SavedPropertyReader,
  userId: string,
  candidateIds: string[],
): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const rows = await db.savedProperty.findMany({
    where: { userId, propertyId: { in: candidateIds } },
    select: { propertyId: true },
  });
  return new Set(rows.map((row) => row.propertyId));
}

/**
 * The current customer's saved properties, newest-saved-first, mapped to
 * PropertyCard props. Only published, non-deleted properties are returned (a
 * favourite whose listing has since been withdrawn drops out). `savedIds` carries
 * every id the join surfaced so each rendered card's heart shows as saved.
 */
export async function listSavedProperties(
  db: SavedPropertyReader,
  userId: string,
): Promise<SavedPropertiesResult> {
  const saved = await db.savedProperty.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { propertyId: true },
  });
  if (saved.length === 0) return { items: [], savedIds: new Set() };

  const orderedIds = saved.map((row) => row.propertyId);
  const rows = await db.property.findMany({
    where: { id: { in: orderedIds }, publishedAt: { not: null }, deletedAt: null },
  });

  // Index the fetched rows so we can re-emit them in the saved-newest-first order
  // the catalogue query does not itself guarantee.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items: CatalogueItem[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (row) items.push({ id: row.id, ...toCardProps(row) });
  }
  return { items, savedIds: new Set(rows.map((row) => row.id)) };
}
