import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
}));

const audit = vi.fn();
const repairFindFirst = vi.fn();
const repairUpdate = vi.fn();
const propertyFindFirst = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { findFirst: repairFindFirst, update: repairUpdate },
    property: { findFirst: propertyFindFirst },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { setRepairProperty } = await import('./link-property-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const PROPERTY = '22222222-2222-2222-2222-222222222222';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { repairId: REPAIR, propertyId: PROPERTY, ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  repairFindFirst.mockResolvedValue({ id: REPAIR, propertyId: null });
  propertyFindFirst.mockResolvedValue({ id: PROPERTY });
});

describe('setRepairProperty', () => {
  it('matches the ticket to a tenant-scoped property and audits the link (G4)', async () => {
    const result = await setRepairProperty({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.write');
    // the matched property must exist INSIDE the tenant scope (RLS + live check)
    expect(propertyFindFirst).toHaveBeenCalledWith({
      where: { id: PROPERTY, deletedAt: null },
    });
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { propertyId: PROPERTY },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_request.property_matched',
        entity: 'repair_request',
        entityId: REPAIR,
        diff: { propertyId: { from: null, to: PROPERTY } },
      }),
    );
  });

  it('unmatches when no property is chosen', async () => {
    repairFindFirst.mockResolvedValue({ id: REPAIR, propertyId: PROPERTY });
    const fd = new FormData();
    fd.set('repairId', REPAIR);
    fd.set('propertyId', '');

    const result = await setRepairProperty({ ok: false }, fd);

    expect(result).toEqual({ ok: true });
    expect(propertyFindFirst).not.toHaveBeenCalled();
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { propertyId: null },
    });
  });

  it('refuses an unknown property without writing (cross-tenant ids look unknown under RLS)', async () => {
    propertyFindFirst.mockResolvedValue(null);
    const result = await setRepairProperty({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await setRepairProperty({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('reports a missing ticket without writing', async () => {
    repairFindFirst.mockResolvedValue(null);
    const result = await setRepairProperty({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });
});

// FR-H-17 — the audit trail records actor, diff, IP AND user-agent; every admin
// state-change audit row must carry the request user-agent (audit finding
// audit-log-user-agent-never-captured).
describe('FR-H-17 audit user-agent', () => {
  it('captures the request user-agent in every audit row', async () => {
    await setRepairProperty({ ok: false }, form());

    expect(audit.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of audit.mock.calls) {
      expect(call[1]).toMatchObject({ userAgent: 'Mozilla/5.0 (Test)' });
    }
  });
});
