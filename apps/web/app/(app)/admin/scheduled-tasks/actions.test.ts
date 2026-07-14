import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-U FR-U-8 + master spec §H.23 — the scheduled-tasks console controls. Mirrors the
// sibling settings action tests: mock the staff-session, tenant and db seams; assert
// fail-closed RBAC (`setting.manage`) BEFORE any read/write, catalogue validation of the
// worker id, the tenant-scoped upsert, and the audit row written in the same transaction
// (G4). "Run now" is a REQUEST — it stamps run_requested_at for the worker tick to pick
// up — so these also pin that it is refused for a paused worker (which would never run
// it, stranding the request).

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestUserAgent = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestUserAgent: () => getRequestUserAgent(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const findUnique = vi.fn();
const upsert = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ workerSchedule: { findUnique, upsert } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { requestWorkerRun, setWorkerPaused } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const WORKER = 'saved_search_daily';

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
  findUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({});
});

describe('setWorkerPaused (FR-U-8)', () => {
  it('denies when the staff role lacks setting.manage (fail-closed, before any read/write)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));

    const res = await setWorkerPaused({ ok: false }, form({ workerId: WORKER, paused: 'true' }));

    expect(res.ok).toBe(false);
    expect(requireStaffPermission).toHaveBeenCalledWith('setting.manage');
    expect(withTenant).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a worker id that is not in the catalogue (no phantom schedule rows)', async () => {
    const res = await setWorkerPaused(
      { ok: false },
      form({ workerId: 'no_such_worker', paused: 'true' }),
    );

    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('pauses the worker for THIS tenant and audits it in the same transaction', async () => {
    const res = await setWorkerPaused({ ok: false }, form({ workerId: WORKER, paused: 'true' }));

    expect(res.ok).toBe(true);
    expect(withTenant).toHaveBeenCalledWith({}, TENANT, expect.any(Function));
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_workerId: { tenantId: TENANT, workerId: WORKER } },
        create: { tenantId: TENANT, workerId: WORKER, paused: true },
        update: { paused: true },
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        actor: 'agent:settings',
        action: 'worker_schedule.paused',
        entity: 'worker_schedule',
        entityId: WORKER,
        diff: { paused: { from: false, to: true } },
        ip: '203.0.113.7',
        userAgent: 'Mozilla/5.0 (Test)',
      }),
    );
  });

  it('resumes a paused worker, and audits the before-image it actually had', async () => {
    findUnique.mockResolvedValue({ paused: true });

    const res = await setWorkerPaused({ ok: false }, form({ workerId: WORKER, paused: 'false' }));

    expect(res.ok).toBe(true);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'worker_schedule.resumed',
        diff: { paused: { from: true, to: false } },
      }),
    );
  });
});

describe('requestWorkerRun (§H.23 "Run now")', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));

    const res = await requestWorkerRun({ ok: false }, form({ workerId: WORKER }));

    expect(res.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an unknown worker id', async () => {
    const res = await requestWorkerRun({ ok: false }, form({ workerId: 'no_such_worker' }));

    expect(res.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('stamps the run request for the worker tick to pick up, and audits it', async () => {
    const res = await requestWorkerRun({ ok: false }, form({ workerId: WORKER }));

    expect(res.ok).toBe(true);
    const call = upsert.mock.calls[0]![0] as { update: { runRequestedAt: Date } };
    expect(call.update.runRequestedAt).toBeInstanceOf(Date);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'worker_schedule.run_requested',
        entity: 'worker_schedule',
        entityId: WORKER,
      }),
    );
  });

  it('REFUSES to queue a run for a paused worker (it would never run — resume first)', async () => {
    findUnique.mockResolvedValue({ paused: true });

    const res = await requestWorkerRun({ ok: false }, form({ workerId: WORKER }));

    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.message).toContain('paused');
    expect(upsert).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
