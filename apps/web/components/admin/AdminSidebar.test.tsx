// responsive-coverage: opt-out all — asserts the nav structure + active-state
// wiring; the collapsing-rail responsive layout is covered by the admin-routes
// Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { AdminSidebar } from './AdminSidebar.js';

describe('AdminSidebar', () => {
  it('is a labelled navigation landmark with the live surfaces', () => {
    render(<AdminSidebar currentPath="/admin" />);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(within(nav).getByRole('link', { name: 'Enquiries' })).toHaveAttribute(
      'href',
      '/admin/enquiries',
    );
  });

  it('marks the active item with aria-current and a visible weight change', () => {
    render(<AdminSidebar currentPath="/admin/enquiries/abc" />);
    const active = screen.getByRole('link', { name: 'Enquiries' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('font-semibold');

    const inactive = screen.getByRole('link', { name: 'Dashboard' });
    expect(inactive).not.toHaveAttribute('aria-current');
  });
});
