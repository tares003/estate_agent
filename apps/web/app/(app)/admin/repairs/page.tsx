import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { listRepairRequests, type RepairListReader } from '../../lib/repairs.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { RepairsInboxTable } from './RepairsInboxTable.js';

// EPIC-G repairs inbox (FR-G-2) — the staff triage queue for tenant repair reports.
// Resolves the tenant, runs the read inside the tenant RLS scope, and renders the
// inbox table. The query + the badge mapping are unit-tested in lib/repairs.ts +
// repair-display.ts, so this route stays a thin composition. Renders inside the
// admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function RepairsInboxPage() {
  const tenantId = await getCurrentTenantId();
  const repairs = await withTenant(getDb(), tenantId, (tx) =>
    listRepairRequests(tx as unknown as RepairListReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Repairs</h1>
      <RepairsInboxTable repairs={repairs} />
    </div>
  );
}
