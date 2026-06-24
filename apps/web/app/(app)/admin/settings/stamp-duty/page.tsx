import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { loadSdltConfig, type SdltConfigReader } from '../../../lib/sdlt-config.js';
import { requireStaffPermission } from '../../../lib/staff-session.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { StampDutyConfigEditor } from './StampDutyConfigEditor.js';

// EPIC-W FR-W-3 — the SDLT band-config admin. Gates on `calculator_config.manage`
// (RBAC fail-closed), resolves the tenant, loads the stored config (or the engine
// default) inside the tenant RLS scope, and renders the editor. The read model +
// the editor are unit-tested, so this route stays a thin composition. Renders
// inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function StampDutyConfigPage() {
  await requireStaffPermission('calculator_config.manage');

  const tenantId = await getCurrentTenantId();
  const config = await withTenant(getDb(), tenantId, (tx) =>
    loadSdltConfig(tx as unknown as SdltConfigReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Stamp duty bands</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The bands the public stamp duty calculator uses. Indicative only — not financial advice.
          Verify against the current HMRC rates before publishing. Changes are recorded in the audit
          log.
        </p>
      </div>
      <StampDutyConfigEditor config={config} />
    </div>
  );
}
