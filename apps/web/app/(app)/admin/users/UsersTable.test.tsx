// responsive-coverage: opt-out all — asserts the table composition + pagination;
// responsive layout is the admin-routes Playwright pass.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { UserListResult, UserRow } from '../../lib/users.js';
import { UsersTable } from './UsersTable.js';

function row(over: Partial<UserRow> = {}): UserRow {
  return { id: 'u1', name: 'Ana Agent', email: 'ana@agency.test', role: 'sales_agent', ...over };
}

function result(over: Partial<UserListResult> = {}): UserListResult {
  return { items: [row()], total: 1, page: 1, pageSize: 25, totalPages: 1, ...over };
}

describe('UsersTable', () => {
  it('renders a row per user with a humanised role badge', () => {
    render(<UsersTable result={result({ items: [row({ role: 'super_admin' })] })} />);
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Ana Agent')).toBeInTheDocument();
    expect(table.getByText('ana@agency.test')).toBeInTheDocument();
    expect(table.getByText('Super admin')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 staff')).toBeInTheDocument();
  });

  it('shows an empty state when there are no staff', () => {
    render(<UsersTable result={result({ items: [], total: 0 })} />);
    expect(screen.getByText('No staff users')).toBeInTheDocument();
  });

  it('builds pagination links', () => {
    render(<UsersTable result={result({ items: [row()], total: 60, page: 2, totalPages: 3 })} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    expect(within(nav).getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/admin/users?page=3',
    );
  });
});
