import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-G FR-G-5 / FR-G-9 (audit finding repair-urgency-sla-not-configurable) — the
// audited, RBAC-gated save of a tenant's repair SLA configuration: the per-urgency
// §G.4 targets and the two FR-G-9 badge thresholds. Mirrors the sibling settings
// action tests: mock the staff-session, tenant and db seams; assert fail-closed
// RBAC (`setting.manage`) BEFORE any read/write, Zod validation, the tenant-scoped
// upsert and the audit row written in the same transaction (G4).

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
const findFirst = vi.fn();
const upsert = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ repairSlaConfig: { findFirst, upsert } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { saveRepairSlaConfig } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

const VALID = {
  emergencyTargetHours: '2',
  urgentTargetHours: '12',
  standardTargetHours: '72',
  lowTargetWorkingDays: '10',
  dueSoonThresholdPercent: '40',
  atRiskThresholdPercent: '80',
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:settings');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestUserAgent.mockResolvedValue('Mozilla/5.0 (Test)');
  findFirst.mockResolvedValue(null);
  upsert.mockResolvedValue({});
});

describe('saveRepairSlaConfig', () => {
  it('denies when the staff role lacks setting.manage (fail-closed, before any read/write)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));

    const res = await saveRepairSlaConfig({ ok: false }, form(VALID));

    expect(res.ok).toBe(false);
    expect(requireStaffPermission).toHaveBeenCalledWith('setting.manage');
    expect(withTenant).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a non-positive target without writing', async () => {
    const res = await saveRepairSlaConfig(
      { ok: false },
      form({ ...VALID, emergencyTargetHours: '0' }),
    );

    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'emergencyTargetHours' })]),
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric target without writing', async () => {
    const res = await saveRepairSlaConfig(
      { ok: false },
      form({ ...VALID, urgentTargetHours: 'soon' }),
    );

    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects an at-risk threshold at or below the due-soon threshold', async () => {
    const res = await saveRepairSlaConfig(
      { ok: false },
      form({ ...VALID, dueSoonThresholdPercent: '80', atRiskThresholdPercent: '60' }),
    );

    expect(res.ok).toBe(false);
    expect(res.errors?.length ?? 0).toBeGreaterThan(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts the tenant SLA config and audits in the same transaction (G4)', async () => {
    const res = await saveRepairSlaConfig({ ok: false }, form(VALID));

    expect(res.ok).toBe(true);
    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      create: expect.objectContaining({
        tenantId: TENANT,
        emergencyTargetHours: 2,
        urgentTargetHours: 12,
        standardTargetHours: 72,
        lowTargetWorkingDays: 10,
        dueSoonThresholdPercent: 40,
        atRiskThresholdPercent: 80,
      }),
      update: expect.objectContaining({
        emergencyTargetHours: 2,
        atRiskThresholdPercent: 80,
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        actor: 'agent:settings',
        action: 'repair_sla_config.updated',
        entity: 'repair_sla_config',
        entityId: TENANT,
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (Test)',
      }),
    );
  });

  it('audits the before/after diff, with the §G.4 defaults as the "from" when unconfigured', async () => {
    const res = await saveRepairSlaConfig({ ok: false }, form(VALID));

    expect(res.ok).toBe(true);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        diff: {
          config: {
            from: expect.objectContaining({
              emergencyTargetHours: 4,
              urgentTargetHours: 24,
              standardTargetHours: 48,
              lowTargetWorkingDays: 5,
              dueSoonThresholdPercent: 50,
              atRiskThresholdPercent: 75,
            }),
            to: expect.objectContaining({ emergencyTargetHours: 2 }),
          },
        },
      }),
    );
  });
});
