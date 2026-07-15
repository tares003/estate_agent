// pack: core — the public property detail is a core surface. It renders the facts of an
// ALREADY-published property regardless of which packs the tenant has; the listing-type
// strings below (commercial / business_transfer / …) are the §J discriminator, not pack
// slugs. Pack entitlement gates AUTHORING these verticals (the admin form), not the public
// display of a property that already exists (EPIC-AD / G12).
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, type BadgeTone } from '@estate/ui';
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
import { getCustomerSession } from '../../../lib/customer-session.js';
import { savedPropertyIdsFor, type SavedPropertyReader } from '../../../lib/saved-properties.js';
import { EnquiryForm } from './EnquiryForm.js';
import { SavePropertyButton } from '../../../account/saved/SavePropertyButton.js';

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
    property.description ?? `${property.title}, ${property.address}.`,
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
  /** Already rendered for display — a bare count, or a value carrying its unit ("1,450 sq ft"). */
  value: string | number;
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

/** Render a PENCE money value (ground rent / service charge columns) as GBP. */
function moneyFromPence(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
}

/** An EPC band's efficiency tone (A–C efficient, D–E middling, F–G poor). */
function epcTone(rating: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const band = rating.toLowerCase();
  if (['a', 'b', 'c'].includes(band)) return 'success';
  if (['d', 'e'].includes(band)) return 'warning';
  if (['f', 'g'].includes(band)) return 'danger';
  return 'neutral';
}

