import { Button } from '@estate/ui';

/**
 * Public homepage skeleton (EPIC-C). A Server Component that composes the
 * @estate/ui primitives and token-driven Tailwind utilities — proving the
 * design-system integration end to end. Real content/blocks come with the
 * EPIC-C page-builder wave.
 */
export default function HomePage() {
  return (
    <main id="main">
      <section className="bg-surface-raised">
        <div className="container py-20">
          <p className="t-caption text-brand-accent">Sales · Lettings · New Homes</p>
          <h1 className="t-display-lg mt-3 max-w-[20ch]">Move with people who know the area.</h1>
          <p className="t-body-lg text-text-secondary mt-4 max-w-[55ch]">
            Browse homes for sale and to rent, book viewings, request a valuation, and manage your
            tenancy — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button variant="primary" size="lg">
              Browse properties
            </Button>
            <Button variant="secondary" size="lg">
              Get a free valuation
            </Button>
          </div>
        </div>
      </section>

      <section className="container py-16">
        <h2 className="t-heading-lg">How we help</h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: 'Buying & renting',
              body: 'Search the catalogue, save properties, and book viewings online.',
            },
            {
              title: 'Selling & letting',
              body: 'Request an indicative valuation and track your enquiries.',
            },
            {
              title: 'Already a tenant',
              body: 'Report repairs and manage your tenancy from your account.',
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-lg border border-border bg-surface-base p-6"
            >
              <h3 className="t-heading-sm">{card.title}</h3>
              <p className="t-body-md text-text-secondary mt-2">{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
