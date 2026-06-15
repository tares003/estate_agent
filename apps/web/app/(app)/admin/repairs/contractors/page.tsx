import Link from 'next/link';
import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import { listContractors, type ContractorReader } from '../../../lib/contractors.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { ContractorsManager } from './ContractorsManager.js';

// EPIC-G contractor directory admin (FR-G-8, master spec §G.6). Resolves the
// tenant, reads the directory inside the tenant (RLS) scope, and renders the
// manager. The query is unit-tested in lib/contractors.ts, so this route stays a
// thin composition. Renders inside the admin shell's `main` landmark.

export const dynamic = 'force-dynamic';

export default async function ContractorsPage() {
  const tenantId = await getCurrentTenantId();
  const contractors = await withTenant(getDb(), tenantId, (tx) =>
    listContractors(tx as unknown as ContractorReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/repairs" className="t-body-sm text-brand-primary">
          ← Back to repairs
        </Link>
        <h1 className="t-display-sm">Contractors</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The contractors you assign repair tickets to. Inactive contractors stay on past tickets
          but can no longer be assigned.
        </p>
      </div>
      <ContractorsManager contractors={contractors} />
    </div>
  );
}
