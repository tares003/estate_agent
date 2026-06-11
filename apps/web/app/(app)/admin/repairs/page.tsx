import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { listRepairRequests, type RepairListReader } from '../../lib/repairs.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { parseRepairQueueParams } from './queue-params.js';
import { RepairsInboxTable } from './RepairsInboxTable.js';

// EPIC-G repairs inbox (FR-G-2/FR-G-9) — the staff triage queue for tenant repair
// reports. URL-driven (status / urgency / sort / page); resolves the tenant, runs
// the read inside the tenant RLS scope, and renders the inbox table with FR-G-9
// SLA-risk badges. The query, the SLA banding and the badge mapping are
// unit-tested in lib/ + repair-display.ts, so this route stays a thin composition.
// Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

interface RepairsInboxPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RepairsInboxPage({ searchParams }: RepairsInboxPageProps) {
  const options = parseRepairQueueParams((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listRepairRequests(tx as unknown as RepairListReader, options, Date.now()),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Repairs</h1>
      <RepairsInboxTable result={result} options={options} />
    </div>
  );
}
