import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
}));

const audit = vi.fn();
const create = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ contractor: { create, findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createContractor, setContractorActive } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  create.mockResolvedValue({ id: 'k1' });
  findFirst.mockResolvedValue({ id: 'k1', name: 'Ace Plumbing', active: true });
  update.mockResolvedValue({});
});

describe('createContractor', () => {
  it('creates a contractor and audits it (G4)', async () => {
    const result = await createContractor(
      { ok: false },
      form({ name: 'Ace Plumbing', email: 'ace@example.com', phone: '07700900000', trade: 'Plumbing' }),
    );

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.manage');
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        name: 'Ace Plumbing',
        email: 'ace@example.com',
        phone: '07700900000',
        trade: 'Plumbing',
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'contractor.created', entity: 'contractor', entityId: 'k1' }),
    );
  });

  it('rejects a missing name or an invalid email before any write', async () => {
    expect((await createContractor({ ok: false }, form({ email: 'ace@example.com' }))).ok).toBe(false);
    expect(
      (await createContractor({ ok: false }, form({ name: 'Ace', email: 'not-an-email' }))).ok,
    ).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await createContractor(
      { ok: false },
      form({ name: 'Ace', email: 'ace@example.com' }),
    );
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});

describe('setContractorActive', () => {
  it('toggles active and audits the change (G4)', async () => {
    const result = await setContractorActive(
      { ok: false },
      form({ id: 'k1', active: 'false' }),
    );

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.manage');
    expect(update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { active: false } });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'contractor.active_changed',
        entityId: 'k1',
        diff: { active: { from: true, to: false } },
      }),
    );
  });

  it('refuses an unknown contractor without writing', async () => {
    findFirst.mockResolvedValue(null);
    const result = await setContractorActive({ ok: false }, form({ id: 'k1', active: 'true' }));
    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await setContractorActive({ ok: false }, form({ id: 'k1', active: 'false' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
