import { withTenant } from '@estate/db';
import { formatRuntime } from '@estate/scheduler';

import { getDb } from '../../lib/db.js';
import { loadScheduledTasks, type ScheduledTasksReader } from '../../lib/scheduled-tasks.js';
import { requireStaffPermission } from '../../lib/staff-session.js';
import { getCurrentTenantId, getTenantTimezone } from '../../lib/tenant.js';
import { ScheduledTasksTable, type ScheduledTaskView } from './ScheduledTasksTable.js';

// EPIC-U FR-U-7 / FR-U-8 / FR-U-10 + master spec §H.23 — the scheduled-tasks console.
// Gates on `setting.manage` (RBAC fail-closed — this surface exposes platform internals
// and drives them), resolves the tenant and its zone, folds the run log into one row per
// declared worker inside the tenant RLS scope, and renders the table.
//
// Every timestamp is formatted HERE, in the TENANT's zone (FR-U-9): a console that told a
// London agency their 07:00 digest runs at 06:00 would be worse than useless. The read
// model and the fold are unit-tested, so this route stays a thin composition.

export const dynamic = 'force-dynamic';

/** Render an instant on the tenant's wall clock ("14 Jul 2026, 07:00"). */
function formatInstant(value: Date | null, timeZone: string): string {
  if (value === null) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}

export default async function ScheduledTasksPage() {
  await requireStaffPermission('setting.manage');

  const tenantId = await getCurrentTenantId();
  const timeZone = await getTenantTimezone(getDb(), tenantId);
  const now = new Date();

  const rows = await withTenant(getDb(), tenantId, (tx) =>
    loadScheduledTasks(tx as unknown as ScheduledTasksReader, { now, timeZone }),
  );

  const tasks: ScheduledTaskView[] = rows.map((row) => ({
    id: row.worker.id,
    name: row.worker.name,
    description: row.worker.description,
    schedule: row.worker.schedule,
    lastRun: formatInstant(row.lastRunAt, timeZone),
    outcome: row.lastOutcome,
    detail: row.lastDetail,
    averageRuntime: formatRuntime(row.averageRuntimeMs),
    runCount: row.runCount,
    nextRun: row.worker.perTenant ? formatInstant(row.nextRunAt, timeZone) : 'Continuous',
    paused: row.paused,
    runRequested: row.runRequested,
    controllable: row.worker.perTenant,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="t-display-sm">Scheduled tasks</h1>
        <p className="t-body-sm text-text-secondary max-w-[65ch]">
          Every background job on the platform, when it last ran for you and when it runs next.
          Times are shown in your agency’s time zone ({timeZone}) — the daily and weekly alert
          digests are sent at that local hour, not a fixed server hour. Pausing a task stops it for
          your agency only, and is recorded in the audit log.
        </p>
      </div>
      <ScheduledTasksTable tasks={tasks} />
    </div>
  );
}
