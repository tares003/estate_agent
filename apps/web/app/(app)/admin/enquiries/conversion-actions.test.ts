import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real @estate/validators (enquiryConversionSchema + canTransition) drives the
// rules; the data layer, request context, and staff-session seam are doubled so
// the FR-I-6 conversion action is exercised in isolation.
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
const create = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ enquiry: { findFirst, update }, contact: { create } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { convertEnquiry } = await import('./conversion-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const ENQ = '11111111-1111-1111-1111-111111111111';
const CONTACT = '33333333-3333-3333-3333-333333333333';

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
  findFirst.mockResolvedValue({
    id: ENQ,
    status: 'contacted',
    name: 'Sam Buyer',
    email: 'sam@example.com',
    phone: '07700900000',
  });
  create.mockResolvedValue({ id: CONTACT });
  update.mockResolvedValue({});
});

describe('convertEnquiry', () => {
  it('creates a linked contact, marks the enquiry converted, and audits it (G4)', async () => {
    const result = await convertEnquiry(
      { ok: false },
      form({ enquiryId: ENQ, contactType: 'buyer' }),
    );

    expect(result).toEqual({ ok: true, contactId: CONTACT });
    expect(requireStaffPermission).toHaveBeenCalledWith('enquiry.write');
    expect(create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        name: 'Sam Buyer',
        email: 'sam@example.com',
        phone: '07700900000',
        type: 'buyer',
        sourceEnquiryId: ENQ,
      },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: ENQ }, data: { status: 'converted' } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), {
      tenantId: TENANT,
      actor: 'agent:dev-staff',
      action: 'enquiry.converted',
      entity: 'enquiry',
      entityId: ENQ,
      diff: {
        status: { from: 'contacted', to: 'converted' },
        contact: { id: CONTACT, type: 'buyer' },
      },
      ip: '203.0.113.7',
    });
  });

  it('refuses to convert from a state that cannot reach converted, writing nothing', async () => {
    findFirst.mockResolvedValue({ id: ENQ, status: 'new', name: 'Sam', email: null, phone: null });
    const result = await convertEnquiry(
      { ok: false },
      form({ enquiryId: ENQ, contactType: 'buyer' }),
    );

    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the enquiry is absent', async () => {
    findFirst.mockResolvedValue(null);
    const result = await convertEnquiry(
      { ok: false },
      form({ enquiryId: ENQ, contactType: 'buyer' }),
    );

    expect(result.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid contact type before any write', async () => {
    const result = await convertEnquiry(
      { ok: false },
      form({ enquiryId: ENQ, contactType: 'nope' }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated — denies without enquiry.write, before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await convertEnquiry(
      { ok: false },
      form({ enquiryId: ENQ, contactType: 'buyer' }),
    );

    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
