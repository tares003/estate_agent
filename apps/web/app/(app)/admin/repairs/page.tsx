import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { loadRepairSlaConfig, type RepairSlaConfigReader } from '../../lib/repair-sla-config.js';
import { listRepairRequests, type RepairListReader } from '../../lib/repairs.js';
import { requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { parseRepairQueueParams } from './queue-params.js';
import { RepairsInboxTable } from './RepairsInboxTable.js';

// EPIC-G repairs inbox (FR-G-2/FR-G-5/FR-G-9) — the staff triage queue for tenant
// repair reports. Gates on `repair_request.read` (RBAC fail-closed — tickets hold
// reporter PII). URL-driven (status / urgency / sort / page); resolves the tenant,
// then inside ONE tenant RLS scope loads the tenant's SLA config (the §G.4 targets +
// the FR-G-9 badge thresholds, defaulting to the spec values when unconfigured) and
// the page of tickets, so the badges band against what the admin configured at
// /admin/settings/repair-sla. The query, the SLA banding and the badge mapping are
// unit-tested in lib/ + repair-display.ts, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

interface RepairsInboxPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RepairsInboxPage({ searchParams }: RepairsInboxPageProps) {
  await requireStaffPermission('repair_request.read');

  const options = parseRepairQueueParams((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, async (tx) => {
    const slaConfig = await loadRepairSlaConfig(tx as unknown as RepairSlaConfigReader);
    return listRepairRequests(tx as unknown as RepairListReader, options, Date.now(), slaConfig);
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Repairs</h1>
      <RepairsInboxTable result={result} options={options} />
    </div>
  );
}
