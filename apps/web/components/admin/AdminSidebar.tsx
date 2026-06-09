import Link from 'next/link';

import { ADMIN_NAV, isAdminNavItemActive, type AdminNavSection } from './admin-nav.js';

// EPIC-H admin shell — the primary navigation rail. Pure + props-driven +
// token-driven (no raw hex/px/ms — G7). Accessible: a labelled <nav> landmark,
// real links, aria-current on the active item, and a VISIBLE active indicator
// (brand colour + weight) so sighted and assistive-tech users have parity
// (WCAG 1.4.1 / 1.3.1). The brand mark sits at the top of the rail.

const ITEM_BASE =
  't-body-md text-text-secondary hover:text-brand-primary block rounded-md px-3 py-2';
const ITEM_ACTIVE =
  't-body-md text-brand-primary bg-surface-base font-semibold block rounded-md px-3 py-2';

function AdminNavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      className={current ? ITEM_ACTIVE : ITEM_BASE}
      aria-current={current ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}

export function AdminSidebar({
  currentPath,
  nav = ADMIN_NAV,
}: {
  currentPath: string | null;
  nav?: readonly AdminNavSection[];
}) {
  return (
    <nav aria-label="Admin" className="bg-surface-sunken flex h-full flex-col gap-6 p-4">
      <span className="t-heading-sm text-brand-primary px-3 font-semibold">Estate</span>
      {nav.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <h2 className="t-caption text-text-muted px-3 uppercase">{section.label}</h2>
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => (
              <li key={item.href}>
                <AdminNavLink
                  href={item.href}
                  label={item.label}
                  current={isAdminNavItemActive(item.href, currentPath)}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
