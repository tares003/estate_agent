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
  { label: 'Calculators', href: '/calculators', target: 'same' },
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
//
// Each link is a ≥44px tap target (WCAG 2.2 SC 2.5.8 / --size-touch-target-min): the
// bare text was ~21px tall on mobile, below the minimum. `inline-flex items-center`
// makes min-height apply and centres the label.
const LINK_TAP = 'inline-flex items-center min-h-[var(--size-touch-target-min)]';
const LINK_BASE = `t-body-md text-text-primary hover:text-brand-primary ${LINK_TAP}`;
const LINK_ACTIVE = `t-body-md text-brand-primary underline underline-offset-4 ${LINK_TAP}`;

function NavLink({
  item,
  currentPath,
  onNavigate,
  block = false,
}: {
  item: NavItem;
  currentPath?: string | undefined;
  /** Called when the link is activated — lets the mobile menu close on navigate. */
  onNavigate?: (() => void) | undefined;
  /** Full-width row (the stacked mobile menu) vs inline (the desktop bar). */
  block?: boolean;
}) {
  const current = currentPath !== undefined && pathOf(item.href) === currentPath;
  const ariaCurrent = current ? ('page' as const) : undefined;
  const base = current ? LINK_ACTIVE : LINK_BASE;
  const className = block ? `${base} w-full` : base;

  if (item.target === 'new') {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-current={ariaCurrent}
        onClick={onNavigate}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={ariaCurrent} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function SiteNav({
  items,
  currentPath,
  orientation = 'horizontal',
  onNavigate,
}: {
  items: NavItem[];
  currentPath?: string | undefined;
  /** `horizontal` is the desktop bar; `vertical` stacks the links for the mobile menu. */
  orientation?: 'horizontal' | 'vertical';
  /** Forwarded to every link's onClick — the mobile menu passes a close handler. */
  onNavigate?: (() => void) | undefined;
}) {
  const vertical = orientation === 'vertical';
  return (
    <nav aria-label="Primary">
      <ul className={vertical ? 'flex flex-col gap-1' : 'flex gap-6'}>
        {items.map((item, index) => (
          // index keeps the key unique even if an author duplicates label+href.
          <li key={`${item.href}-${index}`}>
            <NavLink
              item={item}
              currentPath={currentPath}
              onNavigate={onNavigate}
              block={vertical}
            />
            {item.children && item.children.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2">
                {item.children.map((child, childIndex) => (
                  <li key={`${child.href}-${childIndex}`}>
                    <NavLink
                      item={child}
                      currentPath={currentPath}
                      onNavigate={onNavigate}
                      block={vertical}
                    />
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
