import Link from 'next/link';

import type { NavItem } from '../app/(app)/lib/menu-mapper.js';

// EPIC-D FR-D-7 (B24): presentational primary navigation. Pure + props-driven +
// token-driven (no raw hex/px/ms — G7). Accessible: a labelled <nav> landmark,
// real links, aria-current on the active item, external links carry
// rel="noopener noreferrer". The fallback default set lives here; the layer above
// (SiteHeader) decides when to use it vs the CMS menu.

/** The default destinations rendered when no CMS header menu is configured. */
export const DEFAULT_NAV: NavItem[] = [
  { label: 'Buy', href: '/properties?saleType=sale', target: 'same' },
  { label: 'Rent', href: '/properties?saleType=rent', target: 'same' },
  { label: 'Sell', href: '/valuation', target: 'same' },
  { label: 'Contact', href: '/contact', target: 'same' },
];

/** The path portion of an href (drops query + hash) for active-link matching. */
function pathOf(href: string): string {
  return href.split('?')[0]?.split('#')[0] ?? href;
}

// Inactive vs active link styling — token-driven (G7). The active item gets a
// VISIBLE indicator (brand colour + underline), not only aria-current, so sighted
// and assistive-tech users have parity (WCAG 1.4.1 / 1.3.1), matching the design
// canvas's `a[aria-current]` accent treatment.
const LINK_BASE = 't-body-md text-text-primary hover:text-brand-primary';
const LINK_ACTIVE = 't-body-md text-brand-primary underline underline-offset-4';

function NavLink({ item, currentPath }: { item: NavItem; currentPath?: string | undefined }) {
  const current = currentPath !== undefined && pathOf(item.href) === currentPath;
  const ariaCurrent = current ? ('page' as const) : undefined;
  const className = current ? LINK_ACTIVE : LINK_BASE;

  if (item.target === 'new') {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-current={ariaCurrent}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={ariaCurrent}>
      {item.label}
    </Link>
  );
}

export function SiteNav({
  items,
  currentPath,
}: {
  items: NavItem[];
  currentPath?: string | undefined;
}) {
  return (
    <nav aria-label="Primary">
      <ul className="flex gap-6">
        {items.map((item, index) => (
          // index keeps the key unique even if an author duplicates label+href.
          <li key={`${item.href}-${index}`}>
            <NavLink item={item} currentPath={currentPath} />
            {item.children && item.children.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {item.children.map((child, childIndex) => (
                  <li key={`${child.href}-${childIndex}`}>
                    <NavLink item={child} currentPath={currentPath} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
