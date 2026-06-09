// responsive-coverage: opt-out all — asserts the table composition + pagination;
// responsive layout is the admin-routes Playwright pass.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { AdminPropertyResult, AdminPropertyRow } from '../../lib/admin-properties.js';
import { AdminPropertiesTable } from './AdminPropertiesTable.js';

function row(over: Partial<AdminPropertyRow> = {}): AdminPropertyRow {
  return {
    id: 'p1',
    title: 'Edwardian semi',
    displayAddress: 'Palatine Road, Didsbury',
    saleType: 'sale',
    marketStatus: 'for_sale',
    price: 52_500_000,
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...over,
  };
}

function result(over: Partial<AdminPropertyResult> = {}): AdminPropertyResult {
  return { items: [row()], total: 1, page: 1, pageSize: 25, totalPages: 1, ...over };
}

describe('AdminPropertiesTable', () => {
  it('renders a listing with humanised type/status, £ price, and a Published badge', () => {
    render(
      <AdminPropertiesTable result={result({ items: [row({ marketStatus: 'under_offer' })] })} />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Palatine Road, Didsbury')).toBeInTheDocument();
    expect(table.getByText('For sale')).toBeInTheDocument(); // saleType
    expect(table.getByText('Under offer')).toBeInTheDocument(); // humanised marketStatus
    expect(table.getByText('£525,000')).toBeInTheDocument();
    expect(table.getByText('Published')).toBeInTheDocument();
  });

  it('marks an unpublished listing as a Draft and shows POA for no price', () => {
    render(
      <AdminPropertiesTable
        result={result({ items: [row({ publishedAt: null, price: null })] })}
      />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Draft')).toBeInTheDocument();
    expect(table.getByText('POA')).toBeInTheDocument();
  });

  it('shows an empty state when there are no listings', () => {
    render(<AdminPropertiesTable result={result({ items: [], total: 0 })} />);
    expect(screen.getByText('No listings')).toBeInTheDocument();
  });

  it('builds pagination links', () => {
    render(
      <AdminPropertiesTable
        result={result({ items: [row()], total: 60, page: 2, totalPages: 3 })}
      />,
    );
    expect(
      within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('link', {
        name: 'Next →',
      }),
    ).toHaveAttribute('href', '/admin/properties?page=3');
  });
});
