import Link from 'next/link';

import { getMenu } from '../app/(app)/lib/cms.js';
import { getCurrentPathname, getCurrentTenantId } from '../app/(app)/lib/tenant.js';
import { filterPublicNav, type NavItem } from '../app/(app)/lib/menu-mapper.js';
import { DEFAULT_NAV, SiteNav } from './SiteNav.js';

// EPIC-D FR-D-7 (B24): the public header. Async server-component GLUE — it fetches
// the current tenant's `header` menu and renders the presentational SiteNav. Like
// app/lib/cms.ts it constructs the Payload instance, so it is verified by runtime
// smoke / e2e and excluded from unit coverage (the testable parts are the pure
// mapper + SiteNav). Resilient: falls back to DEFAULT_NAV when the menu is
// absent/empty OR the tenant/menu lookup throws, so the shell always renders.

async function resolveHeaderItems(): Promise<NavItem[]> {
  try {
    const tenantId = await getCurrentTenantId();
    const menu = await getMenu('header', tenantId);
    const items = menu ? filterPublicNav(menu.items) : [];
    return items.length > 0 ? items : DEFAULT_NAV;
  } catch {
    return DEFAULT_NAV;
  }
}

export async function SiteHeader() {
  const items = await resolveHeaderItems();
  const currentPath = (await getCurrentPathname()) ?? undefined;
  return (
    <header className="bg-surface-base border-border border-b">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="font-display t-heading-sm text-text-primary">
          Estate
        </Link>
        <SiteNav items={items} currentPath={currentPath} />
      </div>
    </header>
  );
}
