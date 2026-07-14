import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-G FR-G-3 (audit finding repair-emergency-internal-notifications-missing) —
// the audited, RBAC-gated save of a tenant's repair notification routing: the
// internal recipients §G.7 routes new-ticket notifications to (the
// property-manager / branch-repairs-queue email + the on-call manager's phone).
// Mirrors the SDLT/mortgage config action tests: mock the staff-session, tenant
// and db seams; assert fail-closed RBAC (`setting.manage`), Zod validation, the
// tenant-scoped upsert and the audit row written in the same transaction (G4).

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
  fn({ repairNotificationConfig: { findFirst, upsert } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { saveRepairNotificationConfig } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

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

describe('saveRepairNotificationConfig', () => {
  it('denies when the staff role lacks setting.manage (fail-closed, before any read/write)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await saveRepairNotificationConfig(
      { ok: false },
      form({ repairsEmail: 'repairs@agency.example', onCallPhone: '07700900555' }),
    );
    expect(res.ok).toBe(false);
    expect(requireStaffPermission).toHaveBeenCalledWith('setting.manage');
    expect(withTenant).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a malformed email without writing', async () => {
    const res = await saveRepairNotificationConfig(
      { ok: false },
      form({ repairsEmail: 'not-an-email', onCallPhone: '' }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'repairsEmail' })]),
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed on-call phone without writing', async () => {
    const res = await saveRepairNotificationConfig(
      { ok: false },
      form({ repairsEmail: '', onCallPhone: '12' }),
    );
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'onCallPhone' })]),
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts the tenant config and audits in the same transaction (G4)', async () => {
    findFirst.mockResolvedValue({ repairsEmail: null, onCallPhone: null });

    const res = await saveRepairNotificationConfig(
      { ok: false },
      form({ repairsEmail: 'Repairs@Agency.Example', onCallPhone: '07700 900555' }),
    );

    expect(res.ok).toBe(true);
    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      create: expect.objectContaining({
        tenantId: TENANT,
        repairsEmail: 'repairs@agency.example',
        onCallPhone: '07700 900555',
      }),
      update: expect.objectContaining({
        repairsEmail: 'repairs@agency.example',
        onCallPhone: '07700 900555',
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        actor: 'agent:settings',
        action: 'repair_notification_config.updated',
        entity: 'repair_notification_config',
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (Test)',
      }),
    );
  });

  it('treats an empty field as clearing that channel (stored as null)', async () => {
    const res = await saveRepairNotificationConfig(
      { ok: false },
      form({ repairsEmail: '', onCallPhone: '' }),
    );

    expect(res.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ repairsEmail: null, onCallPhone: null }),
      }),
    );
  });
});
