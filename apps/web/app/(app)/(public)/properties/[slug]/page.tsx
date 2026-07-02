// pack: core — the public property detail is a core surface. It renders the facts of an
// ALREADY-published property regardless of which packs the tenant has; the listing-type
// strings below (commercial / business_transfer / …) are the §J discriminator, not pack
// slugs. Pack entitlement gates AUTHORING these verticals (the admin form), not the public
// display of a property that already exists (EPIC-AD / G12).
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { getDb } from '../../../lib/db.js';
import {
  listPropertyImages,
  renditionKeyFor,
  type PropertyImageReader,
  type PropertyImageRow,
} from '../../../lib/property-images.js';
import {
  getPropertyBySlug,
  type PropertyDetail,
  type PropertyDetailReader,
} from '../../../lib/properties.js';
import { signedObjectPath } from '../../../lib/storage.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';
import { breadcrumbJsonLd, propertyListingJsonLd, truncate } from '../../../lib/seo.js';
import { resolveSeoMetadata, type SeoMetadataReader } from '../../../lib/seo-metadata.js';
import { applySeoOverride } from '../../../lib/seo-override.js';
import { EnquiryForm } from './EnquiryForm.js';

export const dynamic = 'force-dynamic';

interface PropertyDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Load the property once per request — `generateMetadata` and the page component
 * both call this, and React's `cache` dedupes the tenant-scoped query.
 */
const loadProperty = cache(
  async (
    slug: string,
  ): Promise<{ property: PropertyDetail; images: PropertyImageRow[] } | null> => {
    const tenantId = await getCurrentTenantId();
    return withTenant(getDb(), tenantId, async (tx) => {
      const property = await getPropertyBySlug(tx as unknown as PropertyDetailReader, slug);
      if (!property) return null;
      const images = await listPropertyImages(tx as unknown as PropertyImageReader, property.id);
      return { property, images };
    });
  },
);

/** EPIC-O metadata (FR-O-4): title ≤60, description ≤160, canonical, OG, Twitter. */
export async function generateMetadata({ params }: PropertyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadProperty(slug);
  if (!data) return { title: 'Property not found' };
  const { property } = data;

  const origin = await getRequestOrigin();
  const url = `${origin}/properties/${property.slug}`;
  const title = truncate(property.title, 60);
  const description = truncate(
    property.description ?? `${property.title} — ${property.address}.`,
    160,
  );

  const base: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };

  // EPIC-O FR-O-4 — a per-entity (else tenant-wide default) SEO override wins over
  // the page default when present; the resolve runs tenant-scoped (RLS) via withTenant.
  const tenantId = await getCurrentTenantId();
  const override = await withTenant(getDb(), tenantId, (tx) =>
    resolveSeoMetadata(tx as unknown as SeoMetadataReader, 'property', property.id),
  );
  return applySeoOverride(base, override);
}

/** One key fact rendered in the spec list, when the value is present. */
interface Fact {
  label: string;
  value: number;
}

/** One per-vertical extension fact — its value already rendered to a display string. */
interface VerticalFact {
  label: string;
  value: string;
}

