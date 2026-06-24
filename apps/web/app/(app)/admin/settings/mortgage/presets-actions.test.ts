import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-W FR-W-8 — the audited, RBAC-gated save of a tenant's mortgage rate presets.
// Mirrors the mortgage-config action test: mock the staff-session, tenant and db
// seams; assert fail-closed RBAC, Zod validation, the tenant-scoped replace
// (deleteMany + createMany) and the audit row written in the same transaction (G4).
// Reuses the existing `calculator_config.manage` permission.

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const findMany = vi.fn();
const deleteMany = vi.fn();
const createMany = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ mortgageRatePreset: { findMany, deleteMany, createMany } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { saveMortgageRatePresets } = await import('./presets-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const GOOD_PRESETS = [
  { label: '2-year fixed', annualRatePercent: 4.79, termYears: 25 },
  { label: '5-year fixed', annualRatePercent: 4.49, termYears: 25 },
];

function form(presets: unknown): FormData {
  const fd = new FormData();
  fd.set('presets', JSON.stringify(presets));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:settings');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  findMany.mockResolvedValue([]);
  deleteMany.mockResolvedValue({ count: 0 });
  createMany.mockResolvedValue({ count: 2 });
});

describe('saveMortgageRatePresets', () => {
  it('is exported as a function', () => {
    expect(typeof saveMortgageRatePresets).toBe('function');
  });

  it('denies when the staff role lacks calculator_config.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await saveMortgageRatePresets({ ok: false }, form(GOOD_PRESETS));
    expect(res.ok).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid preset without writing', async () => {
    const res = await saveMortgageRatePresets(
      { ok: false },
      form([{ label: '2-year fixed', annualRatePercent: -1, termYears: 25 }]),
    );
    expect(res.ok).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON payload without writing', async () => {
    const fd = new FormData();
    fd.set('presets', 'not json');
    const res = await saveMortgageRatePresets({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });

  it('replaces the preset list and audits it in the same transaction', async () => {
    const res = await saveMortgageRatePresets({ ok: false }, form(GOOD_PRESETS));
    expect(res.ok).toBe(true);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledTimes(1);

    const createArg = createMany.mock.calls[0]![0] as {
      data: Array<{ tenantId: string; label: string; sortOrder: number }>;
    };
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data[0]!.tenantId).toBe(TENANT);
    expect(createArg.data[0]!.label).toBe('2-year fixed');
    expect(createArg.data[0]!.sortOrder).toBe(0);
    expect(createArg.data[1]!.sortOrder).toBe(1);

    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'calculator_config.updated',
      entity: 'mortgage_rate_presets',
      entityId: TENANT,
    });
  });

  it('accepts an empty list (clears all presets) and audits the change', async () => {
    findMany.mockResolvedValue([{ label: '2-year fixed', annualRatePercent: 4.79, termYears: 25 }]);
    const res = await saveMortgageRatePresets({ ok: false }, form([]));
    expect(res.ok).toBe(true);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(createMany).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(1);
  });
});
