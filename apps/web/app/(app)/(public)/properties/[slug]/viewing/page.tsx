import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';

import { getDb } from '../../../../lib/db.js';
import {
  getPropertyBySlug,
  type PropertyDetail,
  type PropertyDetailReader,
} from '../../../../lib/properties.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../../lib/tenant.js';
import { ViewingForm } from './ViewingForm.js';

// EPIC-F "Book a viewing" page — a per-property route so its form's field ids never
// collide with the property-detail enquiry form. Resolves the tenant, fetches the
// published property by slug inside the tenant RLS scope (404 if unknown), and
// renders the viewing form. The submission produces a viewing-channel enquiry
// (FR-I-1).

export const dynamic = 'force-dynamic';

interface BookViewingPageProps {
  params: Promise<{ slug: string }>;
}

const loadProperty = cache(async (slug: string): Promise<PropertyDetail | null> => {
  const tenantId = await getCurrentTenantId();
  return withTenant(getDb(), tenantId, (tx) =>
    getPropertyBySlug(tx as unknown as PropertyDetailReader, slug),
  );
});

export async function generateMetadata({ params }: BookViewingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await loadProperty(slug);
  if (!property) return { title: 'Property not found' };

  const origin = await getRequestOrigin();
  return {
    title: `Book a viewing — ${property.title}`,
    alternates: { canonical: `${origin}/properties/${property.slug}/viewing` },
    // The form page is thin + duplicative of the listing; keep it out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function BookViewingPage({ params }: BookViewingPageProps) {
  const { slug } = await params;
  const property = await loadProperty(slug);
  if (!property) notFound();

  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">Book a viewing</h1>
      <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">{property.displayAddress}</p>
      <div className="mt-8 max-w-[40rem]">
        <ViewingForm propertyId={property.id} propertyTitle={property.title} />
      </div>
    </main>
  );
}
