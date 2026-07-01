import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { withTenant } from '@estate/db';

import { getAccountSummary, type AccountSummaryReader } from '../lib/account-summary.js';
import { getCustomerSession } from '../lib/customer-session.js';
import { getDb } from '../lib/db.js';
import { getCurrentTenantId } from '../lib/tenant.js';

// EPIC-T (master spec §C.17) — the /account dashboard landing: a signed-in
// customer's home that ties together their saved properties, saved searches,
// viewings and profile. Gates on a signed-in customer (redirect to /sign-in with
// ?next preserved when signed out, mirroring the sibling account routes), resolves
// the tenant, reads the at-a-glance summary (name + saved counts) inside the tenant
// RLS scope, and renders a friendly greeting plus a card per destination — each
// showing its count where the read model surfaces one. Read-only: no writes, no
// consent surface. The summary read model is unit-tested, so this route stays a
// thin composition.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

/** A dashboard card: a destination in the account area, optionally with a count. */
interface AccountCard {
  label: string;
  href: string;
  hint: string;
  /** The at-a-glance count, when the summary surfaces one for this destination. */
  count?: number;
}

/**
 * The greeting name: the customer's first name when we have their name, else a
 * neutral fallback so the greeting never reads "Welcome back, null".
 */
function greetingName(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'there';
}

export default async function AccountDashboardPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent('/account')}`);
  }

  const tenantId = await getCurrentTenantId();
  const summary = await withTenant(getDb(), tenantId, (tx) =>
    getAccountSummary(tx as unknown as AccountSummaryReader, session.userId),
  );

  const cards: AccountCard[] = [
    {
      label: 'Saved properties',
      href: '/account/saved',
      hint: 'Properties you have added to your favourites',
      count: summary.savedPropertiesCount,
    },
    {
      label: 'Saved searches',
      href: '/account/searches',
      hint: 'Get email alerts when new properties match',
      count: summary.savedSearchesCount,
    },
    {
      label: 'Viewings',
      href: '/account/viewings',
      hint: 'Your viewing requests and their status',
    },
    {
      label: 'Profile',
      href: '/account/profile',
      hint: 'Your name, phone and contact preferences',
    },
  ];

  return (
    <main id="main" className="container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="t-display-sm">Welcome back, {greetingName(summary.name)}</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Your saved properties, saved searches, viewings and profile — all in one place.
        </p>
      </div>

      <section aria-labelledby="account-sections-heading">
        <h2 id="account-sections-heading" className="sr-only">
          Your account sections
        </h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.href}>
              <Link
                href={card.href}
                className="border-divider bg-surface-raised hover:border-brand-primary flex h-full flex-col gap-1 rounded-lg border p-6"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="t-heading-sm text-brand-primary font-semibold">
                    {card.label}
                  </span>
                  {card.count !== undefined ? (
                    <span className="t-display-sm text-brand-primary" aria-hidden="true">
                      {card.count}
                    </span>
                  ) : null}
                </span>
                <span className="t-body-sm text-text-secondary">
                  {card.count !== undefined ? `${card.count} saved — ${card.hint}` : card.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
