import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withTenant } from '@estate/db';

import { getDb } from '../../../../lib/db.js';
import { getEnabledVerticals } from '../../../../lib/packs.js';
import { getPropertyForEdit, type PropertyEditReader } from '../../../../lib/property-edit.js';
import { requireStaffPermission } from '../../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../../lib/tenant.js';
import { updateProperty } from '../../actions.js';
import { PropertyForm } from '../../PropertyForm.js';

// EPIC-H property management (FR-H-2 write) / EPIC-F (FR-F-1 / FR-F-5) — the admin EDIT
// form at /admin/properties/[id]/edit. Gates on `property.write` (RBAC fail-closed at the
// page), resolves the tenant, loads the listing's CORE fields inside the tenant RLS scope
// (404 if unknown), and pre-fills the shared form with the audited updateProperty action.
// A slug change on save auto-creates a 301 redirect (the action handles it). Renders
// inside the admin shell's `main` landmark. The per-vertical extension fields (FR-F-3)
// are a later slice — this is the always-on CORE only.

export const dynamic = 'force-dynamic';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  // RBAC gate — fail closed before reading or rendering. The action re-checks on submit.
  await requireStaffPermission('property.write');

  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  const property = await withTenant(getDb(), tenantId, (tx) =>
    getPropertyForEdit(tx as unknown as PropertyEditReader, id),
  );

  if (!property) notFound();

  // FR-F-3 — the authorable verticals gate the per-vertical subsections; the extension
  // pre-fill values come from the same edit model.
  const enabledVerticals = await getEnabledVerticals();
  const verticalInitial = {
    isOffPlan: property.isOffPlan,
    developmentName: property.developmentName,
    vatPayable: property.vatPayable,
    annualBusinessRates: property.annualBusinessRates,
    useClass: property.useClass,
    annualTurnover: property.annualTurnover,
    grossProfit: property.grossProfit,
    netProfit: property.netProfit,
    yearsTrading: property.yearsTrading,
    staffCount: property.staffCount,
    currentAnnualRent: property.currentAnnualRent,
    isConfidential: property.isConfidential,
    bedCount: property.bedCount,
    cqcRating: property.cqcRating,
    cqcInspectionUrl: property.cqcInspectionUrl,
    isGoingConcern: property.isGoingConcern,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/admin/properties/${property.id}`} className="t-body-sm text-brand-primary">
          ← Back to listing
        </Link>
        <h1 className="t-display-sm">Edit property</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Edit the core details. Changing the URL slug creates a 301 redirect from the old address
          automatically. Changes are recorded in the audit log.
        </p>
      </div>
      <PropertyForm
        mode="edit"
        action={updateProperty}
        initial={property}
        enabledVerticals={enabledVerticals}
        verticalInitial={verticalInitial}
      />
    </div>
  );
}
