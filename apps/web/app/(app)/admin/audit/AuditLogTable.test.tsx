// responsive-coverage: opt-out all — asserts the table composition + filter +
// pagination; responsive layout is the admin-routes Playwright pass.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { AuditLogResult, AuditLogRow } from '../../lib/audit-log.js';
import { AuditLogTable } from './AuditLogTable.js';

function row(over: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: 'a1',
    actor: 'agent:dev-staff',
    action: 'enquiry.status_changed',
    entity: 'enquiry',
    entityId: 'e1',
    diff: { status: { from: 'new', to: 'contacted' } },
    ip: '203.0.113.7',
    userAgent: null,
    createdAt: new Date('2026-06-09T12:00:00.000Z'),
    ...over,
  };
}

function result(over: Partial<AuditLogResult> = {}): AuditLogResult {
  return { items: [row()], total: 1, page: 1, pageSize: 25, totalPages: 1, ...over };
}

describe('AuditLogTable', () => {
  it('renders an entry with its action, actor, target, IP and diff', () => {
    render(<AuditLogTable result={result()} options={{}} />);
    const table = within(screen.getByRole('table'));
    expect(table.getByText('enquiry.status_changed')).toBeInTheDocument();
    expect(table.getByText('agent:dev-staff')).toBeInTheDocument();
    expect(table.getByText('enquiry · e1')).toBeInTheDocument();
    expect(table.getByText('203.0.113.7')).toBeInTheDocument();
    expect(table.getByText('{"status":{"from":"new","to":"contacted"}}')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 entries')).toBeInTheDocument();
  });

  it('renders dashes for a missing target id, IP, and diff', () => {
    render(
      <AuditLogTable
        result={result({ items: [row({ entityId: null, ip: null, diff: null })] })}
        options={{}}
      />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('enquiry')).toBeInTheDocument(); // no " · id" suffix
    expect(table.getAllByText('—').length).toBeGreaterThanOrEqual(2); // ip + diff
  });

  it('shows an empty state and reflects the filter', () => {
    render(
      <AuditLogTable result={result({ items: [], total: 0 })} options={{ entity: 'enquiry' }} />,
    );
    expect(screen.getByText('No audit entries')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Entity' })).toHaveValue('enquiry');
  });

  it('builds pagination links preserving the entity filter', () => {
    render(
      <AuditLogTable
        result={result({ items: [row()], total: 60, page: 2, totalPages: 3 })}
        options={{ entity: 'enquiry' }}
      />,
    );
    expect(
      within(screen.getByRole('navigation', { name: 'Pagination' })).getByRole('link', {
        name: 'Next →',
      }),
    ).toHaveAttribute('href', '/admin/audit?entity=enquiry&page=3');
  });
});
