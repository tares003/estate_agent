import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-O FR-O-11 — the audited, RBAC-gated redirect-rule CRUD. Mirrors the SDLT config
// action test: mock the staff-session, tenant and db seams; assert fail-closed RBAC,
// Zod validation, the tenant-scoped mutation + the audit row written in the same
// transaction (G4), and the duplicate-from-path guard.

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
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ redirect: { findFirst, create, update, delete: remove } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createRedirect, updateRedirect, deleteRedirect } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const REDIRECT_ID = '11111111-1111-1111-1111-111111111111';

function createForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('sourcePath', over['sourcePath'] ?? '/old-path');
  fd.set('destinationPath', over['destinationPath'] ?? '/new-path');
  fd.set('type', over['type'] ?? 'r301');
  return fd;
}

function updateForm(over: Record<string, string> = {}): FormData {
  const fd = createForm(over);
  fd.set('id', over['id'] ?? REDIRECT_ID);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:settings');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({ id: REDIRECT_ID });
  update.mockResolvedValue({});
  remove.mockResolvedValue({});
});

describe('createRedirect', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await createRedirect({ ok: false }, createForm());
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a from-path that does not start with / (no write)', async () => {
    const res = await createRedirect({ ok: false }, createForm({ sourcePath: 'old-path' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate from-path without writing', async () => {
    findFirst.mockResolvedValue({ id: 'other', sourcePath: '/old-path' });
    const res = await createRedirect({ ok: false }, createForm());
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('creates the redirect and audits it in the same transaction', async () => {
    const res = await createRedirect({ ok: false }, createForm());
    expect(res.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      tenantId: TENANT,
      sourcePath: '/old-path',
      destinationPath: '/new-path',
      type: 'r301',
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'redirect.created',
      entity: 'redirect',
      entityId: REDIRECT_ID,
    });
  });
});

describe('updateRedirect', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await updateRedirect({ ok: false }, updateForm());
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns not-found when the rule does not exist', async () => {
    findFirst.mockResolvedValue(null);
    const res = await updateRedirect({ ok: false }, updateForm());
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a from-path change that collides with another rule', async () => {
    findFirst
      .mockResolvedValueOnce({
        id: REDIRECT_ID,
        sourcePath: '/old-path',
        destinationPath: '/new-path',
        type: 'r301',
      })
      .mockResolvedValueOnce({ id: 'other', sourcePath: '/taken' });
    const res = await updateRedirect({ ok: false }, updateForm({ sourcePath: '/taken' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the redirect and audits the before/after diff', async () => {
    findFirst.mockResolvedValue({
      id: REDIRECT_ID,
      sourcePath: '/old-path',
      destinationPath: '/new-path',
      type: 'r301',
    });
    const res = await updateRedirect(
      { ok: false },
      updateForm({ destinationPath: '/newer-path', type: 'r302' }),
    );
    expect(res.ok).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].where).toEqual({ id: REDIRECT_ID });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'redirect.updated',
      entity: 'redirect',
      entityId: REDIRECT_ID,
    });
  });
});

describe('deleteRedirect', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const fd = new FormData();
    fd.set('id', REDIRECT_ID);
    const res = await deleteRedirect({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns not-found when the rule does not exist', async () => {
    findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set('id', REDIRECT_ID);
    const res = await deleteRedirect({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('deletes the redirect and audits it in the same transaction', async () => {
    findFirst.mockResolvedValue({
      id: REDIRECT_ID,
      sourcePath: '/old-path',
      destinationPath: '/new-path',
      type: 'r301',
    });
    const fd = new FormData();
    fd.set('id', REDIRECT_ID);
    const res = await deleteRedirect({ ok: false }, fd);
    expect(res.ok).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]![0].where).toEqual({ id: REDIRECT_ID });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'redirect.deleted',
      entity: 'redirect',
      entityId: REDIRECT_ID,
    });
  });
});
