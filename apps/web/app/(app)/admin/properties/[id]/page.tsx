import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getAdminProperty, type AdminPropertyDetailReader } from '../../../lib/admin-properties.js';
import { getDb } from '../../../lib/db.js';
import {
  listPropertyImages,
  renditionKeyFor,
  type PropertyImageReader,
} from '../../../lib/property-images.js';
import {
  listPropertyStatusEvents,
  type PropertyEventReader,
} from '../../../lib/property-status-events.js';
import { signedObjectPath } from '../../../lib/storage.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { marketStatusesForSaleType } from './market-status-display.js';
import { MarketStatusControl } from './MarketStatusControl.js';
import { PropertyEditForm } from './PropertyEditForm.js';
import { PropertyImagesManager } from './PropertyImagesManager.js';
import { PropertyTimeline } from './PropertyTimeline.js';
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
  const data = await withTenant(getDb(), tenantId, async (tx) => {
    const property = await getAdminProperty(tx as unknown as AdminPropertyDetailReader, id);
    if (!property) return null;
    const events = await listPropertyStatusEvents(tx as unknown as PropertyEventReader, id);
    const images = await listPropertyImages(tx as unknown as PropertyImageReader, id);
    return { property, events, images };
  });

  if (!data) notFound();

  const { property, events, images } = data;
  // Render-time signed thumbnails (CLAUDE.md §9 — files served via signed URLs).
  const thumbExpiry = Date.now() + 15 * 60_000;
  const managedImages = images.map((image) => ({
    id: image.id,
    alt: image.alt,
    isPrimary: image.isPrimary,
    thumbUrl: signedObjectPath(renditionKeyFor(image, 'thumb'), thumbExpiry),
  }));

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

      <section aria-labelledby="images-heading" className="flex flex-col gap-3">
        <h2 id="images-heading" className="t-heading-sm">
          Images
        </h2>
        <PropertyImagesManager propertyId={property.id} images={managedImages} />
      </section>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <h2 id="activity-heading" className="t-heading-sm">
          Status history
        </h2>
        <PropertyTimeline events={events} />
      </section>
    </div>
  );
}
