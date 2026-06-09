// responsive-coverage: opt-out all — asserts the shell composition (nav + main +
// account); the stack-below-md responsive layout is covered by the admin-routes
// Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdminShell } from './AdminShell.js';

describe('AdminShell', () => {
  it('renders the nav rail, the account, and a main landmark wrapping the content', () => {
    render(
      <AdminShell currentPath="/admin" accountLabel="agent:dev-staff" title="Dashboard">
        <p>Surface content</p>
      </AdminShell>,
    );

    expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByText('agent:dev-staff')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveTextContent('Surface content');
  });

  it('falls back to a generic title when none is given', () => {
    render(
      <AdminShell currentPath="/admin" accountLabel="agent:dev-staff">
        <p>x</p>
      </AdminShell>,
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
