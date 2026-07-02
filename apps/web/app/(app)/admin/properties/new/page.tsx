import Link from 'next/link';

import { getEnabledVerticals } from '../../../lib/packs.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { createProperty } from '../actions.js';
import { PropertyForm } from '../PropertyForm.js';

// EPIC-H property management (FR-H-2 write) / EPIC-F (FR-F-1) — the admin CREATE form
// at /admin/properties/new. Gates on `property.write` (RBAC fail-closed at the page)
// before rendering, then hands the audited createProperty action to the shared form.
// On success the form routes to the new listing's admin detail page. Renders inside the
// admin shell's `main` landmark. The per-vertical extension fields (FR-F-3) are a later
// slice — this is the always-on CORE only.

export const dynamic = 'force-dynamic';

export default async function NewPropertyPage() {
  // RBAC gate — fail closed before rendering the create form. The action re-checks on
  // submit (defence in depth); this stops the form appearing to an unauthorised user.
  await requireStaffPermission('property.write');

  // FR-F-3 — resolve which vertical listing types the tenant may author so the
  // per-vertical extension subsections gate correctly (EPIC-AD / G12).
  const enabledVerticals = await getEnabledVerticals();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/properties" className="t-body-sm text-brand-primary">
          ← Back to properties
        </Link>
        <h1 className="t-display-sm">New property</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Create a listing with its core details. You can add images and publish it from the listing
          page once it is created. Changes are recorded in the audit log.
        </p>
      </div>
      <PropertyForm mode="create" action={createProperty} enabledVerticals={enabledVerticals} />
    </div>
  );
}
