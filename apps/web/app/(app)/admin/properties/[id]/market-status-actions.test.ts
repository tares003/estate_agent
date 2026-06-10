import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const eventCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ property: { findFirst, update }, propertyStatusEvent: { create: eventCreate } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { setPropertyMarketStatus } = await import('./market-status-actions.js');

const PROP = '11111111-1111-1111-1111-111111111111';
const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { id: PROP, marketStatus: 'under_offer', ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  getStaffUserId.mockResolvedValue(null);
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue({ id: PROP, marketStatus: 'for_sale' });
  update.mockResolvedValue({});
  eventCreate.mockResolvedValue({});
});

describe('setPropertyMarketStatus', () => {
  it('changes the status, records a PropertyStatusEvent, and audits it (G4)', async () => {
    const result = await setPropertyMarketStatus(
      { ok: false },
      form({ marketStatus: 'under_offer' }),
    );

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
    expect(update).toHaveBeenCalledWith({
      where: { id: PROP },
      data: { marketStatus: 'under_offer' },
    });
    expect(eventCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        propertyId: PROP,
        fromStatus: 'for_sale',
        toStatus: 'under_offer',
        changedByAgentId: null,
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'property.status_changed',
        diff: { marketStatus: { from: 'for_sale', to: 'under_offer' } },
      }),
    );
  });

  it('is a no-op (no event/update) when the status is unchanged', async () => {
    const result = await setPropertyMarketStatus({ ok: false }, form({ marketStatus: 'for_sale' }));
    expect(result).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an unknown status before any write', async () => {
    const result = await setPropertyMarketStatus({ ok: false }, form({ marketStatus: 'pending' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated on property.write — denies before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await setPropertyMarketStatus({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the listing is absent', async () => {
    findFirst.mockResolvedValue(null);
    const result = await setPropertyMarketStatus({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });
});
