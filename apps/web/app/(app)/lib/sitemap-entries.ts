import type { MetadataRoute } from 'next';

// EPIC-O sitemap entry builders (FR-O-8). Pure, DB-free functions that turn an
// origin + the per-tenant data into sitemap URL entries — no React, no headers,
// no Prisma — so they unit-test in isolation and the route stays a thin loader.
// The route splits these across child sitemaps via Next's generateSitemaps so
// `/sitemap.xml` is served as a sitemap *index* pointing at `/sitemap/<id>.xml`.

/** One sitemap URL entry (Next's MetadataRoute.Sitemap element). */
export type SitemapEntry = MetadataRoute.Sitemap[number];

/** A published property reduced to what the sitemap needs. */
export interface SitemapPropertyEntry {
  slug: string;
  updatedAt: Date;
}

/** A published CMS page reduced to what the sitemap needs. */
export interface SitemapPageEntry {
  slug: string;
  updatedAt: Date;
}

/** A published knowledge-hub post reduced to what the sitemap needs. */
export interface SitemapBlogPostEntry {
  slug: string;
  updatedAt: Date;
}

/** A published area guide reduced to what the sitemap needs. */
export interface SitemapAreaGuideEntry {
  slug: string;
  updatedAt: Date;
}

/**
 * The child sitemap ids the index points at, in order (FR-O-8). A `static` child
 * for the hand-maintained public routes, `properties` for the catalogue, `pages`
 * for the CMS-managed pages, `blog` for the published knowledge-hub posts, and
 * `areas` for the published area guides — kept separate so each list can grow
 * toward Google's 50k-URL-per-file limit independently.
 */
export const SITEMAP_CHILD_IDS = ['static', 'properties', 'pages', 'blog', 'areas'] as const;

/** A child sitemap id (`'static' | 'properties' | 'pages' | 'blog' | 'areas'`). */
export type SitemapChildId = (typeof SITEMAP_CHILD_IDS)[number];

/** The `{ id }` objects Next's `generateSitemaps()` returns to build the index. */
export function sitemapIds(): Array<{ id: SitemapChildId }> {
  return SITEMAP_CHILD_IDS.map((id) => ({ id }));
}

/** Narrow an arbitrary string (Next resolves the route param) to a known child id. */
export function isSitemapChildId(id: string): id is SitemapChildId {
  return (SITEMAP_CHILD_IDS as readonly string[]).includes(id);
}

/**
 * The public, indexable static routes (master spec §C / §O): the home page, the
 * catalogue, the calculators (and their two landing pages), and the conversion
 * landing pages. Token-gated / noindex surfaces (feedback links, the contractor
 * portal, viewing confirmations) are deliberately excluded.
 */
export function staticSitemapEntries(origin: string): SitemapEntry[] {
  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/properties`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${origin}/calculators`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/calculators/mortgage`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/calculators/stamp-duty`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/valuation`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/report-a-repair`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${origin}/news`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${origin}/locations`, changeFrequency: 'weekly', priority: 0.7 },
  ];
}

/** One daily, priority-0.8 entry per published property, preserving last-modified. */
export function propertySitemapEntries(
  properties: readonly SitemapPropertyEntry[],
  origin: string,
): SitemapEntry[] {
  return properties.map((property) => ({
    url: `${origin}/properties/${property.slug}`,
    lastModified: property.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }));
}

/** One weekly, priority-0.6 entry per published CMS page, preserving last-modified. */
export function pageSitemapEntries(
  pages: readonly SitemapPageEntry[],
  origin: string,
): SitemapEntry[] {
  return pages.map((page) => ({
    url: `${origin}/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}

/**
 * One weekly, priority-0.6 entry per published knowledge-hub post under
 * `/news/{slug}`, preserving last-modified (master spec §C.14 / FR-O-8).
 */
export function blogPostSitemapEntries(
  posts: readonly SitemapBlogPostEntry[],
  origin: string,
): SitemapEntry[] {
  return posts.map((post) => ({
    url: `${origin}/news/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
}

/**
 * One weekly, priority-0.7 entry per published area guide under
 * `/locations/{slug}`, preserving last-modified (master spec §C.13 / FR-O-8).
 * Guides sit slightly above blog posts (0.7) as evergreen local-SEO landing pages.
 */
export function areaGuideSitemapEntries(
  guides: readonly SitemapAreaGuideEntry[],
  origin: string,
): SitemapEntry[] {
  return guides.map((guide) => ({
    url: `${origin}/locations/${guide.slug}`,
    lastModified: guide.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
}
