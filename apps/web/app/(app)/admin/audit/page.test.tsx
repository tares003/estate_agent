// responsive-coverage: opt-out all — asserts the data→table composition + the
// tenant-scoped query; responsive layout is the admin-routes Playwright pass.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../lib/tenant.js', () => ({ getCurrentTenantId: async () => 'tenant-1' }));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

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
  requireStaffPermission.mockResolvedValue(undefined);
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(1);
});

describe('AuditPage', () => {
  // Audit finding admin-read-surfaces-missing-rbac-gate: the audit trail (actor,
  // IP, diffs) must be RBAC-gated fail-closed, mirroring feedback/page.tsx.
  it('gates on the audit.read permission before reading', async () => {
    render(await AuditPage(params({})));
    expect(requireStaffPermission).toHaveBeenCalledWith('audit.read');
  });

  it('propagates a denial WITHOUT reading the audit log (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValueOnce(new Error('denied'));
    await expect(AuditPage(params({}))).rejects.toThrow('denied');
    expect(findMany).not.toHaveBeenCalled();
  });

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
