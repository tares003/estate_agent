// EPIC-F property images (FR-F-6) — the gallery read model. Pure query-shaping
// over a STRUCTURAL Prisma client (DB-free to unit-test); the live query runs
// tenant-scoped (RLS) via withTenant. `url` holds the storage KEY — the serving
// URL is minted at render time via signedObjectPath (CLAUDE.md §9 signed-URL
// serving). Sort order is the curated gallery order; exactly one row per listing
// is the isPrimary hero.

/** A gallery image row (the columns the manager + galleries read). */
export interface PropertyImageRow {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  isPrimary: boolean;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PropertyImageReader {
  propertyImage: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
    }): Promise<PropertyImageRow[]>;
  };
}

/** List a listing's gallery in sort order. */
export async function listPropertyImages(
  db: PropertyImageReader,
  propertyId: string,
): Promise<PropertyImageRow[]> {
  return db.propertyImage.findMany({
    where: { propertyId },
    orderBy: { sortOrder: 'asc' },
  });
}
