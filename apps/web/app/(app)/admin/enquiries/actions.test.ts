import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (enquiryStatusUpdateSchema + canTransition) drives the
// transition rules; the data layer, request context, and staff-session seam are
// doubled so the EPIC-I status action is exercised in isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { updateEnquiryStatus } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const ENQ = '11111111-1111-1111-1111-111111111111';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue({ id: ENQ, status: 'new' });
  update.mockResolvedValue({});
});

describe('updateEnquiryStatus', () => {
  it('applies a legal transition and audits the status change (G4)', async () => {
    const result = await updateEnquiryStatus(
      { ok: false },
      form({ enquiryId: ENQ, to: 'contacted' }),
    );

    expect(result).toEqual({ ok: true, status: 'contacted' });
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.write');
    expect(withTenant).toHaveBeenCalledWith({}, TENANT, expect.any(Function));
    expect(update).toHaveBeenCalledWith({ where: { id: ENQ }, data: { status: 'contacted' } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      actor: 'agent:dev-staff',
      action: 'enquiry.status_changed',
      entity: 'enquiry',
      entityId: ENQ,
      diff: { status: { from: 'new', to: 'contacted' } },
      ip: '203.0.113.7',
    });
  });

  it('rejects an illegal transition and writes nothing', async () => {
    const result = await updateEnquiryStatus(
      { ok: false },
      form({ enquiryId: ENQ, to: 'converted' }),
    );

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('records the reason in the audit diff when marking lost', async () => {
    findFirst.mockResolvedValue({ id: ENQ, status: 'contacted' });
    const result = await updateEnquiryStatus(
      { ok: false },
      form({ enquiryId: ENQ, to: 'lost', reason: 'price' }),
    );

    expect(result).toEqual({ ok: true, status: 'lost' });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        diff: { status: { from: 'contacted', to: 'lost' }, reason: 'price' },
      }),
    );
  });

  it('rejects marking lost with no reason, before any write', async () => {
    const result = await updateEnquiryStatus({ ok: false }, form({ enquiryId: ENQ, to: 'lost' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'reason' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the enquiry does not exist', async () => {
    findFirst.mockResolvedValue(null);
    const result = await updateEnquiryStatus(
      { ok: false },
      form({ enquiryId: ENQ, to: 'contacted' }),
    );

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('is RBAC-gated — denies without enquiry.write, before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await updateEnquiryStatus(
      { ok: false },
      form({ enquiryId: ENQ, to: 'contacted' }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
