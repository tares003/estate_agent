import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyContractorLink } from '../../../lib/contractor-access.js';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
const getRequestOrigin = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
  getRequestOrigin: () => getRequestOrigin(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
}));

const audit = vi.fn();
const notify = vi.fn();
const repairFindFirst = vi.fn();
const repairUpdate = vi.fn();
const contractorFindFirst = vi.fn();
const eventCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { findFirst: repairFindFirst, update: repairUpdate },
    contractor: { findFirst: contractorFindFirst },
    repairStatusEvent: { create: eventCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit, notify }));

const { assignContractor } = await import('./assign-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const CONTRACTOR = '22222222-2222-2222-2222-222222222222';

const savedSecret = process.env['CONTRACTOR_LINK_SECRET'];

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('repairId', REPAIR);
  fd.set('contractorId', CONTRACTOR);
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['CONTRACTOR_LINK_SECRET'] = 'test-secret';
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getRequestOrigin.mockResolvedValue('https://acme.test');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  getStaffUserId.mockResolvedValue('staff-1');
  repairFindFirst.mockResolvedValue({ id: REPAIR, status: 'triaged', reference: 'RPR-2026-00042' });
  contractorFindFirst.mockResolvedValue({
    id: CONTRACTOR,
    name: 'Ace Plumbing',
    email: 'ace@example.com',
    active: true,
  });
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env['CONTRACTOR_LINK_SECRET'];
  else process.env['CONTRACTOR_LINK_SECRET'] = savedSecret;
});

describe('assignContractor', () => {
  it('assigns the contractor, moves to contractor_assigned, records the event + audit, and queues the magic-link email', async () => {
    const result = await assignContractor({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('repair_request.write');
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { assignedContractorId: CONTRACTOR, status: 'contractor_assigned' },
    });
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        repairRequestId: REPAIR,
        fromStatus: 'triaged',
        toStatus: 'contractor_assigned',
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'repair_request.contractor_assigned',
        entity: 'repair_request',
        entityId: REPAIR,
        diff: { assignedContractorId: { from: null, to: CONTRACTOR } },
      }),
    );
    // the magic-link is queued to the contractor's email with a verifiable token
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT,
        event: 'repair.contractor_assigned',
        channel: 'email',
        recipient: 'ace@example.com',
        payload: expect.objectContaining({ reference: 'RPR-2026-00042' }),
      }),
    );
    const link = String((notify.mock.calls[0]?.[1] as { payload: { link: string } }).payload.link);
    expect(link.startsWith('https://acme.test/repairs/contractor/')).toBe(true);
    const token = link.split('/repairs/contractor/')[1]!;
    expect(verifyContractorLink(token, 'test-secret', Date.now())).toEqual({
      repairRequestId: REPAIR,
      contractorId: CONTRACTOR,
    });
  });

  it('refuses to assign when the current status cannot move to contractor_assigned', async () => {
    repairFindFirst.mockResolvedValue({ id: REPAIR, status: 'new', reference: 'RPR-1' });
    const result = await assignContractor({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('refuses an unknown ticket without writing', async () => {
    repairFindFirst.mockResolvedValue(null);
    const result = await assignContractor({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });

  it('refuses an unknown or inactive contractor without writing', async () => {
    contractorFindFirst.mockResolvedValue(null);
    expect((await assignContractor({ ok: false }, form())).ok).toBe(false);
    contractorFindFirst.mockResolvedValue({
      id: CONTRACTOR,
      name: 'Ace',
      email: 'ace@example.com',
      active: false,
    });
    expect((await assignContractor({ ok: false }, form())).ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid input before any write', async () => {
    const result = await assignContractor({ ok: false }, form({ contractorId: 'nope' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await assignContractor({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
