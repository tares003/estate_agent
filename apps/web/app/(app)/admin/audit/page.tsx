import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { listAuditLogs, type AuditLogReader } from '../../lib/audit-log.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { AuditLogTable } from './AuditLogTable.js';
import { parseAuditParams } from './audit-params.js';

// EPIC-H audit-log viewer (FR-H-17) — every state-changing action, with full diff,
// actor, IP and time. URL-driven (entity / page); resolves the tenant, runs the
// read inside the tenant RLS scope (audit_logs is RLS-isolated), renders the table.
// Thin composition; renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

interface AuditPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const options = parseAuditParams((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listAuditLogs(tx as unknown as AuditLogReader, options),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Audit log</h1>
      <AuditLogTable result={result} options={options} />
    </div>
  );
}
