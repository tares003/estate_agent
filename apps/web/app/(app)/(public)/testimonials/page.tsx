import type { Metadata } from 'next';
import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import {
  listPublishedFeedback,
  type PublishedFeedbackReader,
} from '../../lib/published-feedback.js';
import { getCurrentTenantId, getRequestOrigin } from '../../lib/tenant.js';

export const dynamic = 'force-dynamic';

/** EPIC-O metadata for the public testimonials index (FR-O-4). */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await getRequestOrigin();
  const url = `${origin}/testimonials`;
  const title = 'Testimonials';
  const description = 'What our clients say — verified feedback from buyers, sellers and tenants.';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

interface TestimonialsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Read the first value of a possibly-repeated search param. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Coerce the raw `page` param to a positive integer (defaults to 1). */
function parsePage(value: string | string[] | undefined): number {
  const raw = firstParam(value);
  const page = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Build a `/testimonials` pagination href (page 1 omitted → canonical URL). */
function pageHref(page: number): string {
  return page > 1 ? `/testimonials?page=${page}` : '/testimonials';
}

/** Fixed-locale date formatter (deterministic across runtimes / tests). */
const TESTIMONIAL_DATE = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Render a 1–5 rating as accessible stars (label carries the number). */
function Rating({ rating }: { rating: number }) {
  const value = Math.min(Math.max(Math.round(rating), 0), 5);
  return (
    <p className="t-body-md text-brand-primary" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(value) + '☆'.repeat(5 - value)}</span>
    </p>
  );
}

/**
 * EPIC-AC public testimonials index (FR-AC-5). Resolves the tenant, lists the
 * PUBLISHED, publishable feedback inside the tenant RLS scope, and renders it as
 * anonymised testimonial quotes with pagination. Only safe fields are ever read
 * (rating, comment, date) — pending / rejected feedback and every sensitive
 * column never reach this surface. URL `?page=` is the single source of truth.
 */
export default async function TestimonialsPage({ searchParams }: TestimonialsPageProps) {
  const page = parsePage((await searchParams)?.['page']);
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listPublishedFeedback(tx as unknown as PublishedFeedbackReader, { page }),
  );

  const { items, total, totalPages } = result;

  return (
    <main id="main" className="container py-12">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="t-display-sm">Testimonials</h1>
        <p className="t-body-lg text-text-secondary max-w-[60ch]">
          Verified feedback from clients we have helped buy, sell, let and rent.
        </p>
      </header>

      <p className="t-body-sm text-text-secondary mb-6" aria-live="polite">
        {total === 0
          ? 'No testimonials yet'
          : `${total} ${total === 1 ? 'testimonial' : 'testimonials'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No testimonials to show just yet. Please check back soon.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((testimonial) => (
            <li key={testimonial.id}>
              <blockquote className="border-divider flex h-full flex-col gap-3 rounded-lg border p-6">
                <Rating rating={testimonial.rating} />
                {testimonial.comment ? <p className="t-body-md">“{testimonial.comment}”</p> : null}
                <p className="t-caption text-text-secondary mt-auto">
                  <time dateTime={testimonial.createdAt.toISOString()}>
                    {TESTIMONIAL_DATE.format(testimonial.createdAt)}
                  </time>
                </p>
              </blockquote>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a className="t-body-md" href={pageHref(page - 1)}>
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a className="t-body-md" href={pageHref(page + 1)}>
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
