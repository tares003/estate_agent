import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { listRedirects, type RedirectReader } from '../../../lib/redirects.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { RedirectRulesTable } from './RedirectRulesTable.js';

// EPIC-O FR-O-11 — the managed redirect-rules admin. Gates on `setting.manage` (RBAC
// fail-closed), resolves the tenant, lists the rules inside the tenant RLS scope, and
// renders the table + the add/edit/delete controls. The read model + the table are
// unit-tested, so this route stays a thin composition. Mirrors the stamp-duty settings
// page. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function RedirectsSettingsPage() {
  await requireStaffPermission('setting.manage');

  const tenantId = await getCurrentTenantId();
  const rows = await withTenant(getDb(), tenantId, (tx) =>
    listRedirects(tx as unknown as RedirectReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Redirects</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Send an old URL to a new one. When a path changes, add a rule here so the old address
          keeps working and search engines follow it. Changes are recorded in the audit log.
        </p>
      </div>
      <RedirectRulesTable
        rows={rows.map((row) => ({
          id: row.id,
          sourcePath: row.sourcePath,
          destinationPath: row.destinationPath,
          type: row.type,
          hitCount: row.hitCount,
          lastHitAt: row.lastHitAt ? row.lastHitAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
