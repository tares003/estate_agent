import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { listSavedSearches, type SavedSearchReader } from '../../lib/saved-searches.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { criteriaSummary, runSearchHref } from './criteria.js';
import { SavedSearchRow } from './SavedSearchRow.js';

// EPIC-T FR-T-8 (master spec §C.17) — the saved-searches management list. Gates on
// a signed-in customer (redirect to /sign-in with ?next preserved when signed out,
// per the account-area acceptance criteria), resolves the tenant, reads the
// customer's saved searches inside the tenant RLS scope (newest-first), and renders
// one management row per search (rename / change cadence / delete) or an empty
// state. The read model + the per-row control + the criteria presenters are
// unit-tested, so this route stays a thin composition.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Saved searches',
  robots: { index: false, follow: false },
};

export default async function SavedSearchesPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent('/account/searches')}`);
  }

  const tenantId = await getCurrentTenantId();
  const searches = await withTenant(getDb(), tenantId, (tx) =>
    listSavedSearches(tx as unknown as SavedSearchReader, session.userId),
  );

  return (
    <main id="main" className="container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="t-display-sm">Saved searches</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Searches you have saved from the property catalogue. Choose how often we email you when
          new properties match, rename a search, or remove one you no longer need.
        </p>
      </div>

      {searches.length === 0 ? (
        <div className="bg-surface-raised flex flex-col items-start gap-4 rounded-lg p-6">
          <p className="t-body-lg text-text-secondary max-w-[55ch]">
            Save a search to get email alerts when new properties match.
          </p>
          <a href="/properties" className="t-body-md text-brand-accent underline">
            Browse properties
          </a>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {searches.map((search) => (
            <SavedSearchRow
              key={search.id}
              id={search.id}
              name={search.name}
              alertFrequency={search.alertFrequency}
              criteriaSummary={criteriaSummary(search.filters)}
              runHref={runSearchHref(search.filters)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
