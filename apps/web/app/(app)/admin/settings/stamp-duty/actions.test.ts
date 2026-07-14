import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-W FR-W-3 — the audited, RBAC-gated save of a tenant's SDLT band config.
// Mirrors the feedback moderation action test: mock the staff-session, tenant and
// db seams; assert fail-closed RBAC, Zod validation, the tenant-scoped upsert and
// the audit row written in the same transaction (G4).

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const sdltFindFirst = vi.fn();
const sdltUpsert = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ sdltConfig: { findFirst: sdltFindFirst, upsert: sdltUpsert } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { saveSdltConfig } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const GOOD_CONFIG = {
  standardBands: [
    { upTo: 250_000, ratePercent: 0 },
    { upTo: null, ratePercent: 12 },
  ],
  firstTimeBuyer: {
    maxPrice: 625_000,
    bands: [
      { upTo: 425_000, ratePercent: 0 },
      { upTo: null, ratePercent: 5 },
    ],
  },
  additionalPropertySurchargePercent: 3,
  lastUpdated: '2025-04-01',
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
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  sdltFindFirst.mockResolvedValue(null);
  sdltUpsert.mockResolvedValue({});
});

describe('saveSdltConfig', () => {
  it('is exported as a function', () => {
    expect(typeof saveSdltConfig).toBe('function');
  });

  it('denies when the staff role lacks calculator_config.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await saveSdltConfig({ ok: false }, form(GOOD_CONFIG));
    expect(res.ok).toBe(false);
    expect(sdltUpsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid config without writing', async () => {
    const res = await saveSdltConfig(
      { ok: false },
      form({ ...GOOD_CONFIG, additionalPropertySurchargePercent: -1 }),
    );
    expect(res.ok).toBe(false);
    expect(sdltUpsert).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON config payload without writing', async () => {
    const fd = new FormData();
    fd.set('config', 'not json');
    const res = await saveSdltConfig({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(sdltUpsert).not.toHaveBeenCalled();
  });

  it('upserts the validated config and audits it in the same transaction', async () => {
    const res = await saveSdltConfig({ ok: false }, form(GOOD_CONFIG));
    expect(res.ok).toBe(true);
    expect(sdltUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = sdltUpsert.mock.calls[0]![0] as {
      where: { tenantId: string };
      create: { tenantId: string; config: unknown };
      update: { config: unknown };
    };
    expect(upsertArg.where).toEqual({ tenantId: TENANT });
    expect(upsertArg.create.tenantId).toBe(TENANT);
    expect(upsertArg.create.config).toMatchObject({ additionalPropertySurchargePercent: 3 });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'calculator_config.updated',
      entity: 'sdlt_config',
    });
  });
});

// FR-H-17 — the audit trail records actor, diff, IP AND user-agent; every admin
// state-change audit row must carry the request user-agent (audit finding
// audit-log-user-agent-never-captured).
describe('FR-H-17 audit user-agent', () => {
  it('captures the request user-agent in every audit row', async () => {
    await saveSdltConfig({ ok: false }, form(GOOD_CONFIG));

    expect(audit.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of audit.mock.calls) {
      expect(call[1]).toMatchObject({ userAgent: 'Mozilla/5.0 (Test)' });
    }
  });
});
