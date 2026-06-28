import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-T FR-T-11 — the audited customer profile-update action. Fail-closed on a
// signed-in customer (a signed-out visitor is rejected with no write); the input
// is Zod-validated; the update + its audit row run in ONE tenant transaction (G4),
// scoped to the customer's OWN user row. Mirrors the saved-search action test's
// injectable-seam pattern.

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
const findFirst = vi.fn();
const update = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ user: { findFirst, update } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { updateProfile } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '22222222-2222-2222-2222-222222222222';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const EXISTING = {
  name: 'Old Name',
  phone: '07900 000000',
  contactByEmail: true,
  contactBySms: false,
  marketingOptIn: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue({
    userId: USER,
    emailVerified: true,
    actor: `customer:${USER}`,
  });
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  findFirst.mockResolvedValue(EXISTING);
  update.mockResolvedValue({});
});

describe('updateProfile (FR-T-11)', () => {
  it('denies a signed-out visitor (fail-closed) — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await updateProfile({ ok: false }, form({ name: 'New Name' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a blank name (Zod) — no write', async () => {
    const res = await updateProfile({ ok: false }, form({ name: '   ' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid non-empty phone (Zod) — no write', async () => {
    const res = await updateProfile({ ok: false }, form({ name: 'New', phone: 'not-a-phone' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the customer own row and audits the before/after in one transaction', async () => {
    const res = await updateProfile(
      { ok: false },
      form({
        name: '  New Name  ',
        phone: '07911 123456',
        contactByEmail: 'on',
        contactBySms: 'on',
        marketingOptIn: 'on',
      }),
    );
    expect(res).toEqual({ ok: true });
    // Scoped to the acting customer's own, customer-type row.
    expect(findFirst.mock.calls[0]![0]).toMatchObject({ where: { id: USER, type: 'customer' } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0]).toMatchObject({
      where: { id: USER },
      data: {
        name: 'New Name',
        phone: '07911 123456',
        contactByEmail: true,
        contactBySms: true,
        marketingOptIn: true,
      },
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      actor: `customer:${USER}`,
      action: 'customer_profile.updated',
      entity: 'user',
      entityId: USER,
      diff: {
        name: { from: 'Old Name', to: 'New Name' },
        marketingOptIn: { from: false, to: true },
      },
    });
  });

  it('persists a cleared phone as NULL', async () => {
    await updateProfile({ ok: false }, form({ name: 'New', phone: '' }));
    expect(update.mock.calls[0]![0].data.phone).toBeNull();
  });

  it('treats omitted preference checkboxes as false (unchecked)', async () => {
    await updateProfile({ ok: false }, form({ name: 'New' }));
    const data = update.mock.calls[0]![0].data;
    expect(data.contactByEmail).toBe(false);
    expect(data.contactBySms).toBe(false);
    expect(data.marketingOptIn).toBe(false);
  });

  it('returns not-found (no write) when the acting id is not a customer row', async () => {
    findFirst.mockResolvedValue(null);
    const res = await updateProfile({ ok: false }, form({ name: 'New' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
