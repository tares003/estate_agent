import Link from 'next/link';
import { withTenant } from '@estate/db';
import { buttonClassName } from '@estate/ui';

import { getDb } from '../../lib/db.js';
import { listAdminProperties, type AdminPropertyReader } from '../../lib/admin-properties.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { AdminPropertiesTable } from './AdminPropertiesTable.js';

// EPIC-H property management (FR-H-2 list) — the admin catalogue at /admin/properties.
// Shows every listing including unpublished drafts (the public catalogue hides
// these). Resolves the tenant, runs the read inside the tenant RLS scope, renders
// the table. Thin composition; renders inside the admin shell's `main` landmark.
// The nine-tab property editor (FR-H-2 write) is a later slice.

export const dynamic = 'force-dynamic';

interface AdminPropertiesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPropertiesPage({ searchParams }: AdminPropertiesPageProps) {
  const params = (await searchParams) ?? {};
  const rawPage = Array.isArray(params['page']) ? params['page'][0] : params['page'];
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const options = Number.isFinite(parsedPage) && parsedPage > 1 ? { page: parsedPage } : {};

  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listAdminProperties(tx as unknown as AdminPropertyReader, options),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="t-display-sm">Properties</h1>
        <Link
          href="/admin/properties/new"
          className={buttonClassName({ variant: 'primary', size: 'md' })}
        >
          New property
        </Link>
      </div>
      <AdminPropertiesTable result={result} />
    </div>
  );
}
