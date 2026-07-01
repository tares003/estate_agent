import { requireStaffPermission } from '../../../lib/staff-session.js';
import { PropertyImportForm } from './PropertyImportForm.js';

// EPIC-X FR-X-1 — the admin bulk CSV property-import page. Gates on `property.write`
// (RBAC fail-closed — a bulk import creates listings, the same capability the create
// form needs) before rendering, then renders the upload form. The parse core, the
// audited action and the form are unit-tested, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function PropertyImportPage() {
  await requireStaffPermission('property.write');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Import properties</h1>
        <p className="t-body-sm text-text-secondary max-w-[60ch]">
          Upload a CSV to create listings in bulk. Each row becomes a new property. Rows that fail
          validation are skipped with a reason and the rest still import. Every run is recorded in
          the audit log and the import history.
        </p>
      </div>
      <PropertyImportForm />
    </div>
  );
}
