// responsive-coverage: opt-out all — asserts the inbox composition + empty state;
// the responsive layout is the admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { RepairQueueItem, RepairQueueResult } from '../../lib/repairs.js';
import { RepairsInboxTable } from './RepairsInboxTable.js';

function item(over: Partial<RepairQueueItem> = {}): RepairQueueItem {
  return {
    id: 'r1',
    name: 'Tess Tenant',
    reference: 'RPR-2026-04321',
    propertyReference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    urgency: 'emergency',
    status: 'new',
    createdAt: new Date('2026-06-09T10:00:00.000Z'),
    slaRisk: 'breached',
    ...over,
  };
}

function result(
  items: RepairQueueItem[],
  over: Partial<RepairQueueResult> = {},
): RepairQueueResult {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 24,
    totalPages: 1,
    ...over,
  };
}

describe('RepairsInboxTable', () => {
  it('renders an empty state when there are no repairs', () => {
    render(<RepairsInboxTable result={result([])} options={{}} />);
    expect(screen.getByText(/No repairs match this view/i)).toBeInTheDocument();
  });

  it('renders a row per repair with the ticket number, badges and the detail link', () => {
    render(
      <RepairsInboxTable
        result={result([
          item(),
          item({
            id: 'r2',
            name: 'Bob Tenant',
            reference: 'RPR-2026-04322',
            propertyReference: '7 Oak Avenue',
            urgency: 'low',
            status: 'on_hold',
            slaRisk: 'on_track',
          }),
        ])}
        options={{}}
      />,
    );
    const table = screen.getByRole('table');
    // the §G.2 ticket-ID column
    expect(within(table).getByText('RPR-2026-04321')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Tess Tenant' })).toHaveAttribute(
      'href',
      '/admin/repairs/r1',
    );
    expect(within(table).getByText('Flat 2, 14 Palatine Road')).toBeInTheDocument();
    expect(within(table).getByText('Emergency')).toBeInTheDocument();
    expect(within(table).getByText('Breached')).toBeInTheDocument();
    expect(within(table).getByText('On hold')).toBeInTheDocument();
    expect(within(table).getByText('On track')).toBeInTheDocument();
  });

  it('offers status + urgency filters as a GET form', () => {
    render(<RepairsInboxTable result={result([item()])} options={{ urgency: 'emergency' }} />);
    const form = screen.getByRole('form', { name: /Filter repairs/i });
    expect(within(form).getByLabelText(/Status/i)).toBeInTheDocument();
    expect(within(form).getByLabelText(/Urgency/i)).toHaveValue('emergency');
  });

  it('paginates with the active filters preserved', () => {
    render(
      <RepairsInboxTable
        result={result([item()], { total: 60, page: 2, totalPages: 3 })}
        options={{ urgency: 'emergency', page: 2 }}
      />,
    );
    expect(screen.getByRole('link', { name: /Previous/i })).toHaveAttribute(
      'href',
      '/admin/repairs?urgency=emergency',
    );
    expect(screen.getByRole('link', { name: /Next/i })).toHaveAttribute(
      'href',
      '/admin/repairs?urgency=emergency&page=3',
    );
  });
});
