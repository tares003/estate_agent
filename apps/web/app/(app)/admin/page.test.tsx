// responsive-coverage: opt-out all — asserts the dashboard content + quick links;
// the responsive card grid is covered by the admin-routes Playwright pass
// (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import AdminDashboardPage from './page.js';

describe('AdminDashboardPage', () => {
  it('renders the dashboard heading and quick access to the enquiry queue', () => {
    render(<AdminDashboardPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enquiries/ })).toHaveAttribute(
      'href',
      '/admin/enquiries',
    );
  });
});
