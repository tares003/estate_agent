import type { MetadataRoute } from 'next';
import { withTenant } from '@estate/db';
import { listPublishedPages } from './lib/cms.js';
import { getDb } from './lib/db.js';
import { listPropertiesForSitemap, type PropertySitemapReader } from './lib/properties.js';
import { getCurrentTenantId, getRequestOrigin } from './lib/tenant.js';

// EPIC-O sitemap (FR-O-8). Per-tenant (resolved from the request host): the
// public static routes, every published property, and every published CMS page
// (FR-D-4: drafts never appear until published), with last-modified for crawler
// freshness. Dynamic so it reflects the catalogue + CMS at request time. A
// sitemap *index* with child sitemaps lands once more public surfaces exist.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getRequestOrigin();
  const tenantId = await getCurrentTenantId();
  const properties = await withTenant(getDb(), tenantId, (tx) =>
    listPropertiesForSitemap(tx as unknown as PropertySitemapReader),
  );
  const pages = await listPublishedPages(tenantId);

  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/properties`, changeFrequency: 'hourly', priority: 0.9 },
    ...properties.map((property) => ({
      url: `${origin}/properties/${property.slug}`,
      lastModified: property.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...pages.map((page) => ({
      url: `${origin}/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
