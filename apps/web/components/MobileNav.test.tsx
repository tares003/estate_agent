// responsive-coverage: opt-out all — behavioural test for the mobile-menu
// disclosure; the responsive header layout itself is the page-level Playwright
// concern (design-requirements §3).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DEFAULT_NAV } from './SiteNav.js';
import { MobileNav } from './MobileNav.js';

// design-requirements §3: below md the header collapses to a hamburger. The toggle
// is an accessible disclosure (aria-expanded + aria-controls), Escape closes and
// restores focus, and activating a link closes the menu.

afterEach(cleanup);

describe('MobileNav', () => {
  it('is collapsed by default — a labelled toggle and no nav panel', () => {
    render(<MobileNav items={DEFAULT_NAV} />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'mobile-nav-panel');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });

  it('reveals the stacked primary nav when the toggle is pressed', async () => {
    render(<MobileNav items={DEFAULT_NAV} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Buy' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('closes when a link is activated', async () => {
    // an external link renders a plain <a>, so activating it needs no router.
    render(<MobileNav items={[{ label: 'Brochure', href: 'https://x.test/b', target: 'new' }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('link', { name: 'Brochure' }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    render(<MobileNav items={DEFAULT_NAV} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.keyboard('{Escape}');

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });
});
