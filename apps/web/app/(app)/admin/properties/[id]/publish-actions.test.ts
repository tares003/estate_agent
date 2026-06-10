import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { setPropertyPublished } = await import('./publish-actions.js');

const PROP = '11111111-1111-1111-1111-111111111111';
const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { id: PROP, publish: 'true', ...over };
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

describe('setPropertyPublished', () => {
  it('publishes (sets publishedAt) and audits it (G4)', async () => {
    const result = await setPropertyPublished({ ok: false }, form({ publish: 'true' }));

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('property.publish');
    expect(update).toHaveBeenCalledWith({
      where: { id: PROP },
      data: { publishedAt: expect.any(Date) },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'property.published', entityId: PROP }),
    );
  });

  it('unpublishes (clears publishedAt) and audits it', async () => {
    await setPropertyPublished({ ok: false }, form({ publish: 'false' }));

    expect(update).toHaveBeenCalledWith({ where: { id: PROP }, data: { publishedAt: null } });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'property.unpublished' }),
    );
  });

  it('rejects a non-uuid id before any write', async () => {
    const result = await setPropertyPublished({ ok: false }, form({ id: 'nope' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated on property.publish — denies before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await setPropertyPublished({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the listing is absent', async () => {
    findFirst.mockResolvedValue(null);
    const result = await setPropertyPublished({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
