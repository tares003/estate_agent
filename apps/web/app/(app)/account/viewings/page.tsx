import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { withTenant } from '@estate/db';
import { Badge } from '@estate/ui';

import { getCustomerSession } from '../../lib/customer-session.js';
import {
  listCustomerViewings,
  resolveVerifiedCustomerEmail,
  type CustomerViewing,
  type VerifiedEmailReader,
  type ViewingHistoryReader,
} from '../../lib/customer-viewings.js';
import { getDb } from '../../lib/db.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { statusDisplay } from '../../admin/enquiries/status-display.js';

// EPIC-T FR-T-9 (master spec §C.17) — the viewing-requests history. Gates on a
// signed-in customer (redirect to /sign-in with ?next preserved when signed out, per
// the account-area acceptance criteria), resolves the tenant, resolves the customer's
// VERIFIED account email, then reads the tenant's viewing-request enquiries matched
// to that email inside the tenant RLS scope (newest-first).
//
// LINKAGE NOTE (a directed decision — flagged for human review in the PR): the data
// model carries no owner FK from a viewing to a customer account, so a viewing
// request is matched to the customer by their VERIFIED email — the only owner signal
// that exists. FR-T-10 (cancel a viewing) is intentionally OUT of scope here: an
// email match is too weak to authorise a mutation. This is a READ-only surface; a
// future slice adds a proper userId link + cancel.
//
// Each row shows the enquiry's ACTUAL status (labelled via the shared enquiry-status
// presenter — never a fabricated viewing-specific status) and links to the property.
// The read model is unit-tested, so this route stays a thin composition.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your viewings',
  robots: { index: false, follow: false },
};

/** Fixed-locale date format so the output is deterministic across runtimes / tests. */
const REQUEST_DATE = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export default async function ViewingsHistoryPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent('/account/viewings')}`);
  }

  const tenantId = await getCurrentTenantId();
  const viewings = await withTenant(getDb(), tenantId, async (rawTx) => {
    const tx = rawTx as unknown as VerifiedEmailReader & ViewingHistoryReader;
    const email = await resolveVerifiedCustomerEmail(tx, session.userId);
    if (!email) return [] as CustomerViewing[];
    return listCustomerViewings(tx, email);
  });

  return (
    <main id="main" className="container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="t-display-sm">Your viewings</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The viewing requests you have made, most recent first. Each shows its current status and
          the property it relates to.
        </p>
      </div>

      {viewings.length === 0 ? (
        <div className="bg-surface-raised flex flex-col items-start gap-4 rounded-lg p-6">
          <p className="t-body-lg text-text-secondary max-w-[55ch]">
            You haven’t requested any viewings yet. Find a property you like and request a viewing
            from its page.
          </p>
          <a href="/properties" className="t-body-md text-brand-accent underline">
            Browse properties
          </a>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {viewings.map((viewing) => {
            const display = statusDisplay(viewing.status);
            return (
              <li
                key={viewing.id}
                className="border-divider bg-surface-raised flex flex-col gap-2 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col gap-1">
                  {viewing.propertySlug ? (
                    <Link
                      href={`/properties/${viewing.propertySlug}`}
                      className="t-heading-sm text-brand-primary font-semibold underline"
                    >
                      {viewing.propertyLabel}
                    </Link>
                  ) : (
                    <span className="t-heading-sm text-text-primary font-semibold">
                      {viewing.propertyLabel}
                    </span>
                  )}
                  <span className="t-body-sm text-text-secondary">
                    Requested {REQUEST_DATE.format(viewing.requestedAt)}
                  </span>
                </span>
                <Badge tone={display.tone}>{display.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
