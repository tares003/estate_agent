import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { PropertyCard } from '@estate/ui';

import { PageRenderer } from '../../../../../components/blocks/PageRenderer.js';
import {
  getPublishedAreaGuideBySlug,
  listPropertiesForArea,
  type AreaGuideReader,
  type AreaPropertyReader,
  type RenderableAreaGuide,
} from '../../../lib/area-guides.js';
import { getDb } from '../../../lib/db.js';
import type { CatalogueItem } from '../../../lib/properties.js';
import {
  listHeroImages,
  renditionKeyFor,
  type HeroImageReader,
  type HeroImageRow,
} from '../../../lib/property-images.js';
import { areaGuideJsonLd, breadcrumbJsonLd, truncate } from '../../../lib/seo.js';
import { signedObjectPath } from '../../../lib/storage.js';
import { getCurrentTenantId, getRequestOrigin } from '../../../lib/tenant.js';

export const dynamic = 'force-dynamic';

interface AreaGuidePageProps {
  params: Promise<{ slug: string }>;
}

/** The published guide plus the area's properties and their hero images. */
interface LoadedAreaGuide {
  guide: RenderableAreaGuide;
  properties: CatalogueItem[];
  heroes: HeroImageRow[];
}

/**
 * Load the area guide once per request — `generateMetadata` and the page both
 * call this, and React's `cache` dedupes the tenant-scoped query. The guide, its
 * area properties and their hero images all read inside one withTenant (RLS) scope.
 */
const loadGuide = cache(async (slug: string): Promise<LoadedAreaGuide | null> => {
  const tenantId = await getCurrentTenantId();
  return withTenant(getDb(), tenantId, async (tx) => {
    const guide = await getPublishedAreaGuideBySlug(tx as unknown as AreaGuideReader, slug);
    if (!guide) return null;
    const properties = await listPropertiesForArea(
      tx as unknown as AreaPropertyReader,
      guide.postcodePrefixes,
    );
    const heroes = await listHeroImages(
      tx as unknown as HeroImageReader,
      properties.map((item) => item.id),
    );
    return { guide, properties, heroes };
  });
});

/** EPIC-O metadata (FR-O-4 / FR-C-11): from the guide's metaTitle / metaDescription. */
export async function generateMetadata({ params }: AreaGuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadGuide(slug);
  if (!data) return { title: 'Area guide not found' };
  const { guide } = data;

  const origin = await getRequestOrigin();
  const url = `${origin}/locations/${guide.slug}`;
  const title = truncate(guide.metaTitle ?? `${guide.name} area guide`, 60);
  const description = truncate(guide.metaDescription ?? guide.introduction, 160);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * EPIC-C C.13 area guide (`/locations/[slug]`). Resolves the tenant, fetches the
 * single PUBLISHED guide by slug inside the tenant RLS scope, and renders the
 * hero (name + introduction), the CMS page-builder sections via the shared
 * PageRenderer, and a grid of the most recent properties whose postcode matches
 * the guide's prefixes (FR-C-9). Unknown / draft slugs 404 via `notFound()`. The
 * data mapping is unit-tested in lib/; this composes it. Emits Place + Breadcrumb
 * JSON-LD (FR-O-7 / FR-O-6).
 */
export default async function AreaGuidePage({ params }: AreaGuidePageProps) {
  const { slug } = await params;
  const data = await loadGuide(slug);

  if (!data) {
    notFound();
  }

  const { guide, properties, heroes } = data;

  // Render-time signed serving paths (CLAUDE.md §9 — files served via signed URLs).
  const expiry = Date.now() + 60 * 60_000;
  const heroSrc = guide.heroImage ? signedObjectPath(guide.heroImage, expiry) : null;
  const heroByProperty = new Map(heroes.map((hero) => [hero.propertyId, hero]));

  // EPIC-O structured data (FR-O-7 Place + FR-O-6 BreadcrumbList).
  const origin = await getRequestOrigin();
  const url = `${origin}/locations/${guide.slug}`;
  const jsonLd = [
    areaGuideJsonLd(guide, url),
    breadcrumbJsonLd([
      { name: 'Home', url: `${origin}/` },
      { name: 'Locations', url: `${origin}/locations` },
      { name: guide.name, url },
    ]),
  ];

  return (
    <main id="main" className="container py-12">
      {jsonLd.map((ld, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Server-rendered, non-interactive structured data (no unescaped user input).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      <header className="mb-12 flex flex-col gap-6">
        {heroSrc ? (
          <img
            src={heroSrc}
            alt={`${guide.name} area guide`}
            className="border-divider aspect-[16/9] w-full rounded-lg border object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-3">
          <h1 className="t-display-sm">{guide.name}</h1>
          <p className="t-body-lg text-text-secondary max-w-[65ch] whitespace-pre-line">
            {guide.introduction}
          </p>
        </div>
      </header>

      <PageRenderer sections={guide.sections} />

      <section aria-labelledby="area-properties" className="mt-16">
        <h2 id="area-properties" className="t-heading-lg mb-6">
          Current properties in {guide.name}
        </h2>
        {properties.length === 0 ? (
          <p className="t-body-lg text-text-secondary max-w-[55ch]">
            No properties are listed in {guide.name} just yet.{' '}
            <a href="/properties" className="text-brand-primary underline underline-offset-4">
              Browse all properties
            </a>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map(({ id, ...card }) => {
              const hero = heroByProperty.get(id);
              return (
                <PropertyCard
                  key={card.href}
                  {...card}
                  {...(hero
                    ? {
                        imageUrl: signedObjectPath(renditionKeyFor(hero, 'thumb'), expiry),
                        imageAlt: hero.alt,
                      }
                    : {})}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