/** Humanise a snake_case enum value into Title Case ("requires_improvement" → "Requires improvement"). */
function humaniseFact(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Render a whole-pound money value as a GBP string ("£12,500"). */
function money(value: number): string {
  return `£${value.toLocaleString('en-GB')}`;
}

/**
 * FR-F-3 — build the per-vertical facts shown below the core spec strip, discriminated
 * by listing type. A residential/land listing yields none. The CQC inspection link is
 * rendered separately (it is an anchor, not a value cell).
 */
function verticalFacts(v: PropertyDetail['vertical']): VerticalFact[] {
  const facts: VerticalFact[] = [];
  switch (v.listingType) {
    case 'new_home':
      if (v.developmentName) facts.push({ label: 'Development', value: v.developmentName });
      if (v.isOffPlan) facts.push({ label: 'Off-plan', value: 'Yes' });
      break;
    case 'commercial':
      if (v.useClass) facts.push({ label: 'Use class', value: v.useClass.toUpperCase() });
      if (v.annualBusinessRates != null) {
        facts.push({ label: 'Business rates', value: money(v.annualBusinessRates) });
      }
      if (v.vatPayable != null) {
        facts.push({ label: 'VAT payable', value: v.vatPayable ? 'Yes' : 'No' });
      }
      break;
    case 'business_transfer':
      if (v.annualTurnover != null) {
        facts.push({ label: 'Annual turnover', value: money(v.annualTurnover) });
      }
      if (v.grossProfit != null) facts.push({ label: 'Gross profit', value: money(v.grossProfit) });
      if (v.netProfit != null) facts.push({ label: 'Net profit', value: money(v.netProfit) });
      if (v.yearsTrading != null) {
        facts.push({ label: 'Years trading', value: String(v.yearsTrading) });
      }
      if (v.staffCount != null) facts.push({ label: 'Staff', value: String(v.staffCount) });
      if (v.currentAnnualRent != null) {
        facts.push({ label: 'Current annual rent', value: money(v.currentAnnualRent) });
      }
      break;
    case 'care_home':
      if (v.bedCount != null) facts.push({ label: 'Bed count', value: String(v.bedCount) });
      if (v.cqcRating) facts.push({ label: 'CQC rating', value: humaniseFact(v.cqcRating) });
      if (v.isGoingConcern) facts.push({ label: 'Going concern', value: 'Yes' });
      break;
    default:
      break;
  }
  return facts;
}

/**
 * EPIC-F property detail. Resolves the tenant, fetches the single published
 * property by slug inside the tenant RLS scope, and renders the detail beside
 * the buyer-enquiry form. An unknown / unpublished / soft-deleted slug yields a
 * 404 via `notFound()`. The data mapping is unit-tested in lib/; this composes it.
 */
export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { slug } = await params;
  const data = await loadProperty(slug);

  if (!data) {
    notFound();
  }

  const { property, images } = data;
  // The gallery leads with the hero, then sort order; signed render-time paths
  // (CLAUDE.md §9), every image alt-texted (G9).
  const galleryExpiry = Date.now() + 60 * 60_000;
  const sorted = [...images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  // The hero serves the large rendition, the strip serves thumbs — each only
  // once the post-process job has produced them (renditionKeyFor falls back).
  const gallery = sorted.map((image, index) => ({
    src: signedObjectPath(renditionKeyFor(image, index === 0 ? 'large' : 'thumb'), galleryExpiry),
    alt: image.alt,
  }));
  const heroImage = gallery[0];

  // Destructured to locals so the price renders as a bare identifier beside its
  // qualifier + frequency markers (the trust-marker pattern PropertyCard uses).
  const { address, title, price, priceQualifier, rentFrequency } = property;

  const facts: Fact[] = [];
  if (property.bedrooms != null) facts.push({ label: 'Bedrooms', value: property.bedrooms });
  if (property.bathrooms != null) facts.push({ label: 'Bathrooms', value: property.bathrooms });
  if (property.receptions != null) facts.push({ label: 'Receptions', value: property.receptions });

  // FR-F-3 — the per-vertical extension facts, discriminated by listing type.
  const extraFacts = verticalFacts(property.vertical);
  const cqcUrl =
    property.vertical.listingType === 'care_home' ? property.vertical.cqcInspectionUrl : null;

  // EPIC-O structured data (FR-O-5 RealEstateListing + FR-O-6 BreadcrumbList).
  const origin = await getRequestOrigin();
  const url = `${origin}/properties/${property.slug}`;
  // The structured-data `image` array carries the gallery photos as absolute,
  // render-time signed URLs (the gallery srcs are app-relative signed paths).
  const listingImages = gallery.map((image) => `${origin}${image.src}`);
  const jsonLd = [
    propertyListingJsonLd(property, url, listingImages),
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
          {heroImage ? (
            <div className="mb-8 flex flex-col gap-3">
              <img
                src={heroImage.src}
                alt={heroImage.alt}
                className="border-divider aspect-[4/3] w-full rounded-lg border object-cover"
              />
              {gallery.length > 1 ? (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {gallery.slice(1).map((image) => (
                    <li key={image.src}>
                      <img
                        src={image.src}
                        alt={image.alt}
                        className="border-divider aspect-[4/3] w-full rounded-md border object-cover"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
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

          {/* FR-F-3 — the per-vertical facts strip, below the core spec strip. */}
          {extraFacts.length > 0 || cqcUrl ? (
            <dl className="border-divider mt-8 flex flex-wrap gap-8 border-t pt-8">
              {extraFacts.map((fact) => (
                <div key={fact.label} className="flex flex-col">
                  <dt className="t-caption text-text-secondary">{fact.label}</dt>
                  <dd className="t-heading-sm">{fact.value}</dd>
                </div>
              ))}
              {cqcUrl ? (
                <div className="flex flex-col">
                  <dt className="t-caption text-text-secondary">Inspection</dt>
                  <dd className="t-heading-sm">
                    <a
                      href={cqcUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand-primary underline underline-offset-4"
                    >
                      CQC inspection
                    </a>
                  </dd>
                </div>
              ) : null}
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
          <p className="t-body-sm text-text-secondary mt-4">
            Prefer to see it in person?{' '}
            <a
              href={`/properties/${property.slug}/viewing`}
              className="text-brand-primary underline underline-offset-4"
            >
              Book a viewing
            </a>
          </p>
        </aside>
      </div>
    </main>
  );
}
