import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';

import { PageRenderer } from '../../../components/blocks/PageRenderer.js';
import { getPublishedPage } from '../lib/cms.js';
import { getDb } from '../lib/db.js';
import { truncate } from '../lib/seo.js';
import { getSeoMetadata, type SeoMetadataReader } from '../lib/seo-metadata.js';
import { applySeoOverride } from '../lib/seo-override.js';
import { getCurrentTenantId, getRequestOrigin } from '../lib/tenant.js';

/**
 * EPIC-O FR-O-4 — metadata for a CMS-managed page. Builds the default from the
 * page title + its own canonical URL, then applies the tenant-wide `default` SEO
 * override when one exists (an override value wins). Payload pages carry an
 * integer id, not the UUID the per-entity `page`-scope `scopeId` column requires,
 * so only the tenant-wide default is addressable here — a per-page override needs
 * a UUID page key (out of this batch's scope). The override resolve runs
 * tenant-scoped (RLS) via withTenant.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join('/');
  const tenantId = await getCurrentTenantId();
  const page = await getPublishedPage(path, tenantId);
  if (!page) return { title: 'Page not found' };

  const origin = await getRequestOrigin();
  const url = `${origin}/${page.slug}`;
  const title = truncate(page.title, 60);

  const base: Metadata = {
    title,
    alternates: { canonical: url },
    openGraph: { title, url, type: 'website' },
    twitter: { card: 'summary_large_image', title },
  };

  const override = await withTenant(getDb(), tenantId, (tx) =>
    getSeoMetadata(tx as unknown as SeoMetadataReader, 'default', null),
  );
  return applySeoOverride(base, override);
}

// EPIC-D catch-all for CMS-managed editorial pages (FR-D-1). Resolves the path to
// a published page for the current tenant and renders its sections via the shared
// PageRenderer; specific routes (/, /properties, …) take precedence over this
// catch-all. Drafts and other tenants' pages resolve to a 404 (getPublishedPage
// filters by tenant + _status: published).
export default async function CmsPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const tenantId = await getCurrentTenantId();
  const page = await getPublishedPage(slug.join('/'), tenantId);

  if (!page) {
    notFound();
  }

  return (
    <main id="main">
      <PageRenderer sections={page.sections} />
    </main>
  );
}
