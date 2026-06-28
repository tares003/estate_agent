import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-O FR-O-4 — the audited, RBAC-gated SEO-metadata upsert + delete. Mirrors the
// redirect action test: mock the staff-session, tenant and db seams; assert fail-closed
// RBAC, Zod validation, the tenant-scoped mutation + the audit row written in the same
// transaction (G4), and the one-row-per-(scope, scopeId) upsert behaviour.

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
  fn({ seoMetadata: { findFirst, create, update, delete: remove } }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { upsertSeoMetadata, deleteSeoMetadata } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const SEO_ID = '11111111-1111-1111-1111-111111111111';
const ENTITY_ID = '22222222-2222-2222-2222-222222222222';

function upsertForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('scope', over['scope'] ?? 'property');
  if (over['scopeId'] !== '') fd.set('scopeId', over['scopeId'] ?? ENTITY_ID);
  fd.set('metaTitle', over['metaTitle'] ?? 'A concise title');
  fd.set('metaDescription', over['metaDescription'] ?? 'A short description.');
  if (over['structuredData'] !== undefined) fd.set('structuredData', over['structuredData']);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:settings');
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  findFirst.mockResolvedValue(null);
  create.mockResolvedValue({ id: SEO_ID });
  update.mockResolvedValue({});
  remove.mockResolvedValue({});
});

describe('upsertSeoMetadata', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await upsertSeoMetadata({ ok: false }, upsertForm());
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an entity scope missing its scopeId (no write)', async () => {
    const res = await upsertSeoMetadata({ ok: false }, upsertForm({ scopeId: '' }));
    expect(res.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid structured-data JSON (no write)', async () => {
    const res = await upsertSeoMetadata({ ok: false }, upsertForm({ structuredData: '{not json' }));
    expect(res.ok).toBe(false);
    expect(res.errors?.[0]?.field).toBe('structuredData');
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new override and audits it in the same transaction', async () => {
    const res = await upsertSeoMetadata({ ok: false }, upsertForm());
    expect(res.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      tenantId: TENANT,
      scope: 'property',
      scopeId: ENTITY_ID,
      metaTitle: 'A concise title',
      noIndex: false,
      noFollow: false,
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'seo_metadata.created',
      entity: 'seo_metadata',
      entityId: SEO_ID,
    });
  });

  it('updates the existing override (one row per scope/scopeId) and audits the diff', async () => {
    findFirst.mockResolvedValue({
      id: SEO_ID,
      metaTitle: 'Old title',
      metaDescription: null,
      canonicalUrl: null,
      ogImage: null,
      noIndex: false,
      noFollow: false,
      structuredData: null,
    });
    const res = await upsertSeoMetadata({ ok: false }, upsertForm({ metaTitle: 'New title' }));
    expect(res.ok).toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].where).toEqual({ id: SEO_ID });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'seo_metadata.updated',
      entity: 'seo_metadata',
      entityId: SEO_ID,
    });
  });

  it('accepts the tenant-wide default (default scope, no scopeId)', async () => {
    const res = await upsertSeoMetadata(
      { ok: false },
      upsertForm({ scope: 'default', scopeId: '' }),
    );
    expect(res.ok).toBe(true);
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({ scope: 'default', scopeId: null });
  });

  it('parses and carries through a structured-data override', async () => {
    const res = await upsertSeoMetadata(
      { ok: false },
      upsertForm({ structuredData: '{"@type":"RealEstateListing"}' }),
    );
    expect(res.ok).toBe(true);
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data['structuredData']).toEqual({ '@type': 'RealEstateListing' });
  });
});

describe('deleteSeoMetadata', () => {
  it('denies when the staff role lacks setting.manage (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const fd = new FormData();
    fd.set('id', SEO_ID);
    const res = await deleteSeoMetadata({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns not-found when the override does not exist', async () => {
    findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.set('id', SEO_ID);
    const res = await deleteSeoMetadata({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('deletes the override and audits it in the same transaction', async () => {
    findFirst.mockResolvedValue({
      id: SEO_ID,
      metaTitle: 'Title',
      metaDescription: null,
      canonicalUrl: null,
      ogImage: null,
      noIndex: false,
      noFollow: false,
      structuredData: null,
    });
    const fd = new FormData();
    fd.set('id', SEO_ID);
    const res = await deleteSeoMetadata({ ok: false }, fd);
    expect(res.ok).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]![0].where).toEqual({ id: SEO_ID });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'seo_metadata.deleted',
      entity: 'seo_metadata',
      entityId: SEO_ID,
    });
  });
});
