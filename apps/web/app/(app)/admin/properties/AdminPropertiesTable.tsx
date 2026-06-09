import { Badge } from '@estate/ui';

import type { AdminPropertyResult } from '../../lib/admin-properties.js';
import { formatPrice, priceQualifier, rentFrequency } from '../../lib/format.js';

// EPIC-H property management (FR-H-2 list) — the admin catalogue table.
// Presentational + pure; token-driven (G7). Semantic table (`<th scope="col">`).
// The admin-relevant signal the public catalogue hides is **visibility** (a draft
// has no publishedAt), shown as a Badge; market status is humanised text. Every
// price carries its qualifier + rent frequency (the trust-marker pattern — G8).

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function saleTypeLabel(saleType: string): string {
  if (saleType === 'rent') return 'To rent';
  if (saleType === 'sale') return 'For sale';
  return humanise(saleType);
}

function pageHref(page: number): string {
  return page > 1 ? `/admin/properties?page=${page}` : '/admin/properties';
}

export function AdminPropertiesTable({ result }: { result: AdminPropertyResult }) {
  const { items, total, page, totalPages } = result;

  return (
    <div className="flex flex-col gap-4">
      <p className="t-body-sm text-text-secondary" aria-live="polite">
        {total === 0 ? 'No listings' : `Showing ${items.length} of ${total} listings`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No listings yet. Properties you add — including unpublished drafts — appear here.
        </p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-divider border-b">
              {['Address', 'Type', 'Price', 'Status', 'Visibility'].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="t-body-sm text-text-secondary py-2 pr-4 font-semibold"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((property) => {
              // Destructure into locals so the figure is rendered as a plain value
              // alongside its qualifier + frequency (the trust-marker pattern — G8).
              const qualifier = priceQualifier(property.marketStatus);
              const priceText = formatPrice(property.price);
              const frequency = rentFrequency(property.saleType);
              return (
                <tr key={property.id} className="border-divider border-b align-top">
                  <td className="py-3 pr-4">
                    <span className="t-body-md block">{property.displayAddress}</span>
                    {property.title ? (
                      <span className="t-body-sm text-text-secondary">{property.title}</span>
                    ) : null}
                  </td>
                  <td className="t-body-md py-3 pr-4">{saleTypeLabel(property.saleType)}</td>
                  <td className="py-3 pr-4">
                    <span className="t-caption text-text-secondary block">{qualifier}</span>
                    <span className="t-body-md">
                      {priceText}
                      {frequency ? ` ${frequency}` : ''}
                    </span>
                  </td>
                  <td className="t-body-md py-3 pr-4">{humanise(property.marketStatus)}</td>
                  <td className="py-3">
                    {property.publishedAt ? (
                      <Badge tone="success">Published</Badge>
                    ) : (
                      <Badge tone="neutral">Draft</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a className="t-body-md text-brand-primary" href={pageHref(page - 1)}>
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a className="t-body-md text-brand-primary" href={pageHref(page + 1)}>
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
