// responsive-coverage: opt-out all — asserts the table composition, filter wiring,
// badges and pagination; the stack-to-cards responsive layout is covered by the
// admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { EnquiryQueueItem, EnquiryQueueResult } from '../../lib/enquiries.js';
import { EnquiryQueueTable } from './EnquiryQueueTable.js';

function item(over: Partial<EnquiryQueueItem> = {}): EnquiryQueueItem {
  return {
    id: 'e1',
    name: 'Sam Buyer',
    email: 'sam@example.com',
    status: 'new',
    propertyId: null,
    ageBand: 'green',
    ...over,
  };
}

function result(over: Partial<EnquiryQueueResult> = {}): EnquiryQueueResult {
  return { items: [item()], total: 1, page: 1, pageSize: 25, totalPages: 1, ...over };
}

describe('EnquiryQueueTable', () => {
  it('renders a row per enquiry, linking the name to its detail', () => {
    render(<EnquiryQueueTable result={result()} options={{}} />);
    const link = screen.getByRole('link', { name: 'Sam Buyer' });
    expect(link).toHaveAttribute('href', '/admin/enquiries/e1');
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 enquiry')).toBeInTheDocument();
  });

  it('shows the status + response-age badges', () => {
    render(
      <EnquiryQueueTable
        result={result({ items: [item({ status: 'converted', ageBand: 'red' })] })}
        options={{}}
      />,
    );
    // scope to the table — "Converted" also appears as a filter <option>
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Converted')).toBeInTheDocument();
    expect(table.getByText('Overdue')).toBeInTheDocument();
  });

  it('reflects the current filter in the form and shows an empty state', () => {
    render(
      <EnquiryQueueTable result={result({ items: [], total: 0 })} options={{ status: 'lost' }} />,
    );
    expect(screen.getByText('No enquiries')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('lost');
  });

  it('builds pagination links preserving the filter', () => {
    render(
      <EnquiryQueueTable
        result={result({ items: [item()], total: 60, page: 2, totalPages: 3 })}
        options={{ status: 'new' }}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=new',
    );
    expect(within(nav).getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/admin/enquiries?status=new&page=3',
    );
  });
});
