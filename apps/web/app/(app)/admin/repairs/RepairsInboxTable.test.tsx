// responsive-coverage: opt-out all — asserts the inbox composition + empty state;
// the responsive layout is the admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { RepairRow } from '../../lib/repairs.js';
import { RepairsInboxTable } from './RepairsInboxTable.js';

function row(over: Partial<RepairRow> = {}): RepairRow {
  return {
    id: 'r1',
    name: 'Tess Tenant',
    reference: 'Flat 2, 14 Palatine Road',
    category: 'Plumbing',
    urgency: 'emergency',
    status: 'new',
    createdAt: new Date('2026-06-09T10:00:00.000Z'),
    ...over,
  };
}

describe('RepairsInboxTable', () => {
  it('renders an empty state when there are no repairs', () => {
    render(<RepairsInboxTable repairs={[]} />);
    expect(screen.getByText(/No repairs reported yet/i)).toBeInTheDocument();
  });

  it('renders a row per repair with the urgency + status badges', () => {
    render(
      <RepairsInboxTable
        repairs={[row(), row({ id: 'r2', name: 'Bob Tenant', urgency: 'low', status: 'completed' })]}
      />,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('Tess Tenant')).toBeInTheDocument();
    expect(within(table).getByText('Flat 2, 14 Palatine Road')).toBeInTheDocument();
    expect(within(table).getByText('Emergency')).toBeInTheDocument();
    expect(within(table).getByText('New')).toBeInTheDocument();
    expect(within(table).getByText('Bob Tenant')).toBeInTheDocument();
    expect(within(table).getByText('Completed')).toBeInTheDocument();
  });

  it('shows a dash when a repair has no property reference', () => {
    render(<RepairsInboxTable repairs={[row({ reference: null })]} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('—')).toBeInTheDocument();
  });
});
