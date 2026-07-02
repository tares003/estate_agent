import { z } from 'zod';

import type { PublicTestimonial } from '../../app/(app)/lib/published-feedback.js';

// EPIC-AC FR-AC-5 / EPIC-D page-builder block. A DATA-DRIVEN testimonials section:
// unlike the hardcoded `testimonials` block, this fetches the current tenant's
// PUBLISHED, publishable feedback and renders it as anonymised testimonial quotes.
// The data-layer deps (Prisma via @estate/db, the request tenant) are DYNAMICALLY
// imported at render so the lightweight block registry (and the node-env block
// tests that import it) never pull Prisma/next-headers at module load — same
// discipline as PropertyGridBlock. Resilient: any fetch failure renders nothing
// rather than breaking the page. Token-driven (G7); semantic <blockquote>.

/** The block config: a heading + how many testimonials to show. */
export const testimonialsDataDrivenBlockSchema = z.object({
  heading: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export type TestimonialsDataDrivenConfig = z.infer<typeof testimonialsDataDrivenBlockSchema>;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Render a 1–5 rating as accessible stars (label carries the number). */
function Rating({ rating }: { rating: number }) {
  const value = clamp(Math.round(rating), 0, 5);
  return (
    <p className="t-body-md text-brand-primary" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(value) + '☆'.repeat(5 - value)}</span>
    </p>
  );
}

/** The presentational list — kept pure so the async wrapper is thin fetch glue. */
export function TestimonialsList({
  heading,
  items,
}: {
  heading?: string | undefined;
  items: PublicTestimonial[];
}) {
  return (
    <section className="container py-16">
      {heading ? <h2 className="t-heading-lg mb-8">{heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {items.map((testimonial) => (
          <li key={testimonial.id}>
            <blockquote className="flex flex-col gap-4">
              <Rating rating={testimonial.rating} />
              {testimonial.comment ? <p className="t-body-lg">“{testimonial.comment}”</p> : null}
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * EPIC-D `testimonials_feedback` renderer. Async server component: fetches the
 * tenant's published testimonials (safe fields only) and renders them. Renders
 * nothing when there is no published feedback or the fetch fails, so the page
 * degrades gracefully rather than showing a fake or broken section.
 */
export async function TestimonialsBlockDataDriven({
  data,
}: {
  data: TestimonialsDataDrivenConfig;
}) {
  const pageSize = clamp(data.limit ?? 6, 1, 24);

  let items: PublicTestimonial[] = [];
  try {
    const [{ getDb }, { withTenant }, { getCurrentTenantId }, { listPublishedFeedback }] =
      await Promise.all([
        import('../../app/(app)/lib/db.js'),
        import('@estate/db'),
        import('../../app/(app)/lib/tenant.js'),
        import('../../app/(app)/lib/published-feedback.js'),
      ]);
    const tenantId = await getCurrentTenantId();
    const result = await withTenant(getDb(), tenantId, (tx) =>
      listPublishedFeedback(tx as never, { pageSize }),
    );
    items = result.items;
  } catch {
    items = [];
  }

  if (items.length === 0) {
    return null;
  }

  return <TestimonialsList heading={data.heading} items={items} />;
}
