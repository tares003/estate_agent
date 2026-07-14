import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { loadRepairSlaConfig, type RepairSlaConfigReader } from '../../../lib/repair-sla-config.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { RepairSlaConfigEditor } from './RepairSlaConfigEditor.js';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// repair SLA admin. Gates on `setting.manage` (RBAC fail-closed — the
// platform-settings permission), resolves the tenant, loads the configured §G.4
// targets + FR-G-9 badge thresholds inside the tenant RLS scope (falling back to the
// spec defaults when unconfigured), and renders the editor. The read model, the
// banding and the editor are unit-tested, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function RepairSlaConfigPage() {
  await requireStaffPermission('setting.manage');

  const tenantId = await getCurrentTenantId();
  const config = await withTenant(getDb(), tenantId, (tx) =>
    loadRepairSlaConfig(tx as unknown as RepairSlaConfigReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Repair SLAs</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The SLA target for each repair urgency, and the points at which the repairs inbox flags a
          ticket as at risk of breaching it. New agencies start on the standard targets; changes are
          recorded in the audit log.
        </p>
      </div>
      <RepairSlaConfigEditor config={config} />
    </div>
  );
}
