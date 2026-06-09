import type { PropertyCardProps } from '@estate/ui';

import { searchProperties, type PropertyListReader } from '../../app/(app)/lib/properties.js';
import { propertyGridToOptions, type PropertyGridConfig } from './property-grid-options.js';

// EPIC-D FR-D-2 `property_grid` renderer. An async server-component that fetches
// the current tenant's published properties matching the block's filter config
// and renders them with the shared PropertyCard. The data-layer deps (Prisma via
// @estate/db, the request tenant, the UI card) are DYNAMICALLY imported at render
// so the lightweight block registry (and the node-env block tests that import it)
// never pull Prisma/next-headers/@estate/ui at module load. This file is therefore
// fetch+render GLUE — excluded from unit coverage; its pure config->options
// mapping lives in property-grid-options.ts and is unit-tested. Resilient: any
// fetch failure renders nothing rather than breaking the page.

export async function PropertyGridBlock({ data }: { data: PropertyGridConfig }) {
  const options = propertyGridToOptions(data);

  let items: PropertyCardProps[] = [];
  try {
    const [{ getDb }, { withTenant }, { getCurrentTenantId }] = await Promise.all([
      import('../../app/(app)/lib/db.js'),
      import('@estate/db'),
      import('../../app/(app)/lib/tenant.js'),
    ]);
    const tenantId = await getCurrentTenantId();
    const result = await withTenant(getDb(), tenantId, (tx) =>
      searchProperties(tx as unknown as PropertyListReader, options),
    );
    items = result.items;
  } catch {
    items = [];
  }

  if (items.length === 0) {
    return null;
  }

  const { PropertyCard } = await import('@estate/ui');
  return (
    <section className="container py-16">
      {data.heading ? <h2 className="t-heading-lg mb-8">{data.heading}</h2> : null}
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            <PropertyCard {...item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
