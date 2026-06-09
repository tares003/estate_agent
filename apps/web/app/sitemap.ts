import type { MetadataRoute } from 'next';
import { withTenant } from '@estate/db';
import { getDb } from './lib/db.js';
import { listPropertiesForSitemap, type PropertySitemapReader } from './lib/properties.js';
import { getCurrentTenantId, getRequestOrigin } from './lib/tenant.js';

// EPIC-O sitemap (FR-O-8). Per-tenant (resolved from the request host): the
// public static routes plus every published property, with last-modified for
// crawler freshness. Dynamic so it reflects the catalogue at request time. A
// sitemap *index* with child sitemaps lands once more public surfaces (news,
// area guides, team) exist; for now properties are the catalogue.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getRequestOrigin();
  const tenantId = await getCurrentTenantId();
  const properties = await withTenant(getDb(), tenantId, (tx) =>
    listPropertiesForSitemap(tx as unknown as PropertySitemapReader),
  );

  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/properties`, changeFrequency: 'hourly', priority: 0.9 },
    ...properties.map((property) => ({
      url: `${origin}/properties/${property.slug}`,
      lastModified: property.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
