import type { MetadataRoute } from 'next';
import { withTenant } from '@estate/db';
import { listPublishedPages } from './lib/cms.js';
import { getDb } from './lib/db.js';
import { listPropertiesForSitemap, type PropertySitemapReader } from './lib/properties.js';
import {
  isSitemapChildId,
  pageSitemapEntries,
  propertySitemapEntries,
  sitemapIds,
  staticSitemapEntries,
  type SitemapChildId,
} from './lib/sitemap-entries.js';
import { getCurrentTenantId, getRequestOrigin } from './lib/tenant.js';

// EPIC-O sitemap (FR-O-8). `/sitemap.xml` is served as a sitemap *index* (via
// Next's generateSitemaps) pointing at three per-tenant child sitemaps at
// `/sitemap/<id>.xml`: the public static routes, every published property, and
// every published CMS page (FR-D-4: drafts never appear). Each child carries
// last-modified for crawler freshness. Dynamic so it reflects the catalogue +
// CMS at request time and resolves the tenant from the request host.
export const dynamic = 'force-dynamic';

/** Declares the child sitemaps the index lists, served at `/sitemap/<id>.xml`. */
export function generateSitemaps(): Array<{ id: SitemapChildId }> {
  return sitemapIds();
}

/** Load + build one child sitemap. Only the data the requested child needs is read. */
async function buildChild(id: SitemapChildId): Promise<MetadataRoute.Sitemap> {
  const origin = await getRequestOrigin();

  if (id === 'static') {
    return staticSitemapEntries(origin);
  }

  const tenantId = await getCurrentTenantId();

  if (id === 'properties') {
    const properties = await withTenant(getDb(), tenantId, (tx) =>
      listPropertiesForSitemap(tx as unknown as PropertySitemapReader),
    );
    return propertySitemapEntries(properties, origin);
  }

  // id === 'pages'
  const pages = await listPublishedPages(tenantId);
  return pageSitemapEntries(pages, origin);
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  // Next routes `/sitemap/<id>.xml` here; guard against any unknown id rather
  // than throwing so a stray request yields an empty (valid) sitemap.
  if (!isSitemapChildId(id)) {
    return [];
  }
  return buildChild(id);
}
