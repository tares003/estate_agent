import type { ReactNode } from 'react';

import { AdminShell } from '../../../components/admin/AdminShell.js';
import { getStaffActor } from '../lib/staff-session.js';
import { getCurrentPathname } from '../lib/tenant.js';

// EPIC-H admin shell layout — wraps every `/admin` surface in the chrome. Resolves
// the active path (proxy header) for nav highlighting and the signed-in account
// (staff-session seam; a DEV STUB until EPIC-N). Thin glue — the shell + nav logic
// are unit-tested; this composition is verified by the page tests + `next build`.

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [currentPath, accountLabel] = await Promise.all([getCurrentPathname(), getStaffActor()]);
  return (
    <AdminShell currentPath={currentPath} accountLabel={accountLabel}>
      {children}
    </AdminShell>
  );
}
