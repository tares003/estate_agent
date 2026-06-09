// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const findMany = vi.fn();
const count = vi.fn();
vi.mock('@estate/db', () => ({
  withTenant: async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
    fn({ auditLog: { findMany, count } }),
}));

const { default: AuditPage } = await import('./page.js');

const row = {
  id: 'a1',
  actor: 'agent:dev-staff',
  action: 'enquiry.converted',
  entity: 'enquiry',
  entityId: 'e1',
  diff: { status: { from: 'contacted', to: 'converted' } },
  ip: '203.0.113.7',
  userAgent: null,
  createdAt: new Date('2026-06-09T12:00:00.000Z'),
};

function params(p: Record<string, string>) {
  return { searchParams: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('AuditPage', () => {
  it('renders the audit heading + an entry from the tenant-scoped read', async () => {
    render(await AuditPage(params({})));
    expect(screen.getByRole('heading', { level: 1, name: 'Audit log' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('enquiry.converted')).toBeInTheDocument();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('passes the entity filter through and renders with no params', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    render(await AuditPage(params({ entity: 'enquiry' })));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entity: 'enquiry' } }),
    );

    render(await AuditPage({}));
    expect(screen.getAllByRole('heading', { level: 1, name: 'Audit log' }).length).toBeGreaterThan(
      0,
    );
  });
});
