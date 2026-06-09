import { withTenant } from '@estate/db';
import { PropertyCard } from '@estate/ui';
import { parsePropertySearch, type PropertySearch } from '@estate/validators';
import { getDb } from '../../lib/db.js';
import {
  searchProperties,
  type PropertyListReader,
  type PropertySearchOptions,
} from '../../lib/properties.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { PropertyFilters } from './PropertyFilters.js';
import { activeChips, toSearchQuery } from './search-params.js';

export const dynamic = 'force-dynamic';

interface CataloguePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Map the URL filters to the repository options (price £ → pence; omit unset). */
function toOptions(search: PropertySearch): PropertySearchOptions {
  return {
    sort: search.sort,
    page: search.page,
    ...(search.location ? { location: search.location } : {}),
    ...(search.saleType ? { saleType: search.saleType } : {}),
    ...(search.listingType ? { listingType: search.listingType } : {}),
    ...(search.priceMin != null ? { priceMin: search.priceMin * 100 } : {}),
    ...(search.priceMax != null ? { priceMax: search.priceMax * 100 } : {}),
    ...(search.bedroomsMin != null ? { bedroomsMin: search.bedroomsMin } : {}),
    ...(search.bathroomsMin != null ? { bathroomsMin: search.bathroomsMin } : {}),
  };
}

/**
 * EPIC-F property catalogue (master spec §C.10 / §K.1). URL-driven filter + sort
 * + pagination: the query string is the single source of truth. Resolves the
 * tenant, runs the search inside the tenant RLS scope, and renders the filter
 * bar, active-filter chips, result count, the PropertyCard grid, and pagination.
 * The query/mapping logic is unit-tested in lib/ and search-params.ts.
 */
export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const search = parsePropertySearch((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    searchProperties(tx as unknown as PropertyListReader, toOptions(search)),
  );

  const { items, total, page, totalPages } = result;
  const chips = activeChips(search);
  const heading =
    search.saleType === 'rent'
      ? 'Properties to rent'
      : search.saleType === 'sale'
        ? 'Properties for sale'
        : 'Properties';

  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">{heading}</h1>

      <PropertyFilters current={search} />

      {chips.length > 0 ? (
        <ul aria-label="Active filters" className="mb-6 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <a
                href={`/properties${chip.removeQuery}`}
                aria-label={`Remove ${chip.label} filter`}
                className="t-body-sm bg-surface-sunken inline-flex items-center gap-2 rounded-full px-3 py-1"
              >
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="t-body-sm text-text-secondary mb-6" aria-live="polite">
        {total === 0 ? 'No matches' : `${total} ${total === 1 ? 'property' : 'properties'}`}
      </p>

      {items.length === 0 ? (
        <p className="t-body-lg text-text-secondary max-w-[55ch]">
          No properties match your search just yet. Try widening your filters, or register for
          alerts.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((card) => (
            <PropertyCard key={card.href} {...card} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <a
              className="t-body-md"
              href={`/properties${toSearchQuery(search, { page: page - 1 })}`}
            >
              ← Previous
            </a>
          ) : null}
          <span className="t-body-sm text-text-secondary">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a
              className="t-body-md"
              href={`/properties${toSearchQuery(search, { page: page + 1 })}`}
            >
              Next →
            </a>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
