import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { getCustomerSession } from '../../lib/customer-session.js';
import { getCustomerProfile, type CustomerProfileReader } from '../../lib/customer-profile.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { ProfileForm } from './ProfileForm.js';

// EPIC-T FR-T-11 (master spec §C.17) — the customer profile page. Gates on a
// signed-in customer (redirect to /sign-in with ?next preserved when signed out,
// per the account-area acceptance criteria), resolves the tenant, reads the
// customer's OWN editable profile inside the tenant RLS scope, and renders the
// prefilled edit form. The read model + the audited action + the form behaviour
// are unit-tested, so this route stays a thin composition.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your profile',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent('/account/profile')}`);
  }

  const tenantId = await getCurrentTenantId();
  const profile = await withTenant(getDb(), tenantId, (tx) =>
    getCustomerProfile(tx as unknown as CustomerProfileReader, session.userId),
  );

  if (!profile) {
    // A resolved customer session always has a backing row; a null here means the
    // record was removed mid-session — send them back to sign in rather than
    // rendering an empty form.
    redirect(`/sign-in?next=${encodeURIComponent('/account/profile')}`);
  }

  return (
    <main id="main" className="container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="t-display-sm">Your profile</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Update your name, phone number and how we contact you. Your email address and password are
          managed from your settings.
        </p>
      </div>

      <div className="bg-surface-raised max-w-[55ch] rounded-lg p-6">
        <ProfileForm
          name={profile.name}
          phone={profile.phone}
          contactByEmail={profile.contactByEmail}
          contactBySms={profile.contactBySms}
          marketingOptIn={profile.marketingOptIn}
        />
      </div>
    </main>
  );
}
