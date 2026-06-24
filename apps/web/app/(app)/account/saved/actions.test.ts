import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-T FR-T-5 — the audited save/unsave toggle. Fail-closed on a signed-in,
// EMAIL-VERIFIED customer (FR-T-2); Zod-validate the propertyId; the upsert/delete
// + the audit row run in ONE tenant transaction (G4). Mirrors the feedback action
// test's injectable-seam pattern.

const getCustomerSession = vi.fn();
vi.mock('../../lib/customer-session.js', () => ({
  getCustomerSession: () => getCustomerSession(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const savedFindFirst = vi.fn();
const savedCreate = vi.fn();
const savedDelete = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    savedProperty: { findFirst: savedFindFirst, create: savedCreate, delete: savedDelete },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { toggleSavedProperty } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const PROPERTY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

function form(propertyId: string = PROPERTY): FormData {
  const fd = new FormData();
  fd.set('propertyId', propertyId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue({
    userId: USER,
    emailVerified: true,
    actor: `customer:${USER}`,
  });
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  savedFindFirst.mockResolvedValue(null);
  savedCreate.mockResolvedValue({ id: 's1' });
  savedDelete.mockResolvedValue({});
});

describe('toggleSavedProperty', () => {
  it('denies a signed-out visitor (fail-closed) — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await toggleSavedProperty({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(savedCreate).not.toHaveBeenCalled();
    expect(savedDelete).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('denies a signed-in but EMAIL-UNVERIFIED customer (FR-T-2) — no write', async () => {
    getCustomerSession.mockResolvedValue({
      userId: USER,
      emailVerified: false,
      actor: `customer:${USER}`,
    });
    const res = await toggleSavedProperty({ ok: false }, form());
    expect(res.ok).toBe(false);
    expect(savedCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a missing / malformed propertyId (Zod) — no write', async () => {
    const res = await toggleSavedProperty({ ok: false }, form('not-a-uuid'));
    expect(res.ok).toBe(false);
    expect(savedCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('saves an un-saved property: creates the row + audits it in one transaction', async () => {
    const res = await toggleSavedProperty({ ok: false }, form());
    expect(res).toEqual({ ok: true, saved: true });
    expect(savedCreate).toHaveBeenCalledTimes(1);
    expect(savedCreate.mock.calls[0]![0]).toMatchObject({
      data: { tenantId: TENANT, userId: USER, propertyId: PROPERTY },
    });
    expect(savedDelete).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      actor: `customer:${USER}`,
      action: 'saved_property.saved',
      entity: 'saved_property',
      entityId: PROPERTY,
    });
  });

  it('is idempotent on a second save → unsaves: deletes the row + audits the removal', async () => {
    savedFindFirst.mockResolvedValue({ id: 's1' });
    const res = await toggleSavedProperty({ ok: false }, form());
    expect(res).toEqual({ ok: true, saved: false });
    expect(savedDelete).toHaveBeenCalledTimes(1);
    expect(savedDelete.mock.calls[0]![0]).toMatchObject({ where: { id: 's1' } });
    expect(savedCreate).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'saved_property.unsaved' });
  });
});
