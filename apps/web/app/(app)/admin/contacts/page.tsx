import { withTenant } from '@estate/db';

import { getDb } from '../../lib/db.js';
import { listContacts, type ContactListReader } from '../../lib/contacts.js';
import { getCurrentTenantId } from '../../lib/tenant.js';
import { ContactsTable } from './ContactsTable.js';
import { parseContactListParams } from './contacts-params.js';

// EPIC-H contacts (FR-H-7 list) — the contact directory. URL-driven (type / page);
// resolves the tenant, runs the read inside the tenant RLS scope, renders the
// table. Thin composition over unit-tested pieces; renders inside the admin shell's
// `main` landmark. The full FR-H-7 (per-type tabs, dedup/merge, compliance) is
// deferred.

export const dynamic = 'force-dynamic';

interface ContactsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const options = parseContactListParams((await searchParams) ?? {});
  const tenantId = await getCurrentTenantId();
  const result = await withTenant(getDb(), tenantId, (tx) =>
    listContacts(tx as unknown as ContactListReader, options),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-display-sm">Contacts</h1>
      <ContactsTable result={result} options={options} />
    </div>
  );
}
