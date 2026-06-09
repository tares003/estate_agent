import type { MetadataRoute } from 'next';
import { getRequestOrigin } from './lib/tenant.js';

// EPIC-O robots (FR-O-9): allow the public site, disallow the admin / account /
// API / preview surfaces, and point crawlers at the sitemap. Dynamic so the
// sitemap URL reflects the requesting tenant's host.
export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getRequestOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/api/', '/preview/'],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
