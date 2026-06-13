import Link from 'next/link';
import { withTenant } from '@estate/db';

import { getDb } from '../../../lib/db.js';
import {
  listManagedRepairCategories,
  type ManagedRepairCategoryReader,
} from '../../../lib/repair-categories.js';
import { getCurrentTenantId } from '../../../lib/tenant.js';
import { RepairCategoriesManager } from './RepairCategoriesManager.js';

// EPIC-G repair categories admin (FR-G-4, master spec §G.3). Resolves the tenant,
// reads the full catalogue (visible + hidden) inside the tenant (RLS) scope, and
// renders the manager. The query is unit-tested in lib/repair-categories.ts, so
// this route stays a thin composition. Renders inside the admin shell's `main`.

export const dynamic = 'force-dynamic';

export default async function RepairCategoriesPage() {
  const tenantId = await getCurrentTenantId();
  const categories = await withTenant(getDb(), tenantId, (tx) =>
    listManagedRepairCategories(tx as unknown as ManagedRepairCategoryReader),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/repairs" className="t-body-sm text-brand-primary">
          ← Back to repairs
        </Link>
        <h1 className="t-display-sm">Repair categories</h1>
        <p className="t-body-sm text-text-secondary max-w-[55ch]">
          The categories tenants choose from when they report a repair. Hidden categories stay on
          existing tickets but are no longer offered.
        </p>
      </div>
      <RepairCategoriesManager categories={categories} />
    </div>
  );
}
