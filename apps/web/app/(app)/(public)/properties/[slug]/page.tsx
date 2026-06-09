import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { getDb } from '../../../lib/db.js';
import {
  getPropertyBySlug,
  type PropertyDetail,
  type PropertyDetailReader,
} from '../../../lib/properties.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';
import { breadcrumbJsonLd, propertyListingJsonLd, truncate } from '../../../lib/seo.js';
import { EnquiryForm } from './EnquiryForm.js';

export const dynamic = 'force-dynamic';

interface PropertyDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Load the property once per request — `generateMetadata` and the page component
 * both call this, and React's `cache` dedupes the tenant-scoped query.
 */
const loadProperty = cache(async (slug: string): Promise<PropertyDetail | null> => {
  const tenantId = await getCurrentTenantId();
  return withTenant(getDb(), tenantId, (tx) =>
    getPropertyBySlug(tx as unknown as PropertyDetailReader, slug),
  );
});

/** EPIC-O metadata (FR-O-4): title ≤60, description ≤160, canonical, OG, Twitter. */
export async function generateMetadata({ params }: PropertyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const property = await loadProperty(slug);
  if (!property) return { title: 'Property not found' };

  const origin = await getRequestOrigin();
  const url = `${origin}/properties/${property.slug}`;
  const title = truncate(property.title, 60);
  const description = truncate(
    property.description ?? `${property.title} — ${property.address}.`,
    160,
  );

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** One key fact rendered in the spec list, when the value is present. */
interface Fact {
  label: string;
  value: number;
}

/**
 * EPIC-F property detail. Resolves the tenant, fetches the single published
 * property by slug inside the tenant RLS scope, and renders the detail beside
 * the buyer-enquiry form. An unknown / unpublished / soft-deleted slug yields a
 * 404 via `notFound()`. The data mapping is unit-tested in lib/; this composes it.
 */
export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { slug } = await params;
  const property = await loadProperty(slug);

  if (!property) {
    notFound();
  }

  // Destructured to locals so the price renders as a bare identifier beside its
  // qualifier + frequency markers (the trust-marker pattern PropertyCard uses).
  const { address, title, price, priceQualifier, rentFrequency } = property;

  const facts: Fact[] = [];
  if (property.bedrooms != null) facts.push({ label: 'Bedrooms', value: property.bedrooms });
  if (property.bathrooms != null) facts.push({ label: 'Bathrooms', value: property.bathrooms });
  if (property.receptions != null) facts.push({ label: 'Receptions', value: property.receptions });

  // EPIC-O structured data (FR-O-5 RealEstateListing + FR-O-6 BreadcrumbList).
  const origin = await getRequestOrigin();
  const url = `${origin}/properties/${property.slug}`;
  const jsonLd = [
    propertyListingJsonLd(property, url),
    breadcrumbJsonLd([
      { name: 'Home', url: `${origin}/` },
      { name: 'Properties', url: `${origin}/properties` },
      { name: title, url },
    ]),
  ];

  return (
    <main id="main" className="container py-12">
      {jsonLd.map((ld, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Structured data is server-rendered, non-interactive JSON (no user input
          // is interpolated unescaped beyond the property's own text).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.6fr_1fr]">
        <article>
          <header className="flex flex-col gap-2">
            <p className="t-body-md text-text-secondary">{address}</p>
            <h1 className="t-display-sm">{title}</h1>
            <p className="flex items-baseline gap-3">
              <span className="t-heading-md">{price}</span>
              <span className="t-body-sm text-text-secondary">
                {priceQualifier}
                {rentFrequency ? ` · ${rentFrequency}` : ''}
              </span>
            </p>
          </header>

          {facts.length > 0 ? (
            <dl className="mt-8 flex flex-wrap gap-8">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col">
                  <dt className="t-caption text-text-secondary">{fact.label}</dt>
                  <dd className="t-heading-sm">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {property.description ? (
            <p className="t-body-lg mt-8 max-w-[60ch] whitespace-pre-line">
              {property.description}
            </p>
          ) : null}
        </article>

        <aside aria-label="Enquire about this property">
          <EnquiryForm propertyId={property.id} propertyTitle={title} />
        </aside>
      </div>
    </main>
  );
}
