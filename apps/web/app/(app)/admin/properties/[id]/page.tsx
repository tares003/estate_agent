import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getAdminProperty, type AdminPropertyDetailReader } from '../../../lib/admin-properties.js';
import { getDb } from '../../../lib/db.js';
import { formatPrice, priceQualifier, rentFrequency } from '../../../lib/format.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';

// EPIC-H property management (FR-H-2) — the admin detail for one listing (drafts
// included). Resolves the tenant, reads the listing by id inside the tenant RLS
// scope (404 if unknown), and shows its current values. Read-only for now; the
// editable form lands next. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default async function AdminPropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const property = await withTenant(getDb(), tenantId, (tx) =>
    getAdminProperty(tx as unknown as AdminPropertyDetailReader, id),
  );

  if (!property) notFound();

  // Destructure the figure to a local so it renders beside its qualifier (G8).
  const qualifier = priceQualifier(property.marketStatus);
  const priceText = formatPrice(property.price);
  const frequency = rentFrequency(property.saleType);

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Type', value: property.saleType === 'rent' ? 'To rent' : 'For sale' },
    { label: 'Market status', value: humanise(property.marketStatus) },
    { label: 'Postcode', value: property.postcode },
  ];
  if (property.bedrooms != null)
    stats.push({ label: 'Bedrooms', value: String(property.bedrooms) });
  if (property.bathrooms != null)
    stats.push({ label: 'Bathrooms', value: String(property.bathrooms) });
  if (property.receptions != null)
    stats.push({ label: 'Receptions', value: String(property.receptions) });

  return (
    <div className="flex max-w-[70ch] flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/properties" className="t-body-sm text-brand-primary">
          ← Back to properties
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-display-sm">{property.displayAddress}</h1>
          {property.publishedAt ? (
            <Badge tone="success">Published</Badge>
          ) : (
            <Badge tone="neutral">Draft</Badge>
          )}
        </div>
        {property.title ? <p className="t-body-lg text-text-secondary">{property.title}</p> : null}
      </div>

      <section aria-labelledby="price-heading" className="flex flex-col gap-1">
        <h2 id="price-heading" className="t-heading-sm">
          Price
        </h2>
        <span className="t-body-sm text-text-secondary">{qualifier}</span>
        <span className="t-display-sm">
          {priceText}
          {frequency ? ` ${frequency}` : ''}
        </span>
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-3">
        <h2 id="details-heading" className="t-heading-sm">
          Details
        </h2>
        <dl className="t-body-md grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
          {stats.map((stat) => (
            <div key={stat.label} className="contents">
              <dt className="text-text-secondary">{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {property.description ? (
        <section aria-labelledby="desc-heading" className="flex flex-col gap-3">
          <h2 id="desc-heading" className="t-heading-sm">
            Description
          </h2>
          <p className="t-body-md whitespace-pre-wrap">{property.description}</p>
        </section>
      ) : null}
    </div>
  );
}
