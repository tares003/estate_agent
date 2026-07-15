import type { MetadataRoute } from 'next';
import { withTenant } from '@estate/db';

import { listAreaGuidesForSitemap, type AreaGuideSitemapReader } from './(app)/lib/area-guides.js';
import { listPublishedPostsForSitemap, type BlogPostSitemapReader } from './(app)/lib/blog.js';
import { listPublishedPages } from './(app)/lib/cms.js';
import { getDb } from './(app)/lib/db.js';
import { listPropertiesForSitemap, type PropertySitemapReader } from './(app)/lib/properties.js';
import {
  areaGuideSitemapEntries,
  blogPostSitemapEntries,
  pageSitemapEntries,
  propertySitemapEntries,
  staticSitemapEntries,
} from './(app)/lib/sitemap-entries.js';
import { getCurrentTenantId, getRequestOrigin } from './(app)/lib/tenant.js';

// EPIC-O sitemap (FR-O-8). `/sitemap.xml` lists every public URL for the current
// tenant: the static routes, every published property, every published CMS page, every
// published knowledge-hub post (`/news/[slug]`) and every published area guide
// (`/locations/[slug]`) — drafts never appear (FR-D-4). Each entry carries last-modified
// for crawler freshness. Dynamic so it reflects the catalogue + CMS at request time and
// resolves the tenant from the request host.
//
// This is ONE flat sitemap, deliberately NOT split via Next's `generateSitemaps`. A root
// `sitemap.ts` that exports `generateSitemaps` serves ONLY the children at
// `/sitemap/<id>.xml` — Next 16 emits no bare `/sitemap.xml` route for it (confirmed
// against a production build: the route manifest has `/sitemap/[__metadata_id__]` but no
// `/sitemap.xml`, and `next start` returns 500 for `/sitemap.xml` as it falls through to
// the CMS catch-all). That is the exact URL `robots.ts` advertises to crawlers, so the
// split form left the advertised sitemap broken. A single default export IS served at
// `/sitemap.xml`. The 50k-URL sitemap limit is far off at the current tenant scale; if a
// tenant ever approaches it, reintroduce `generateSitemaps` together with a real index
// route so `/sitemap.xml` keeps serving.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await getRequestOrigin();
  // The static public routes need no tenant or DB and must always be present.
  const entries: MetadataRoute.Sitemap = [...staticSitemapEntries(origin)];

  // Everything below is tenant-scoped and best-effort: a failure (an unresolved tenant, a
  // transient DB error, a dormant Payload) omits that section rather than 500ing the whole
  // file. A crawler treats a 500 sitemap as a hard failure, so a partial sitemap — the
  // static routes plus whatever else loaded — is strictly better than none.
  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch {
    // No tenant resolved for this request — serve the static routes only.
    return entries;
  }

  const db = getDb();
  try {
    const [properties, posts, guides] = await Promise.all([
      withTenant(db, tenantId, (tx) =>
        listPropertiesForSitemap(tx as unknown as PropertySitemapReader),
      ),
      withTenant(db, tenantId, (tx) =>
        listPublishedPostsForSitemap(tx as unknown as BlogPostSitemapReader),
      ),
      withTenant(db, tenantId, (tx) =>
        listAreaGuidesForSitemap(tx as unknown as AreaGuideSitemapReader),
      ),
    ]);
    entries.push(...propertySitemapEntries(properties, origin));
    entries.push(...blogPostSitemapEntries(posts, origin));
    entries.push(...areaGuideSitemapEntries(guides, origin));
  } catch {
    // DB unavailable — keep the static routes already collected.
  }

  // CMS pages come from Payload's Local API, guarded separately because Payload is dormant
  // in local dev (PAYLOAD_SECRET unset) and would otherwise fail the whole file.
  try {
    const pages = await listPublishedPages(tenantId);
    entries.push(...pageSitemapEntries(pages, origin));
  } catch {
    // Payload unavailable — omit the CMS pages, keep everything else.
  }

  return entries;
}
