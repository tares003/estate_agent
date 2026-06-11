import { variantKey } from '@estate/storage';

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
  /** Set by the FR-F-7 post-process job; null = unprocessed, 0 = poisoned. */
  width: number | null;
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

/** A listing's hero image (the columns the catalogue card needs). */
export interface HeroImageRow {
  propertyId: string;
  url: string;
  alt: string;
  /** Set by the FR-F-7 post-process job; null = unprocessed, 0 = poisoned. */
  width: number | null;
}

/** The structural client the hero join needs. */
export interface HeroImageReader {
  propertyImage: {
    findMany(args: { where?: Record<string, unknown> }): Promise<HeroImageRow[]>;
  };
}

/** The hero image per listing for a page of listing ids (no query when empty). */
export async function listHeroImages(
  db: HeroImageReader,
  propertyIds: readonly string[],
): Promise<HeroImageRow[]> {
  if (propertyIds.length === 0) return [];
  return db.propertyImage.findMany({
    where: { propertyId: { in: [...propertyIds] }, isPrimary: true },
  });
}

/**
 * The storage key a gallery surface should serve for an image: the FR-F-7
 * rendition once the post-process job has marked the row (`width > 0`), the
 * original otherwise (unprocessed rows have no variants yet; poisoned rows —
 * width 0 — never will).
 */
export function renditionKeyFor(
  image: { url: string; width: number | null },
  variant: 'thumb' | 'large',
): string {
  return image.width !== null && image.width > 0 ? variantKey(image.url, variant) : image.url;
}
