import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-T FR-T-7/8 — the audited saved-search CRUD actions. Each write is
// fail-closed on a signed-in, EMAIL-VERIFIED customer (FR-T-2); the input is
// Zod-validated; every mutation + its audit row run in ONE tenant transaction (G4),
// scoped to the customer's OWN rows. Mirrors the saved-property / feedback action
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
const findFirst = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({ savedSearch: { findFirst, create, update, delete: remove } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createSavedSearch, renameSavedSearch, updateSavedSearchFrequency, deleteSavedSearch } =
  await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const USER = '22222222-2222-2222-2222-222222222222';
const SEARCH = '33333333-3333-3333-3333-333333333333';

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
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
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({ id: SEARCH });
  update.mockResolvedValue({});
  remove.mockResolvedValue({});
});

describe('createSavedSearch (FR-T-7)', () => {
  it('denies a signed-out visitor (fail-closed) — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await createSavedSearch({ ok: false }, form({ name: 'Flats', filters: '{}' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('denies a signed-in but EMAIL-UNVERIFIED customer (FR-T-2) — no write', async () => {
    getCustomerSession.mockResolvedValue({
      userId: USER,
      emailVerified: false,
      actor: `customer:${USER}`,
    });
    const res = await createSavedSearch({ ok: false }, form({ name: 'Flats', filters: '{}' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a blank name (Zod) — no write', async () => {
    const res = await createSavedSearch({ ok: false }, form({ name: '   ', filters: '{}' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('creates the search with normalised filters + cadence and audits it in one transaction', async () => {
    const res = await createSavedSearch(
      { ok: false },
      form({
        name: 'Two-bed flats',
        filters: JSON.stringify({ location: 'Didsbury', bedroomsMin: '2' }),
        alertFrequency: 'daily',
      }),
    );
    expect(res).toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      tenantId: TENANT,
      userId: USER,
      name: 'Two-bed flats',
      alertFrequency: 'daily',
    });
    // Filters were normalised through the catalogue schema (string → number).
    expect(data.filters.bedroomsMin).toBe(2);
    expect(data.filters.location).toBe('Didsbury');
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      actor: `customer:${USER}`,
      action: 'saved_search.created',
      entity: 'saved_search',
      entityId: SEARCH,
    });
  });

  it('defaults the cadence to off when none is submitted', async () => {
    await createSavedSearch({ ok: false }, form({ name: 'Anything', filters: '{}' }));
    expect(create.mock.calls[0]![0].data.alertFrequency).toBe('off');
  });

  it('rejects a duplicate name for the same customer — no write', async () => {
    findFirst.mockResolvedValue({ id: 'other', name: 'Flats', alertFrequency: 'off' });
    const res = await createSavedSearch({ ok: false }, form({ name: 'Flats', filters: '{}' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a malformed filters JSON blob — no write', async () => {
    const res = await createSavedSearch(
      { ok: false },
      form({ name: 'Flats', filters: '{not json' }),
    );
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('renameSavedSearch (FR-T-8)', () => {
  it('denies a signed-out visitor — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await renameSavedSearch({ ok: false }, form({ id: SEARCH, name: 'New' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns not-found when the search is not the customer own', async () => {
    findFirst.mockResolvedValue(null);
    const res = await renameSavedSearch({ ok: false }, form({ id: SEARCH, name: 'New' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    // Scoped to the acting customer's own row.
    expect(findFirst.mock.calls[0]![0]).toMatchObject({ where: { id: SEARCH, userId: USER } });
  });

  it('renames the search and audits the before/after in one transaction', async () => {
    findFirst.mockResolvedValueOnce({ id: SEARCH, name: 'Old', alertFrequency: 'off' });
    findFirst.mockResolvedValueOnce(null); // no name clash
    const res = await renameSavedSearch({ ok: false }, form({ id: SEARCH, name: 'New name' }));
    expect(res).toEqual({ ok: true });
    expect(update.mock.calls[0]![0]).toMatchObject({
      where: { id: SEARCH },
      data: { name: 'New name' },
    });
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'saved_search.renamed',
      diff: { name: { from: 'Old', to: 'New name' } },
    });
  });

  it('rejects renaming to a name already used by another of the customer searches', async () => {
    findFirst.mockResolvedValueOnce({ id: SEARCH, name: 'Old', alertFrequency: 'off' });
    findFirst.mockResolvedValueOnce({ id: 'other', name: 'Taken', alertFrequency: 'off' });
    const res = await renameSavedSearch({ ok: false }, form({ id: SEARCH, name: 'Taken' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a blank new name (Zod) — no write', async () => {
    const res = await renameSavedSearch({ ok: false }, form({ id: SEARCH, name: '  ' }));
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('updateSavedSearchFrequency (FR-T-8)', () => {
  it('denies a signed-out visitor — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await updateSavedSearchFrequency(
      { ok: false },
      form({ id: SEARCH, alertFrequency: 'weekly' }),
    );
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an unknown cadence (Zod) — no write', async () => {
    const res = await updateSavedSearchFrequency(
      { ok: false },
      form({ id: SEARCH, alertFrequency: 'hourly' }),
    );
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the cadence and audits the before/after in one transaction', async () => {
    findFirst.mockResolvedValue({ id: SEARCH, name: 'Flats', alertFrequency: 'off' });
    const res = await updateSavedSearchFrequency(
      { ok: false },
      form({ id: SEARCH, alertFrequency: 'weekly' }),
    );
    expect(res).toEqual({ ok: true });
    expect(update.mock.calls[0]![0]).toMatchObject({
      where: { id: SEARCH },
      data: { alertFrequency: 'weekly' },
    });
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'saved_search.frequency_changed',
      diff: { alertFrequency: { from: 'off', to: 'weekly' } },
    });
  });

  it('returns not-found for a search the customer does not own', async () => {
    findFirst.mockResolvedValue(null);
    const res = await updateSavedSearchFrequency(
      { ok: false },
      form({ id: SEARCH, alertFrequency: 'daily' }),
    );
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('deleteSavedSearch (FR-T-8)', () => {
  it('denies a signed-out visitor — no write', async () => {
    getCustomerSession.mockResolvedValue(null);
    const res = await deleteSavedSearch({ ok: false }, form({ id: SEARCH }));
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the customer own search and audits the removal in one transaction', async () => {
    findFirst.mockResolvedValue({ id: SEARCH, name: 'Flats', alertFrequency: 'off' });
    const res = await deleteSavedSearch({ ok: false }, form({ id: SEARCH }));
    expect(res).toEqual({ ok: true });
    expect(remove.mock.calls[0]![0]).toMatchObject({ where: { id: SEARCH } });
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'saved_search.deleted',
      entity: 'saved_search',
      entityId: SEARCH,
    });
  });

  it('returns not-found for a search the customer does not own — no write', async () => {
    findFirst.mockResolvedValue(null);
    const res = await deleteSavedSearch({ ok: false }, form({ id: SEARCH }));
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
