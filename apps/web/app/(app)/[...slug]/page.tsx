import { notFound } from 'next/navigation';

import { PageRenderer } from '../../../components/blocks/PageRenderer.js';
import { getPublishedPage } from '../lib/cms.js';
import { getCurrentTenantId } from '../lib/tenant.js';

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
