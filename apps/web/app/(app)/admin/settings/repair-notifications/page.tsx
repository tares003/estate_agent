import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import {
  loadRepairNotificationConfig,
  type RepairNotificationConfigReader,
} from '../../../lib/repair-notification-config.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { RepairNotificationConfigEditor } from './RepairNotificationConfigEditor.js';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the repair notification routing admin. Gates on `setting.manage` (RBAC
// fail-closed — the platform-settings permission), resolves the tenant, loads the
// configured internal recipients inside the tenant RLS scope, and renders the
// editor. The read model + the editor are unit-tested, so this route stays a thin
// composition. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function RepairNotificationConfigPage() {
  await requireStaffPermission('setting.manage');

  const tenantId = await getCurrentTenantId();
  const config = await withTenant(getDb(), tenantId, (tx) =>
    loadRepairNotificationConfig(tx as unknown as RepairNotificationConfigReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Repair notifications</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          Where new repair reports are routed internally. Every report emails the repairs queue; an
          emergency report also pages the on-call manager by SMS. Reporters always receive their own
          confirmation separately. Changes are recorded in the audit log.
        </p>
      </div>
      <RepairNotificationConfigEditor config={config} />
    </div>
  );
}
