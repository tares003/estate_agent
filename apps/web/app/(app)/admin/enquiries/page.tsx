import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { listEnquiries, type EnquiryListReader } from '../../lib/enquiries.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { EnquiryQueueTable } from './EnquiryQueueTable.js';
import { parseEnquiryQueueParams } from './queue-params.js';

// EPIC-H enquiry queue (FR-H-3) — the CRM lead queue. URL-driven (status / sort /
// page); resolves the tenant, runs the read inside the tenant RLS scope, and
// renders the queue table. The query/mapping logic is unit-tested in lib/ +
// queue-params.ts, so this route stays a thin composition. Renders inside the
// admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

interface EnquiryQueuePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EnquiryQueuePage({ searchParams }: EnquiryQueuePageProps) {
  const options = parseEnquiryQueueParams((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listEnquiries(tx as unknown as EnquiryListReader, options, Date.now()),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Enquiries</h1>
      <EnquiryQueueTable result={result} options={options} />
    </div>
  );
}
