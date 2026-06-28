import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { listSeoMetadata, type SeoMetadataReader } from '../../../lib/seo-metadata.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { SeoMetadataManager } from './SeoMetadataManager.js';

// EPIC-O FR-O-4 — the per-entity SEO-metadata admin. Gates on `setting.manage` (RBAC
// fail-closed), resolves the tenant, lists the overrides inside the tenant RLS scope,
// and renders the manager (list + add/edit/delete editor). The read model + the editor
// are unit-tested, so this route stays a thin composition. Mirrors the redirects /
// stamp-duty settings pages. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

/** Pretty-print a stored structured-data value as JSON for the editor (empty when none). */
function structuredDataToText(value: unknown): string {
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

export default async function SeoSettingsPage() {
  await requireStaffPermission('setting.manage');

  const tenantId = await getCurrentTenantId();
  const rows = await withTenant(getDb(), tenantId, (tx) =>
    listSeoMetadata(tx as unknown as SeoMetadataReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">SEO</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Control how your pages appear in search results. Set a site-wide default, or override the
          title, description and social image for a single page, property, area guide, blog post or
          branch. Changes are recorded in the audit log.
        </p>
      </div>
      <SeoMetadataManager
        rows={rows.map((row) => ({
          id: row.id,
          scope: row.scope,
          scopeId: row.scopeId,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
          canonicalUrl: row.canonicalUrl,
          ogImage: row.ogImage,
          noIndex: row.noIndex,
          noFollow: row.noFollow,
          structuredData: structuredDataToText(row.structuredData),
        }))}
      />
    </div>
  );
}
