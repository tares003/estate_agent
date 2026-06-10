import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { RepairForm } from './RepairForm.js';

// EPIC-G tenant repair-report page (PRODUCT.md §4 — "Report a repair", FR-G-1).
// Server Component shell around the client form; the submission produces a
// tenant-scoped RepairRequest (the repair flow is in the `core` pack — every
// tenant gets it, so no entitlement gate).

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

export default function ReportRepairPage() {
  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">Report a repair</h1>
      <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">
        Let us know what needs fixing at your property and the repairs team will pick it up.
      </p>
      <div className="mt-8 max-w-[40rem]">
        <RepairForm />
      </div>
    </main>
  );
}
