import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-W FR-W-7 — the audited, RBAC-gated save of a tenant's mortgage-default config.
// Mirrors the SDLT config action test: mock the staff-session, tenant and db seams;
// assert fail-closed RBAC, Zod validation, the tenant-scoped upsert and the audit
// row written in the same transaction (G4). Reuses the existing
// `calculator_config.manage` permission (shared with the SDLT band editor).

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
const findFirst = vi.fn();
const upsert = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ mortgageRateConfig: { findFirst, upsert } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { saveMortgageRateConfig } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const GOOD_CONFIG = {
  defaultAnnualRatePercent: 4.5,
  defaultTermYears: 25,
  defaultDepositPercent: 20,
  lastReviewed: '2026-04-01',
};

function form(config: unknown): FormData {
  const fd = new FormData();
  fd.set('config', JSON.stringify(config));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:settings');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  findFirst.mockResolvedValue(null);
  upsert.mockResolvedValue({});
});

describe('saveMortgageRateConfig', () => {
  it('is exported as a function', () => {
    expect(typeof saveMortgageRateConfig).toBe('function');
  });

  it('denies when the staff role lacks calculator_config.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await saveMortgageRateConfig({ ok: false }, form(GOOD_CONFIG));
    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid config without writing', async () => {
    const res = await saveMortgageRateConfig(
      { ok: false },
      form({ ...GOOD_CONFIG, defaultAnnualRatePercent: -1 }),
    );
    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON config payload without writing', async () => {
    const fd = new FormData();
    fd.set('config', 'not json');
    const res = await saveMortgageRateConfig({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts the validated config and audits it in the same transaction', async () => {
    const res = await saveMortgageRateConfig({ ok: false }, form(GOOD_CONFIG));
    expect(res.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertArg = upsert.mock.calls[0]![0] as {
      where: { tenantId: string };
      create: { tenantId: string; config: unknown };
      update: { config: unknown };
    };
    expect(upsertArg.where).toEqual({ tenantId: TENANT });
    expect(upsertArg.create.tenantId).toBe(TENANT);
    expect(upsertArg.create.config).toMatchObject({ defaultAnnualRatePercent: 4.5 });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'calculator_config.updated',
      entity: 'mortgage_rate_config',
    });
  });
});
