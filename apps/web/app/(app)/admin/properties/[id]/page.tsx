import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getAdminProperty, type AdminPropertyDetailReader } from '../../../lib/admin-properties.js';
import { getDb } from '../../../lib/db.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { marketStatusesForSaleType } from './market-status-display.js';
import { MarketStatusControl } from './MarketStatusControl.js';
import { PropertyEditForm } from './PropertyEditForm.js';
import { PublishControl } from './PublishControl.js';

// EPIC-H property management (FR-H-2) — the admin detail + editor for one listing
// (drafts included). Resolves the tenant, reads the listing by id inside the tenant
// RLS scope (404 if unknown), shows the read-only context (sale type, market status,
// publish state) in the header and the editable core details in the form. Market
// status + publish have their own lifecycle controls (a later slice). Renders inside
// the admin shell's `main` landmark.

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

  const saleTypeLabel = property.saleType === 'rent' ? 'To rent' : 'For sale';

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
        <p className="t-body-sm text-text-secondary">
          {saleTypeLabel} · {humanise(property.marketStatus)}
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-6">
          <PublishControl propertyId={property.id} published={property.publishedAt !== null} />
          <MarketStatusControl
            propertyId={property.id}
            current={property.marketStatus}
            options={marketStatusesForSaleType(property.saleType)}
          />
        </div>
      </div>

      <section aria-labelledby="edit-heading" className="flex flex-col gap-3">
        <h2 id="edit-heading" className="t-heading-sm">
          Core details
        </h2>
        <PropertyEditForm
          property={{
            id: property.id,
            title: property.title,
            displayAddress: property.displayAddress,
            postcode: property.postcode,
            price: property.price,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            receptions: property.receptions,
            description: property.description,
          }}
        />
      </section>
    </div>
  );
}
