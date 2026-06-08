import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';
import { getDb } from '../../../lib/db.js';
import { getPropertyBySlug, type PropertyDetailReader } from '../../../lib/properties.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { EnquiryForm } from './EnquiryForm.js';

export const dynamic = 'force-dynamic';

interface PropertyDetailPageProps {
  params: Promise<{ slug: string }>;
}

/** One key fact rendered in the spec list, when the value is present. */
interface Fact {
  label: string;
  value: number;
}

/**
 * EPIC-F property detail. Resolves the tenant, fetches the single published
 * property by slug inside the tenant RLS scope, and renders the detail beside
 * the buyer-enquiry form. An unknown / unpublished / soft-deleted slug yields a
 * 404 via `notFound()`. The data mapping is unit-tested in lib/; this composes it.
 */
export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { slug } = await params;
  const tenantId = await getCurrentTenantId();
  const property = await withTenant(getDb(), tenantId, (tx) =>
    getPropertyBySlug(tx as unknown as PropertyDetailReader, slug),
  );

  if (!property) {
    notFound();
  }

  // Destructured to locals so the price renders as a bare identifier beside its
  // qualifier + frequency markers (the trust-marker pattern PropertyCard uses).
  const { address, title, price, priceQualifier, rentFrequency } = property;

  const facts: Fact[] = [];
  if (property.bedrooms != null) facts.push({ label: 'Bedrooms', value: property.bedrooms });
  if (property.bathrooms != null) facts.push({ label: 'Bathrooms', value: property.bathrooms });
  if (property.receptions != null) facts.push({ label: 'Receptions', value: property.receptions });

  return (
    <main id="main" className="container py-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.6fr_1fr]">
        <article>
          <header className="flex flex-col gap-2">
            <p className="t-body-md text-text-secondary">{address}</p>
            <h1 className="t-display-sm">{title}</h1>
            <p className="flex items-baseline gap-3">
              <span className="t-heading-md">{price}</span>
              <span className="t-body-sm text-text-secondary">
                {priceQualifier}
                {rentFrequency ? ` · ${rentFrequency}` : ''}
              </span>
            </p>
          </header>

          {facts.length > 0 ? (
            <dl className="mt-8 flex flex-wrap gap-8">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col">
                  <dt className="t-caption text-text-secondary">{fact.label}</dt>
                  <dd className="t-heading-sm">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {property.description ? (
            <p className="t-body-lg mt-8 max-w-[60ch] whitespace-pre-line">
              {property.description}
            </p>
          ) : null}
        </article>

        <aside aria-label="Enquire about this property">
          <EnquiryForm propertyId={property.id} propertyTitle={title} />
        </aside>
      </div>
    </main>
  );
}
