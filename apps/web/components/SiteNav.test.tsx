// responsive-coverage: opt-out all — nav structure/landmark/a11y test; the
// responsive header layout is the design-canvas / page-level e2e concern.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { DEFAULT_NAV, SiteNav } from './SiteNav.js';
import type { NavItem } from '../app/(app)/lib/menu-mapper.js';

// EPIC-D FR-D-7 (B24): presentational, props-driven primary nav. Pure + token-
// driven (mirrors the block components). A11y: a labelled nav landmark, real
// links, aria-current on the active item, external links carry rel=noopener.

describe('SiteNav', () => {
  it('renders a labelled Primary nav landmark', () => {
    render(<SiteNav items={DEFAULT_NAV} />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('renders the default destinations (Buy/Rent/Sell/Contact) with hrefs', () => {
    render(<SiteNav items={DEFAULT_NAV} />);
    for (const label of ['Buy', 'Rent', 'Sell', 'Contact']) {
      const link = screen.getByRole('link', { name: label });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBeTruthy();
    }
  });

  it('opens target:"new" items in a new tab with rel=noopener noreferrer', () => {
    const items: NavItem[] = [
      { label: 'Brochure', href: 'https://example.test/b.pdf', target: 'new' },
      { label: 'Contact', href: '/contact', target: 'same' },
    ];
    render(<SiteNav items={items} />);
    const external = screen.getByRole('link', { name: 'Brochure' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external.getAttribute('rel') ?? '').toContain('noopener');
    expect(external.getAttribute('rel') ?? '').toContain('noreferrer');
    expect(screen.getByRole('link', { name: 'Contact' })).not.toHaveAttribute('target', '_blank');
  });

  it('marks the active item with aria-current AND a visible indicator (WCAG 1.4.1)', () => {
    render(<SiteNav items={DEFAULT_NAV} currentPath="/contact" />);
    const active = screen.getByRole('link', { name: 'Contact' });
    const inactive = screen.getByRole('link', { name: 'Buy' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(inactive).not.toHaveAttribute('aria-current');
    // visible (non-AT) distinction: the active link carries the underline marker,
    // the inactive one does not — information parity for sighted users.
    expect(active.className).toContain('underline');
    expect(inactive.className).not.toContain('underline');
  });

  it('renders child items as a nested list', () => {
    const items: NavItem[] = [
      {
        label: 'Sell',
        href: '/valuation',
        target: 'same',
        children: [{ label: 'Book a valuation', href: '/valuation/book', target: 'same' }],
      },
    ];
    render(<SiteNav items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Book a valuation' })).toBeInTheDocument();
  });

  it('renders the landmark with no links when given an empty list (layout owns the fallback)', () => {
    render(<SiteNav items={[]} />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).queryAllByRole('link')).toHaveLength(0);
  });
});
