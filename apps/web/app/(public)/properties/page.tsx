import { withTenant } from '@estate/db';
import { PropertyCard } from '@estate/ui';
import { getDb } from '../../lib/db.js';
import { listProperties } from '../../lib/properties.js';
import { getCurrentTenantId } from '../../lib/tenant.js';

export const dynamic = 'force-dynamic';

interface CataloguePageProps {
  searchParams?: Promise<{ saleType?: string }>;
}

/**
 * EPIC-F property catalogue. Resolves the tenant, runs the listing query inside
 * the tenant RLS scope, and renders the PropertyCard grid. The mapping/format
 * logic is unit-tested in lib/; this composes it.
 */
export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const params = (await searchParams) ?? {};
  const saleType =
    params.saleType === 'rent' ? 'rent' : params.saleType === 'sale' ? 'sale' : undefined;
  const tenantId = await getCurrentTenantId();
  const cards = await withTenant(getDb(), tenantId, (tx) =>
    listProperties(
      tx as unknown as Parameters<typeof listProperties>[0],
      saleType ? { saleType } : {},
    ),
  );

  return (
    <main id="main" className="container py-12">
      <h1 className="t-display-sm">
        Properties {saleType === 'rent' ? 'to rent' : saleType === 'sale' ? 'for sale' : ''}
      </h1>
      {cards.length === 0 ? (
        <p className="t-body-lg text-text-secondary mt-6 max-w-[55ch]">
          No properties match your search just yet. Try a different filter, or register for alerts.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <PropertyCard key={card.href} {...card} />
          ))}
        </div>
      )}
    </main>
  );
}
