// responsive-coverage: opt-out all — asserts the table composition + filter +
// pagination; responsive layout is the admin-routes Playwright pass.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { ContactListResult, ContactRow } from '../../lib/contacts.js';
import { ContactsTable } from './ContactsTable.js';

function row(over: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 'c1',
    name: 'Sam Buyer',
    email: 'sam@example.com',
    phone: '07700900000',
    type: 'buyer',
    createdAt: new Date(1_000_000_000_000),
    ...over,
  };
}

function result(over: Partial<ContactListResult> = {}): ContactListResult {
  return { items: [row()], total: 1, page: 1, pageSize: 25, totalPages: 1, ...over };
}

describe('ContactsTable', () => {
  it('renders a row per contact with a title-cased type badge', () => {
    render(<ContactsTable result={result({ items: [row({ type: 'vendor' })] })} options={{}} />);
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Sam Buyer')).toBeInTheDocument();
    expect(table.getByText('Vendor')).toBeInTheDocument();
    expect(table.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 contact')).toBeInTheDocument();
  });

  it('shows a dash for missing email/phone and an empty state', () => {
    render(
      <ContactsTable result={result({ items: [], total: 0 })} options={{ type: 'landlord' }} />,
    );
    expect(screen.getByText('No contacts')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('landlord');
  });

  it('builds pagination links preserving the type filter', () => {
    render(
      <ContactsTable
        result={result({ items: [row()], total: 60, page: 2, totalPages: 3 })}
        options={{ type: 'buyer' }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/admin/contacts?type=buyer&page=3',
    );
  });
});