/** One Material Information row (Property Ombudsman Parts A/B/C, compliance rule #4). */
interface MaterialRow {
  label: string;
  value: string;
  /** An EPC-style tone chip, when the value carries an efficiency signal. */
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

/** Market-status display: the public label + the matching badge tone. */
function marketStatusDisplay(status: string): { label: string; tone: BadgeTone } {
  const map: Record<string, { label: string; tone: BadgeTone }> = {
    for_sale: { label: 'For sale', tone: 'available' },
    to_let: { label: 'To rent', tone: 'available' },
    under_offer: { label: 'Under offer', tone: 'under-offer' },
    sold_stc: { label: 'Sold STC', tone: 'sold-stc' },
    let_agreed: { label: 'Let agreed', tone: 'let-agreed' },
    sold: { label: 'Sold', tone: 'sold' },
    let: { label: 'Let', tone: 'let' },
    withdrawn: { label: 'Withdrawn', tone: 'withdrawn' },
  };
  return map[status] ?? { label: humaniseFact(status), tone: 'neutral' };
}

/** A minimal house glyph for the no-photo gallery placeholder. */
function HouseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      aria-hidden="true"
    >
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v9h14v-9" />
      <path d="M9 19v-5h6v5" />
    </svg>
  );
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

  // EPIC-T FR-T-5/6 — the save-to-favourites control. A verified customer sees a
  // toggle reflecting the persisted state; a signed-out or unverified visitor sees a
  // sign-in link carrying this page as the return path (the toggle action is the
  // fail-closed gate). Only a verified customer can hold a favourite, so the
  // saved-state read runs tenant-scoped (RLS) for them alone.
  const session = await getCustomerSession();
  const canSave = Boolean(session?.emailVerified);
  let initialSaved = false;
  if (canSave && session) {
    const tenantId = await getCurrentTenantId();
    const savedIds = await withTenant(getDb(), tenantId, (tx) =>
      savedPropertyIdsFor(tx as unknown as SavedPropertyReader, session.userId, [property.id]),
    );
    initialSaved = savedIds.has(property.id);
  }

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
  // §C.11 item 5 — the facts strip carries the square footage. Omitted (never "0 sq ft")
  // when the listing has no measured internal size.
  if (property.internalSqft != null && property.internalSqft > 0) {
    facts.push({
      label: 'Size',
      value: `${property.internalSqft.toLocaleString('en-GB')} sq ft`,
    });
  }

  // §F Material Information (Property Ombudsman Parts A/B/C, PRODUCT.md rule #4) — only
  // the rows the listing actually populates are shown; nothing is invented.
  const material: MaterialRow[] = [];
  if (property.epcRating) {
    material.push({
      label: 'EPC rating',
      value:
        property.epcRating.toUpperCase() + (property.epcScore ? ` · ${property.epcScore}` : ''),
      tone: epcTone(property.epcRating),
    });
  }
  if (property.councilTaxBand) {
    material.push({ label: 'Council tax band', value: property.councilTaxBand.toUpperCase() });
  }
  if (property.tenure) material.push({ label: 'Tenure', value: humaniseFact(property.tenure) });
  if (property.internalSqft != null && property.internalSqft > 0) {
    material.push({
      label: 'Internal size',
      value: `${property.internalSqft.toLocaleString('en-GB')} sq ft`,
    });
  }
  if (property.furnishedStatus) {
    material.push({ label: 'Furnishing', value: humaniseFact(property.furnishedStatus) });
  }
  if (property.groundRent != null) {
    material.push({
      label: 'Ground rent',
      value: `${moneyFromPence(property.groundRent)} per year`,
    });
  }
  if (property.serviceCharge != null) {
    material.push({
      label: 'Service charge',
      value: `${moneyFromPence(property.serviceCharge)} per year`,
    });
  }

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

  const status = marketStatusDisplay(property.marketStatus);
  const summary = property.shortDescription;

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
      {/* Gallery leads full-bleed within the container: hero + strip, or a graceful
          placeholder so the page always opens on a visual anchor. */}
      {heroImage ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <img
            src={heroImage.src}
            alt={heroImage.alt}
            className="border-border aspect-[4/3] w-full rounded-lg border object-cover sm:aspect-auto sm:h-full"
          />
          {gallery.length > 1 ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:grid-rows-3">
              {gallery.slice(1, 4).map((image) => (
                <li key={image.src} className="h-full">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="border-border aspect-[4/3] h-full w-full rounded-md border object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="bg-surface-sunken border-border text-text-muted mb-10 flex aspect-[16/6] w-full flex-col items-center justify-center gap-3 rounded-lg border">
          <span className="[&>svg]:h-10 [&>svg]:w-10">
            <HouseGlyph />
          </span>
          <p className="t-body-sm">Photography for this property is on its way.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.7fr_1fr] lg:gap-16">
        <article className="flex flex-col gap-12">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="t-body-sm text-text-secondary">{address}</span>
            </div>
            <h1 className="t-display-sm max-w-[20ch]">{title}</h1>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="t-heading-lg">{price}</span>
              <span className="t-body-sm text-text-secondary">
                {priceQualifier}
                {rentFrequency ? ` · ${rentFrequency}` : ''}
              </span>
            </div>
            {facts.length > 0 ? (
              <dl className="border-border mt-4 flex flex-wrap gap-x-10 gap-y-4 border-y py-5">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-1">
                    <dt className="t-caption text-text-muted">{fact.label}</dt>
                    <dd className="t-heading-sm">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="mt-1">
              <SavePropertyButton
                propertyId={property.id}
                signedIn={canSave}
                initialSaved={initialSaved}
                currentPath={`/properties/${property.slug}`}
              />
            </div>
          </header>

          {summary || property.description ? (
            <section aria-labelledby="about-heading" className="flex flex-col gap-4">
              <h2 id="about-heading" className="t-heading-md">
                About this property
              </h2>
              {summary ? <p className="t-body-lg max-w-[62ch]">{summary}</p> : null}
              {property.description ? (
                <p className="t-body-md text-text-secondary max-w-[62ch] whitespace-pre-line">
                  {property.description}
                </p>
              ) : null}
            </section>
          ) : null}

          {property.keyFeatures.length > 0 ? (
            <section aria-labelledby="features-heading" className="flex flex-col gap-4">
              <h2 id="features-heading" className="t-heading-md">
                Key features
              </h2>
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {property.keyFeatures.map((feature) => (
                  <li key={feature} className="t-body-md flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="text-brand-accent mt-1 [&>svg]:h-4 [&>svg]:w-4"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="m5 10 3.5 3.5L15 6" />
                      </svg>
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {material.length > 0 ? (
            <section aria-labelledby="material-heading" className="flex flex-col gap-4">
              <h2 id="material-heading" className="t-heading-md">
                Material information
              </h2>
              <p className="t-body-sm text-text-muted max-w-[62ch]">
                The facts every buyer needs up front, in line with Trading Standards guidance.
              </p>
              <dl className="border-border grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-2">
                {material.map((row, index) => (
                  <div
                    key={row.label}
                    className={`border-divider flex items-center justify-between gap-4 px-5 py-4 ${
                      index % 2 === 0 ? 'sm:border-r' : ''
                    } ${index >= 2 ? 'border-t' : ''} sm:[&:nth-child(-n+2)]:border-t-0`}
                  >
                    <dt className="t-body-sm text-text-secondary">{row.label}</dt>
                    <dd className="t-body-md flex items-center gap-2 font-medium">
                      {row.tone ? <Badge tone={row.tone}>{row.value}</Badge> : row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* FR-F-3 — the per-vertical facts strip. */}
          {extraFacts.length > 0 || cqcUrl ? (
            <section aria-labelledby="vertical-heading" className="flex flex-col gap-4">
              <h2 id="vertical-heading" className="t-heading-md">
                Additional details
              </h2>
              <dl className="flex flex-wrap gap-x-10 gap-y-4">
                {extraFacts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-1">
                    <dt className="t-caption text-text-muted">{fact.label}</dt>
                    <dd className="t-heading-sm">{fact.value}</dd>
                  </div>
                ))}
                {cqcUrl ? (
                  <div className="flex flex-col gap-1">
                    <dt className="t-caption text-text-muted">Inspection</dt>
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
            </section>
          ) : null}

          {property.areaDescription ? (
            <section aria-labelledby="area-heading" className="flex flex-col gap-4">
              <h2 id="area-heading" className="t-heading-md">
                The area
              </h2>
              <p className="t-body-md text-text-secondary max-w-[62ch]">
                {property.areaDescription}
              </p>
              <p className="t-body-sm text-text-muted">{address}</p>
            </section>
          ) : null}
        </article>

        <aside aria-label="Enquire about this property" className="self-start lg:sticky lg:top-8">
          <div className="border-border bg-surface-raised flex flex-col gap-4 rounded-lg border p-6">
            <EnquiryForm propertyId={property.id} propertyTitle={title} />
            <p className="border-divider t-body-sm text-text-secondary border-t pt-4">
              Prefer to see it in person?{' '}
              <a
                href={`/properties/${property.slug}/viewing`}
                className="text-brand-primary font-medium underline underline-offset-4"
              >
                Book a viewing
              </a>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
