import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { AdminShell } from '../../../components/admin/AdminShell.js';
import { getStaffSession } from '../lib/staff-session.js';
import { getCurrentPathname } from '../lib/tenant.js';

// EPIC-H admin shell layout — wraps every `/admin` surface in the chrome AND is
// the segment-wide authentication gate (audit findings admin-read-pages-ungated-
// pii-leak / admin-read-surfaces-missing-rbac-gate): NO resolved staff session →
// redirect to sign-in, so no admin route ever renders unauthenticated. Per-page
// RBAC (`requireStaffPermission('<noun>.read')`) layers the permission check on
// top. Resolves the active path (proxy header) for nav highlighting and the
// signed-in account label from the staff session. Thin glue — the gate + shell
// composition are covered by layout.test.tsx.

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [session, currentPath] = await Promise.all([getStaffSession(), getCurrentPathname()]);
  if (!session) {
    // Fail closed: unauthenticated requests never see any admin surface.
    redirect(`/sign-in?next=${encodeURIComponent(currentPath ?? '/admin')}`);
  }
  return (
    <AdminShell currentPath={currentPath} accountLabel={session.actor}>
      {children}
    </AdminShell>
  );
}
