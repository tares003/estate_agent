import type { Metadata } from 'next';
import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import {
  listVisibleRepairCategories,
  repairCategoryOptions,
  type RepairCategoryReader,
} from '../../lib/repair-categories.js';
import { getCurrentTenantId, getRequestOrigin } from '../../lib/tenant.js';
import { RepairForm } from './RepairForm.js';

// EPIC-G tenant repair-report page (PRODUCT.md §4 — "Report a repair", FR-G-1).
// Server Component shell around the client form; reads the tenant's visible repair
// categories (§G.3 dropdown — falls back to the §G.3 defaults before an admin
// customises the catalogue) inside the tenant (RLS) scope and passes them down.
// The repair flow is in the `core` pack — every tenant gets it, no entitlement gate.

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/report-a-repair`;
  const title = 'Report a repair';
  const description =
    'Report a maintenance issue at your rented property and the agent’s repairs team will be in touch.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ReportRepairPage() {
  const tenantId = await getCurrentTenantId();
  const categories = await withTenant(getDb(), tenantId, (tx) =>
    listVisibleRepairCategories(tx as unknown as RepairCategoryReader),
  );

  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">Report a repair</h1>
      <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">
        Let us know what needs fixing at your property and the repairs team will pick it up.
      </p>
      <div className="mt-8 max-w-[40rem]">
        <RepairForm categories={repairCategoryOptions(categories)} />
      </div>
    </main>
  );
}
