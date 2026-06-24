import type { Metadata } from 'next';
import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import {
  loadMortgageRateConfig,
  type MortgageRateConfigReader,
} from '../../../lib/mortgage-rate-config.js';
import {
  loadMortgageRatePresets,
  type MortgageRatePresetReader,
} from '../../../lib/mortgage-rate-presets.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';
import { MortgageCalculator } from './MortgageCalculator.js';

// EPIC-W mortgage calculator page (FR-W-5/6/7/8). A Server Component shell — metadata
// (FR-O-4) + heading — around the client calculator, which computes indicatively
// in the browser (PRODUCT.md §9, not financial advice). Loads the tenant's admin-
// configured mortgage defaults (FR-W-7) and rate presets (FR-W-8) inside the tenant
// RLS scope and passes them to the calculator (it falls back to the engine default
// when no config is stored, and renders no preset dropdown when none are configured).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/calculators/mortgage`;
  const title = 'Mortgage calculator';
  const description =
    'Estimate your indicative monthly mortgage repayment, total interest and loan-to-value. For guidance only — not financial advice.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function MortgageCalculatorPage() {
  const tenantId = await getCurrentTenantId();
  const { config, presets } = await withTenant(getDb(), tenantId, async (tx) => ({
    config: await loadMortgageRateConfig(tx as unknown as MortgageRateConfigReader),
    presets: await loadMortgageRatePresets(tx as unknown as MortgageRatePresetReader),
  }));

  return (
    <main id="main" className="container py-12">
      <header className="flex flex-col gap-2">
        <h1 className="t-display-sm">Mortgage calculator</h1>
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          Estimate your indicative monthly repayment. Enter the purchase price, your deposit, the
          interest rate and the term.
        </p>
      </header>
      <div className="mt-8">
        <MortgageCalculator config={config} presets={presets} />
      </div>
    </main>
  );
}
