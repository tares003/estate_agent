import type { Metadata } from 'next';
import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { loadSdltConfig, type SdltConfigReader } from '../../../lib/sdlt-config.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';
import { StampDutyCalculator } from './StampDutyCalculator.js';

// EPIC-W stamp-duty calculator page (FR-W-1/2/4). Server Component shell —
// metadata (FR-O-4) + heading — around the client calculator, which computes
// indicatively in the browser (PRODUCT.md §9, not financial advice). Loads the
// tenant's admin-configured SDLT bands (FR-W-3) inside the tenant RLS scope and
// passes them to the calculator (it falls back to the engine default when unset).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/calculators/stamp-duty`;
  const title = 'Stamp duty calculator';
  const description =
    'Estimate the indicative Stamp Duty (SDLT) on a residential purchase by price and buyer type. For guidance only — not financial advice.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function StampDutyCalculatorPage() {
  const tenantId = await getCurrentTenantId();
  const config = await withTenant(getDb(), tenantId, (tx) =>
    loadSdltConfig(tx as unknown as SdltConfigReader),
  );

  return (
    <main id="main" className="container py-12">
      <header className="flex flex-col gap-2">
        <h1 className="t-display-sm">Stamp duty calculator</h1>
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          Estimate the indicative Stamp Duty on a residential purchase. Enter the price and choose
          your buyer category.
        </p>
      </header>
      <div className="mt-8">
        <StampDutyCalculator config={config} />
      </div>
    </main>
  );
}
