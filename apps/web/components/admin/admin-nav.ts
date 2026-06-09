// EPIC-H admin shell — the primary navigation map. Pure data + a matcher, so the
// active-state logic is unit-tested in isolation and the chrome stays
// presentational. Grows one section/item per epic as its admin surface lands;
// only routes that exist are listed (no dead links).

export interface AdminNavItem {
  label: string;
  href: string;
}

export interface AdminNavSection {
  label: string;
  items: readonly AdminNavItem[];
}

export const ADMIN_NAV: readonly AdminNavSection[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/admin' }] },
  {
    label: 'CRM',
    items: [
      { label: 'Enquiries', href: '/admin/enquiries' },
      { label: 'Contacts', href: '/admin/contacts' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', href: '/admin/reports' },
      { label: 'Audit log', href: '/admin/audit' },
    ],
  },
];

/**
 * Whether a nav item is the active one for the current path. The Dashboard root
 * matches exactly (every admin route is nested under `/admin`, so a prefix match
 * would light it up everywhere); every other item also matches its nested routes
 * (e.g. `/admin/enquiries/<id>` keeps Enquiries active).
 */
export function isAdminNavItemActive(href: string, currentPath: string | null): boolean {
  if (currentPath === null) return false;
  if (href === '/admin') return currentPath === '/admin';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
