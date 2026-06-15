import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signContractorLink } from '../../../../lib/contractor-access.js';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const repairFindFirst = vi.fn();
const repairUpdate = vi.fn();
const eventCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    repairRequest: { findFirst: repairFindFirst, update: repairUpdate },
    repairStatusEvent: { create: eventCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { advanceRepairAsContractor } = await import('./actions.js');

const SECRET = 'test-secret';
const TENANT = '00000000-0000-0000-0000-000000000001';
const REPAIR = '11111111-1111-1111-1111-111111111111';
const CONTRACTOR = '22222222-2222-2222-2222-222222222222';

const savedSecret = process.env['CONTRACTOR_LINK_SECRET'];

function token(over: { repair?: string; contractor?: string; expiresInMs?: number } = {}): string {
  return signContractorLink(
    over.repair ?? REPAIR,
    over.contractor ?? CONTRACTOR,
    Date.now() + (over.expiresInMs ?? 60_000),
    SECRET,
  );
}

function form(tok: string): FormData {
  const fd = new FormData();
  fd.set('token', tok);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env['CONTRACTOR_LINK_SECRET'] = SECRET;
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  repairFindFirst.mockResolvedValue({
    id: REPAIR,
    status: 'contractor_assigned',
    assignedContractorId: CONTRACTOR,
  });
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env['CONTRACTOR_LINK_SECRET'];
  else process.env['CONTRACTOR_LINK_SECRET'] = savedSecret;
});

describe('advanceRepairAsContractor', () => {
  it('advances contractor_assigned → work_in_progress, records the event + audit', async () => {
    const result = await advanceRepairAsContractor({ ok: false }, form(token()));

    expect(result.ok).toBe(true);
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { status: 'work_in_progress' },
    });
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        repairRequestId: REPAIR,
        fromStatus: 'contractor_assigned',
        toStatus: 'work_in_progress',
        actorUserId: null,
      }),
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor: `contractor:${CONTRACTOR}`,
        action: 'repair_request.status_changed',
        entityId: REPAIR,
        diff: { status: { from: 'contractor_assigned', to: 'work_in_progress' } },
      }),
    );
  });

  it('advances work_in_progress → awaiting_review (mark complete)', async () => {
    repairFindFirst.mockResolvedValue({
      id: REPAIR,
      status: 'work_in_progress',
      assignedContractorId: CONTRACTOR,
    });
    const result = await advanceRepairAsContractor({ ok: false }, form(token()));
    expect(result.ok).toBe(true);
    expect(repairUpdate).toHaveBeenCalledWith({
      where: { id: REPAIR },
      data: { status: 'awaiting_review' },
    });
  });

  it('rejects an invalid / expired / tampered token before any read or write', async () => {
    expect((await advanceRepairAsContractor({ ok: false }, form('garbage'))).ok).toBe(false);
    expect((await advanceRepairAsContractor({ ok: false }, form(token({ expiresInMs: -1 })))).ok).toBe(
      false,
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses when the token contractor is not the ticket’s current assignee', async () => {
    repairFindFirst.mockResolvedValue({
      id: REPAIR,
      status: 'contractor_assigned',
      assignedContractorId: '99999999-9999-9999-9999-999999999999',
    });
    const result = await advanceRepairAsContractor({ ok: false }, form(token()));
    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });

  it('refuses an unknown ticket', async () => {
    repairFindFirst.mockResolvedValue(null);
    const result = await advanceRepairAsContractor({ ok: false }, form(token()));
    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });

  it('offers no advance once the ticket is awaiting_review (nothing to do)', async () => {
    repairFindFirst.mockResolvedValue({
      id: REPAIR,
      status: 'awaiting_review',
      assignedContractorId: CONTRACTOR,
    });
    const result = await advanceRepairAsContractor({ ok: false }, form(token()));
    expect(result.ok).toBe(false);
    expect(repairUpdate).not.toHaveBeenCalled();
  });
});
