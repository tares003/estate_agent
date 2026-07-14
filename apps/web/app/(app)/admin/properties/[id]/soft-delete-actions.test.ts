import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-F FR-F-10 — the audited soft-delete Server Action (audit finding
// property-soft-delete-action-missing). Every public read already filters
// `deletedAt: null`; this action is the one WRITE path that sets it. The data
// layer, request context and staff session are doubled so the action is
// exercised in isolation.

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
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

const { softDeleteProperty } = await import('./soft-delete-actions.js');

const PROP = '11111111-1111-1111-1111-111111111111';
const TENANT = '00000000-0000-0000-0000-000000000001';

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { id: PROP, ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue({ id: PROP });
  update.mockResolvedValue({});
});

describe('softDeleteProperty', () => {
  it('soft-deletes the listing (sets deletedAt) and audits it in the same tenant transaction (FR-F-10, G4)', async () => {
    const result = await softDeleteProperty({ ok: false }, form());

    expect(result).toEqual({ ok: true });
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
    expect(withTenant).toHaveBeenCalledWith({}, TENANT, expect.any(Function));
    // only a live (not-yet-deleted) row qualifies — deleting twice is a not-found
    expect(findFirst).toHaveBeenCalledWith({ where: { id: PROP, deletedAt: null } });
    expect(update).toHaveBeenCalledWith({
      where: { id: PROP },
      data: { deletedAt: expect.any(Date) },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'property.soft_deleted',
        entity: 'property',
        entityId: PROP,
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (Test)',
      }),
    );
  });

  it('records the deletion timestamp in the audit diff', async () => {
    await softDeleteProperty({ ok: false }, form());
    const diff = audit.mock.calls[0]![1].diff as { deletedAt: { from: null; to: string } };
    expect(diff.deletedAt.from).toBeNull();
    expect(typeof diff.deletedAt.to).toBe('string');
  });

  it('rejects a non-uuid id before any read/write', async () => {
    const result = await softDeleteProperty({ ok: false }, form({ id: 'nope' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated on property.write — denies before withTenant (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await softDeleteProperty({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the listing is absent or already deleted', async () => {
    findFirst.mockResolvedValue(null);
    const result = await softDeleteProperty({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
