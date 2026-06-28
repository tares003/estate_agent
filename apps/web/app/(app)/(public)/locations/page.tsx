import type { Metadata } from 'next';
import { withTenant } from '@estate/db';

import { listPublishedAreaGuides, type AreaGuideListReader } from '../../lib/area-guides.js';
import { getDb } from '../../lib/db.js';
import { signedObjectPath } from '../../lib/storage.js';
import { getCurrentTenantId, getRequestOrigin } from '../../lib/tenant.js';

import './locations.css';

export const dynamic = 'force-dynamic';

/** EPIC-O metadata for the locations hub (FR-O-4 / FR-C-11). */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/locations`;
  const title = 'Area guides';
  const description =
    'Explore the areas we cover — local insight, transport, schools and the latest properties in each.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * EPIC-C C.13 locations index (`/locations`, FR-C-8). Resolves the tenant, lists
 * every PUBLISHED area guide inside the tenant RLS scope, and renders a card grid
 * linking each to its `/locations/[slug]` detail page. Drafts never appear (the
 * read model filters status = published); an empty state shows when there are no
 * published guides. The query / mapping logic is unit-tested in lib/area-guides.ts;
 * this composes it.
 */
export default async function LocationsPage() {
  const tenantId = await getCurrentTenantId();
  const guides = await withTenant(getDb(), tenantId, (tx) =>
    listPublishedAreaGuides(tx as unknown as AreaGuideListReader),
  );

  // Render-time signed serving paths (CLAUDE.md §9 — files served via signed URLs).
  const expiry = Date.now() + 60 * 60_000;

  return (
    <main id="main" className="container py-12">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="t-display-sm">Area guides</h1>
        <p className="t-body-lg text-text-secondary max-w-[60ch]">
          Explore the areas we cover — local insight and the latest properties in each.
        </p>
      </header>

      <p className="t-body-sm text-text-secondary mb-6" aria-live="polite">
        {guides.length === 0
          ? 'No area guides'
          : `${guides.length} ${guides.length === 1 ? 'area guide' : 'area guides'}`}
      </p>

      {guides.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No area guides to show just yet. Please check back soon.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => {
            const heroSrc = guide.heroImage ? signedObjectPath(guide.heroImage, expiry) : null;
            return (
              <li key={guide.slug}>
                <article className="area-card border-divider flex h-full flex-col gap-3 rounded-lg border p-6">
                  {heroSrc ? (
                    <img
                      src={heroSrc}
                      alt={`${guide.name} area guide`}
                      className="aspect-[16/9] w-full rounded-md object-cover"
                    />
                  ) : null}
                  <h2 className="t-heading-sm">
                    <a
                      href={`/locations/${guide.slug}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {guide.name}
                    </a>
                  </h2>
                  <p className="t-body-md text-text-secondary max-w-[55ch]">{guide.introduction}</p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
