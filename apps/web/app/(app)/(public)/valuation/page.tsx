import type { Metadata } from 'next';

import { getRequestOrigin } from '../../lib/tenant.js';
import { ValuationForm } from './ValuationForm.js';

// EPIC-C valuation request page (PRODUCT.md §4 — "Get a free valuation"). The
// homepage hero + the site nav link here. Server Component shell around the
// client form; the submission produces a valuation-channel enquiry (FR-I-1).

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/valuation`;
  const title = 'Book a free valuation';
  const description =
    'Request a free, no-obligation valuation of your home from agents who know the area.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function ValuationPage() {
  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">Book a free valuation</h1>
      <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">
        Tell us about your property and we&rsquo;ll be in touch to arrange a free, no-obligation
        valuation.
      </p>
      <div className="mt-8 max-w-[40rem]">
        <ValuationForm />
      </div>
    </main>
  );
}
