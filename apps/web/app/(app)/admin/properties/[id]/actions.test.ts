import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (propertyUpdateSchema) drives the rules; the data layer,
// request context, and staff-session seam are doubled.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ property: { findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { updateProperty } = await import('./actions.js');

const PROP = '11111111-1111-1111-1111-111111111111';
const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    id: PROP,
    displayAddress: '1 Palatine Road',
    postcode: 'M20 6RE',
    price: '525000',
    bedrooms: '4',
    ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue({ id: PROP });
  update.mockResolvedValue({});
});

describe('updateProperty', () => {
  it('updates the listing (£→pence) and audits it (G4)', async () => {
    const result = await updateProperty({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
    expect(update).toHaveBeenCalledWith({
      where: { id: PROP },
      data: expect.objectContaining({
        displayAddress: '1 Palatine Road',
        postcode: 'M20 6RE',
        price: 52_500_000, // 525,000 pounds → pence
        bedrooms: 4,
        title: null,
        description: null,
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'property.updated', entity: 'property', entityId: PROP }),
    );
  });

  it('stores POA (null price) when the price is blank', async () => {
    await updateProperty({ ok: false }, form({ price: '' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ price: null }) }),
    );
  });

  it('rejects an invalid update before any write', async () => {
    const result = await updateProperty({ ok: false }, form({ postcode: 'nope' }));
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'postcode' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated — denies without property.write, before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await updateProperty({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the listing is absent', async () => {
    findFirst.mockResolvedValue(null);
    const result = await updateProperty({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
