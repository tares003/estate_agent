import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (enquiryNoteCreateSchema) drives the rules; the data
// layer, request context, and staff-session seam are doubled so the FR-I-5 note
// action is exercised in isolation.
const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { findFirst }, note: { create } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { addEnquiryNote } = await import('./note-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const ENQ = '11111111-1111-1111-1111-111111111111';
const NOTE = '22222222-2222-2222-2222-222222222222';

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
  getStaffUserId.mockResolvedValue(null);
  requireStaffPermission.mockResolvedValue(undefined);
  findFirst.mockResolvedValue({ id: ENQ });
  create.mockResolvedValue({ id: NOTE });
});

describe('addEnquiryNote', () => {
  it('creates an internal note by default and audits it (G4)', async () => {
    const result = await addEnquiryNote(
      { ok: false },
      form({ enquiryId: ENQ, body: 'Called the buyer.' }),
    );

    expect(result).toEqual({ ok: true, noteId: NOTE });
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.write');
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        entityType: 'enquiry',
        entityId: ENQ,
        body: 'Called the buyer.',
        isInternal: true,
        authorAgentId: null,
      },
    });
    expect(audit).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      actor: 'agent:dev-staff',
      action: 'enquiry.note_added',
      entity: 'enquiry',
      entityId: ENQ,
      diff: { note: { id: NOTE, isInternal: true } },
      ip: '203.0.113.7',
    });
  });

  it('records a client-visible note when isInternal=false', async () => {
    await addEnquiryNote(
      { ok: false },
      form({ enquiryId: ENQ, body: 'Viewing confirmed.', isInternal: 'false' }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isInternal: false }) }),
    );
  });

  it('rejects an empty note before any write', async () => {
    const result = await addEnquiryNote({ ok: false }, form({ enquiryId: ENQ, body: '   ' }));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'body' })]),
    );
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the enquiry is absent', async () => {
    findFirst.mockResolvedValue(null);
    const result = await addEnquiryNote({ ok: false }, form({ enquiryId: ENQ, body: 'x' }));

    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('is RBAC-gated — denies without enquiry.write, before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await addEnquiryNote({ ok: false }, form({ enquiryId: ENQ, body: 'x' }));

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
