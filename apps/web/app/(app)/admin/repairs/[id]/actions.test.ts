import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (repairStatusUpdateSchema + the §G.5 transition
// allow-list) drives the rules; the data layer, request context and staff session
// are doubled so the action is exercised in isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
}));

const audit = vi.fn();
const repairFindFirst = vi.fn();
const repairUpdate = vi.fn();
const eventCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { findFirst: repairFindFirst, update: repairUpdate },
    repairStatusEvent: { create: eventCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { setRepairStatus } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const REPAIR = '11111111-1111-1111-1111-111111111111';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { repairId: REPAIR, to: 'triaged', ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  getStaffUserId.mockResolvedValue('staff-1');
  repairFindFirst.mockResolvedValue({ id: REPAIR, status: 'new' });
});

describe('setRepairStatus', () => {
  it('advances the workflow: update + history row + audit in one tenant transaction (FR-G-6/FR-G-7, G4)', async () => {
    const result = await setRepairStatus({ ok: false }, form({ notes: 'Looks like a real leak' }));

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.write');
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { status: 'triaged' },
    });
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        repairRequestId: REPAIR,
        fromStatus: 'new',
        toStatus: 'triaged',
        actorUserId: 'staff-1',
        notes: 'Looks like a real leak',
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_request.status_changed',
        entity: 'repair_request',
        entityId: REPAIR,
        diff: { status: { from: 'new', to: 'triaged' } },
      }),
    );
  });

  it('stores the rejection reason on the ticket when rejecting (§G.5)', async () => {
    repairFindFirst.mockResolvedValue({ id: REPAIR, status: 'triaged' });
    const result = await setRepairStatus(
      { ok: false },
      form({ to: 'rejected', notes: 'Tenant-caused damage.' }),
    );

    expect(result).toEqual({ ok: true });
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { status: 'rejected', rejectedReason: 'Tenant-caused damage.' },
    });
  });

  it('refuses rejecting without a reason before any write', async () => {
    const result = await setRepairStatus({ ok: false }, form({ to: 'rejected' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses an illegal transition (no write, no history)', async () => {
    repairFindFirst.mockResolvedValue({ id: REPAIR, status: 'new' });
    const result = await setRepairStatus({ ok: false }, form({ to: 'completed' }));

    expect(result.ok).toBe(false);
    expect(result.errors?.[0]?.message).toMatch(/cannot move/i);
    expect(repairUpdate).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await setRepairStatus({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(repairFindFirst).not.toHaveBeenCalled();
  });

  it('reports not-found without writing anything', async () => {
    repairFindFirst.mockResolvedValue(null);
    const result = await setRepairStatus({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });
});
