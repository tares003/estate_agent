import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { withTenant } from '@estate/db';
import { PropertyCard } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { listSavedProperties, type SavedPropertyReader } from '../../lib/saved-properties.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { SavePropertyButton } from './SavePropertyButton.js';

// EPIC-T FR-T-1/5/6 (master spec §C.17, brief line 20) — the saved-properties list.
// Gates on a signed-in customer (redirect to /sign-in with ?next preserved when
// signed out, per the account-area acceptance criteria), resolves the tenant, reads
// the customer's saved properties inside the tenant RLS scope (newest-first, stale /
// withdrawn favourites dropped by the read model), and renders one PropertyCard per
// saved property with a heart that unsaves it (FR-T-6 — clicking Saved removes the
// favourite and refreshes the list). Shows a friendly empty state otherwise. The
// read model + the heart are unit-tested, so this route stays a thin composition.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Saved properties',
  robots: { index: false, follow: false },
};

export default async function SavedPropertiesPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent('/account/saved')}`);
  }

  const tenantId = await getCurrentTenantId();
  const { items } = await withTenant(getDb(), tenantId, (tx) =>
    listSavedProperties(tx as unknown as SavedPropertyReader, session.userId),
  );

  return (
    <main id="main" className="container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="t-display-sm">Saved properties</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Properties you have added to your favourites. Open any to see the full detail, or tap the
          heart to remove one.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-surface-raised flex flex-col items-start gap-4 rounded-lg p-6">
          <p className="t-body-lg text-text-secondary max-w-[55ch]">
            You have not saved any properties yet. Tap the heart on any property to keep it here.
          </p>
          <a href="/properties" className="t-body-md text-brand-accent underline">
            Browse properties
          </a>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ id, ...card }) => (
            <li key={id} className="flex flex-col gap-3">
              <PropertyCard {...card} />
              <SavePropertyButton propertyId={id} signedIn initialSaved />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
