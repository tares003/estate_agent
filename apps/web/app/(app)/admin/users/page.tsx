import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { listUsers, type UserListReader } from '../../lib/users.js';
import { UsersTable } from './UsersTable.js';

// EPIC-H user/role management (FR-H-15 list) — the staff directory at /admin/users.
// Resolves the tenant, runs the read inside the tenant RLS scope, renders the table.
// Thin composition; renders inside the admin shell's `main` landmark. Role editing /
// invites (FR-H-15 write) land with the Better Auth staff-session work.

export const dynamic = 'force-dynamic';

interface UsersPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = (await searchParams) ?? {};
  const rawPage = Array.isArray(params['page']) ? params['page'][0] : params['page'];
  const parsedPage = Number.parseInt(rawPage ?? '', 10);
  const options = Number.isFinite(parsedPage) && parsedPage > 1 ? { page: parsedPage } : {};

  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listUsers(tx as unknown as UserListReader, options),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Team</h1>
      <UsersTable result={result} />
    </div>
  );
}
