import Link from 'next/link';
import { withTenant } from '@estate/db';
import { PropertyCard, buttonClassName } from '@estate/ui';

import { getDb } from './lib/db.js';
import { listFeaturedProperties, type PropertyListReader } from './lib/properties.js';
import { getCurrentTenantId } from './lib/tenant.js';

// EPIC-C public homepage. A Server Component: an image-forward hero carrying the
// primary acquisition surface (the property search), a featured-homes strip drawn
// from the live catalogue, and the three journeys the agency serves. Composition
// and imagery follow the /impeccable audit (the previous skeleton was a centered
// stack of text cards with no imagery). Token-driven throughout (G7).

export const dynamic = 'force-dynamic';

// A single decisive hero photograph (brand register: a property brief must ship
// imagery). Served straight from Unsplash — the CSP permits it — with an alt that
// carries the mood.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1592595896551-12b371d546d5?auto=format&fit=crop&w=1920&q=80';

export default async function HomePage() {
  const tenantId = await getCurrentTenantId();
  const featured = await withTenant(getDb(), tenantId, (tx) =>
    listFeaturedProperties(tx as unknown as PropertyListReader, 3),
  );

  return (
    <main id="main">
      {/* Hero: photograph + scrim, with the search as the primary action. */}
      <section className="relative isolate overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="A tree-lined street of red-brick period homes at golden hour"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        {/* Dark scrim for text contrast over the photograph (a solid color-mix, not a
            gradient: `linear-gradient` trips the raw-easing token guard on `linear`). */}
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'color-mix(in srgb, var(--colour-brand-primary) 62%, transparent)' }}
        />
        <div className="container flex flex-col gap-8 py-24 md:py-32">
          <div className="flex flex-col gap-4">
            <p className="t-caption text-brand-accent">Sales · Lettings · New Homes</p>
            <h1 className="t-display-lg text-text-inverse max-w-[16ch]">
              Move with people who know the area.
            </h1>
            <p className="t-body-lg text-text-on-dark max-w-[48ch]">
              Homes for sale and to rent across South Manchester, from the people who live and work
              here.
            </p>
          </div>

          <form
            action="/properties"
            method="get"
            className="bg-surface-base flex w-full max-w-[var(--size-container-md)] flex-col gap-3 rounded-xl p-3 shadow-md sm:flex-row sm:items-center"
          >
            <label className="flex-1">
              <span className="sr-only">Location</span>
              <input
                type="text"
                name="location"
                placeholder="Town, area or postcode"
                className="border-border h-[var(--size-input-md)] w-full rounded-md border bg-transparent px-4 t-body-md"
              />
            </label>
            <label className="sm:w-40">
              <span className="sr-only">Buy or rent</span>
              <select
                name="saleType"
                className="border-border h-[var(--size-input-md)] w-full rounded-md border bg-transparent px-4 t-body-md"
              >
                <option value="">Buy or rent</option>
                <option value="sale">For sale</option>
                <option value="rent">To rent</option>
              </select>
            </label>
            <button type="submit" className={buttonClassName({ variant: 'primary', size: 'lg' })}>
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Featured homes: the live catalogue, not a placeholder. */}
      {featured.length > 0 ? (
        <section className="container py-16 md:py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="t-caption text-brand-accent">Just listed</p>
              <h2 className="t-display-sm">Featured homes</h2>
            </div>
            <Link
              href="/properties"
              className="text-brand-primary t-body-md font-medium underline underline-offset-4"
            >
              View all properties
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(({ id: _id, ...card }) => (
              <PropertyCard key={card.href} {...card} />
            ))}
          </div>
        </section>
      ) : null}

      {/* The three journeys, as real entry points. */}
      <section className="bg-surface-raised">
        <div className="container py-16 md:py-20">
          <h2 className="t-display-sm max-w-[18ch]">Whatever you are here to do, start here.</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                title: 'Buying or renting',
                body: 'Search the catalogue, save the homes you love, and book viewings online.',
                href: '/properties',
                cta: 'Browse properties',
              },
              {
                title: 'Selling or letting',
                body: 'Book a free, no-obligation valuation and track every enquiry in one place.',
                href: '/valuation',
                cta: 'Get a valuation',
              },
              {
                title: 'Already a tenant',
                body: 'Report a repair and manage your tenancy from your own account.',
                href: '/report-a-repair',
                cta: 'Report a repair',
              },
            ].map((card) => (
              <article key={card.title} className="flex flex-col gap-3">
                <h3 className="t-heading-md">{card.title}</h3>
                <p className="t-body-md text-text-secondary">{card.body}</p>
                <Link
                  href={card.href}
                  className="text-brand-primary t-body-md mt-1 font-medium underline underline-offset-4"
                >
                  {card.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
