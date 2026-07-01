import type { PageSection } from '../../../components/blocks/PageRenderer.js';
import { toCardProps, type CatalogueItem, type PropertyRow } from './properties.js';

// EPIC-C C.13 area-guide read model (master spec §C.13 / §J "Area guide"). Pure
// query-shaping over a STRUCTURAL Prisma client (DB-free to unit-test, mirrors
// saved-properties.ts); the live queries run tenant-scoped (RLS) via withTenant
// in the /locations/[slug] route. Only PUBLISHED guides are public (drafts never
// leak), and the guide's page-builder sections feed the same PageRenderer that
// CMS Pages use — each stored section is `{ type, data }` already, so it maps
// straight through (only visible sections, in sort order).

/** A published area guide reduced to what the public page + its SEO need. */
export interface RenderableAreaGuide {
  id: string;
  slug: string;
  name: string;
  introduction: string;
  heroImage: string | null;
  postcodePrefixes: string[];
  latitude: number | null;
  longitude: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** The ordered, visible page-builder sections (ready for the PageRenderer). */
  sections: PageSection[];
}

/** One stored area-guide section row (the columns the renderer needs). */
export interface AreaGuideSectionRow {
  type: string;
  data: unknown;
}

/** The AreaGuide columns the public page reads (a real row satisfies it). */
export interface AreaGuideRow {
  id: string;
  slug: string;
  name: string;
  introduction: string;
  heroImage: string | null;
  postcodePrefixes: string[];
  latitude: number | null;
  longitude: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

/** The structural client the area-guide reads need (a real PrismaClient satisfies it). */
export interface AreaGuideReader {
  areaGuide: {
    findFirst(args: { where?: Record<string, unknown> }): Promise<AreaGuideRow | null>;
  };
  areaGuideSection: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<AreaGuideSectionRow[]>;
  };
}

/**
 * Fetch a single PUBLISHED area guide by slug, with its visible sections in sort
 * order, or null if there is no published guide at that slug. The query runs
 * tenant-scoped (RLS) via withTenant in the route; here the client is structural
 * so it is DB-free to unit-test. Drafts resolve to null (never public).
 */
export async function getPublishedAreaGuideBySlug(
  db: AreaGuideReader,
  slug: string,
): Promise<RenderableAreaGuide | null> {
  const guide = await db.areaGuide.findFirst({
    where: { slug, status: 'published' },
  });
  if (!guide) return null;

  const sectionRows = await db.areaGuideSection.findMany({
    where: { areaGuideId: guide.id, isVisible: true },
    orderBy: { sortOrder: 'asc' },
    select: { type: true, data: true },
  });

  return {
    id: guide.id,
    slug: guide.slug,
    name: guide.name,
    introduction: guide.introduction,
    heroImage: guide.heroImage,
    postcodePrefixes: guide.postcodePrefixes,
    latitude: guide.latitude,
    longitude: guide.longitude,
    metaTitle: guide.metaTitle,
    metaDescription: guide.metaDescription,
    sections: sectionRows.map((row) => ({ type: row.type, data: row.data })),
  };
}

/** One AreaGuide row the locations index reads (a real row satisfies it). */
export interface AreaGuideListRow {
  slug: string;
  name: string;
  introduction: string;
  heroImage: string | null;
}

/** An area-guide card: the fields the locations index renders per guide. */
export interface AreaGuideCard {
  slug: string;
  name: string;
  introduction: string;
  heroImage: string | null;
}

/** The structural client the locations-index read needs (a real PrismaClient satisfies it). */
export interface AreaGuideListReader {
  areaGuide: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<AreaGuideListRow[]>;
  };
}

/**
 * List every PUBLISHED area guide for the locations index (FR-C-8), alphabetical
 * by name. Drafts never appear (the read filters status = published). Returns the
 * card fields the index grid renders — slug, name, introduction (the page renders
 * a snippet) and the optional hero image key. The query runs tenant-scoped (RLS)
 * via withTenant in the /locations route; here the client is structural so it is
 * DB-free to unit-test.
 */
export async function listPublishedAreaGuides(db: AreaGuideListReader): Promise<AreaGuideCard[]> {
  const rows = await db.areaGuide.findMany({
    where: { status: 'published' },
    orderBy: { name: 'asc' },
    select: { slug: true, name: true, introduction: true, heroImage: true },
  });

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    introduction: row.introduction,
    heroImage: row.heroImage,
  }));
}

/** The reader the area-property feed needs (the catalogue's property table). */
export interface AreaPropertyReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<PropertyRow[]>;
  };
}

/** Default number of properties shown on an area guide (master spec §C.13 "most recent N"). */
export const AREA_PROPERTY_LIMIT = 6;

/**
 * The most recent published properties whose postcode begins with one of the
 * guide's configured prefixes (FR-C-9). Each prefix is matched with `startsWith`
 * (an "M20" prefix matches "M20 2QR"), and only published, non-soft-deleted
 * properties are returned, newest-published-first, capped at `limit`. An empty
 * prefix list yields no query (the page renders its empty state). The query runs
 * tenant-scoped (RLS) via withTenant in the route; the client here is structural.
 */
export async function listPropertiesForArea(
  db: AreaPropertyReader,
  postcodePrefixes: readonly string[],
  limit: number = AREA_PROPERTY_LIMIT,
): Promise<CatalogueItem[]> {
  if (postcodePrefixes.length === 0) return [];

  const rows = await db.property.findMany({
    where: {
      publishedAt: { not: null },
      deletedAt: null,
      OR: postcodePrefixes.map((prefix) => ({ postcode: { startsWith: prefix } })),
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  return rows.map((row) => ({ id: row.id, ...toCardProps(row) }));
}

// ── Sitemap read model (EPIC-O FR-O-8 — the `/locations/[slug]` child sitemap).
// The narrowest reader the sitemap touches (slug + last-modified per published
// guide), mirroring properties.ts' listPropertiesForSitemap. Published-only
// (drafts never appear); RLS scopes it in the route via withTenant.

/** Minimal reader for the sitemap (slug + last-modified per published guide). */
export interface AreaGuideSitemapReader {
  areaGuide: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      select?: Record<string, boolean>;
    }): Promise<Array<{ slug: string; updatedAt: Date }>>;
  };
}

/** Published area guides for the sitemap (FR-O-8), newest-modified first. */
export async function listAreaGuidesForSitemap(
  db: AreaGuideSitemapReader,
): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return db.areaGuide.findMany({
    where: { status: 'published' },
    orderBy: { updatedAt: 'desc' },
    select: { slug: true, updatedAt: true },
  });
}
