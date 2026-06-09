import { describe, expect, it } from 'vitest';

import { ADMIN_NAV, isAdminNavItemActive } from './admin-nav.js';

describe('ADMIN_NAV', () => {
  it('lists the live admin surfaces (Dashboard + Enquiries)', () => {
    const hrefs = ADMIN_NAV.flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs).toContain('/admin');
    expect(hrefs).toContain('/admin/enquiries');
    expect(hrefs).toContain('/admin/contacts');
    expect(hrefs).toContain('/admin/reports');
    expect(hrefs).toContain('/admin/audit');
  });

  it('every item has a non-empty label and an /admin-rooted href', () => {
    for (const section of ADMIN_NAV) {
      for (const item of section.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.href.startsWith('/admin')).toBe(true);
      }
    }
  });
});

describe('isAdminNavItemActive', () => {
  it('matches the Dashboard root only exactly (never as a prefix)', () => {
    expect(isAdminNavItemActive('/admin', '/admin')).toBe(true);
    expect(isAdminNavItemActive('/admin', '/admin/enquiries')).toBe(false);
  });

  it('matches a section and its nested routes', () => {
    expect(isAdminNavItemActive('/admin/enquiries', '/admin/enquiries')).toBe(true);
    expect(isAdminNavItemActive('/admin/enquiries', '/admin/enquiries/abc-123')).toBe(true);
  });

  it('does not match an unrelated path or a partial segment', () => {
    expect(isAdminNavItemActive('/admin/enquiries', '/admin/properties')).toBe(false);
    expect(isAdminNavItemActive('/admin/enquiries', '/admin/enquiries-archive')).toBe(false);
  });

  it('is inactive when the path is unknown', () => {
    expect(isAdminNavItemActive('/admin', null)).toBe(false);
  });
});
