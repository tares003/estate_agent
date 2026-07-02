import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-F FR-F-1 / FR-F-4 / FR-F-5 (FR-O-12) — the audited property create/update actions.
// Mirrors the redirect action test: mock the staff-session, tenant and db seams; assert
// fail-closed RBAC, the tenant-scoped mutation + audit row in one transaction (G4), the
// slug auto-generation + disambiguation, and — the keystone — that a slug change on
// update mints a 301 Redirect row (audited) while an update with no slug change does not.

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
const getStaffUserId = vi.fn();
vi.mock('../../lib/staff-session.js', () => ({
  requireStaffPermission: (...a: unknown[]) => requireStaffPermission(...a),
  getStaffActor: () => getStaffActor(),
  getStaffUserId: () => getStaffUserId(),
}));

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../lib/db.js', () => ({ getDb: () => ({}) }));

const audit = vi.fn();
const propertyFindFirst = vi.fn();
const propertyFindMany = vi.fn();
const propertyCreate = vi.fn();
const propertyUpdate = vi.fn();
const redirectFindFirst = vi.fn();
const redirectCreate = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: {
      findFirst: propertyFindFirst,
      findMany: propertyFindMany,
      create: propertyCreate,
      update: propertyUpdate,
    },
    redirect: { findFirst: redirectFindFirst, create: redirectCreate },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createProperty, updateProperty } = await import('./actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const PROPERTY_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function createForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('reference', over['reference'] ?? 'REF-001');
  fd.set('listingType', over['listingType'] ?? 'residential');
  fd.set('saleType', over['saleType'] ?? 'sale');
  fd.set('displayAddress', over['displayAddress'] ?? '12 Acacia Avenue, Chorlton');
  fd.set('postcode', over['postcode'] ?? 'M21 9WN');
  fd.set('title', over['title'] ?? 'Charming Two-Bed Flat');
  fd.set('town', over['town'] ?? 'Chorlton');
  if (over['slug'] !== undefined) fd.set('slug', over['slug']);
  if (over['price'] !== undefined) fd.set('price', over['price']);
  return fd;
}

function updateForm(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('id', over['id'] ?? PROPERTY_ID);
  fd.set('displayAddress', over['displayAddress'] ?? '12 Acacia Avenue, Chorlton');
  fd.set('postcode', over['postcode'] ?? 'M21 9WN');
  if (over['slug'] !== undefined) fd.set('slug', over['slug']);
  if (over['title'] !== undefined) fd.set('title', over['title']);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('agent:albert-aardvark');
  getStaffUserId.mockResolvedValue(USER_ID);
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  propertyFindFirst.mockResolvedValue(null);
  propertyFindMany.mockResolvedValue([]);
  propertyCreate.mockResolvedValue({
    id: PROPERTY_ID,
    slug: 'charming-two-bed-flat-chorlton-m21',
  });
  propertyUpdate.mockResolvedValue({});
  redirectFindFirst.mockResolvedValue(null);
  redirectCreate.mockResolvedValue({ id: 'redirect-1' });
});

describe('createProperty', () => {
  it('denies when the staff role lacks property.write (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await createProperty({ ok: false }, createForm());
    expect(res.ok).toBe(false);
    expect(propertyCreate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an invalid submission before any write', async () => {
    const res = await createProperty({ ok: false }, createForm({ listingType: 'houseboat' }));
    expect(res.ok).toBe(false);
    expect(propertyCreate).not.toHaveBeenCalled();
  });

  it('creates the property and audits it in the same transaction', async () => {
    const res = await createProperty({ ok: false }, createForm());
    expect(res.ok).toBe(true);
    expect(propertyCreate).toHaveBeenCalledTimes(1);
    const data = propertyCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      tenantId: TENANT,
      reference: 'REF-001',
      listingType: 'residential',
      saleType: 'sale',
      createdByUserId: USER_ID,
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({
      action: 'property.created',
      entity: 'property',
      entityId: PROPERTY_ID,
    });
  });

  it('auto-generates the slug from title/town/postcode when none is supplied (FR-F-4)', async () => {
    await createProperty({ ok: false }, createForm());
    const data = propertyCreate.mock.calls[0]![0].data as { slug: string };
    expect(data.slug).toBe('charming-two-bed-flat-chorlton-m21');
  });

  it('disambiguates a colliding slug with a numeric suffix (FR-F-11)', async () => {
    propertyFindMany.mockResolvedValue([{ slug: 'charming-two-bed-flat-chorlton-m21' }]);
    await createProperty({ ok: false }, createForm());
    const data = propertyCreate.mock.calls[0]![0].data as { slug: string };
    expect(data.slug).toBe('charming-two-bed-flat-chorlton-m21-2');
  });

  it('converts the submitted price from pounds to pence', async () => {
    await createProperty({ ok: false }, createForm({ price: '350000' }));
    const data = propertyCreate.mock.calls[0]![0].data as { price: number };
    expect(data.price).toBe(35000000);
  });

  it('persists the per-vertical extension fields for a care_home listing (FR-F-3)', async () => {
    const fd = createForm({ listingType: 'care_home' });
    fd.set('bedCount', '42');
    fd.set('cqcRating', 'good');
    fd.set('cqcInspectionUrl', 'https://www.cqc.org.uk/location/1-234');
    fd.set('isGoingConcern', 'on');
    const res = await createProperty({ ok: false }, fd);
    expect(res.ok).toBe(true);
    const data = propertyCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      listingType: 'care_home',
      bedCount: 42,
      cqcRating: 'good',
      cqcInspectionUrl: 'https://www.cqc.org.uk/location/1-234',
      isGoingConcern: true,
    });
  });

  it('rejects a vertical field that does not belong to the listing type (FR-F-3 isolation)', async () => {
    const fd = createForm({ listingType: 'residential' });
    fd.set('cqcRating', 'good');
    const res = await createProperty({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(propertyCreate).not.toHaveBeenCalled();
  });
});

describe('updateProperty', () => {
  it('denies when the staff role lacks property.write (fail-closed)', async () => {
    requireStaffPermission.mockRejectedValue(new Error('forbidden'));
    const res = await updateProperty({ ok: false }, updateForm());
    expect(res.ok).toBe(false);
    expect(propertyUpdate).not.toHaveBeenCalled();
  });

  it('returns not-found when the property does not exist', async () => {
    propertyFindFirst.mockResolvedValue(null);
    const res = await updateProperty({ ok: false }, updateForm({ slug: 'new-slug' }));
    expect(res.ok).toBe(false);
    expect(propertyUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('updates without a slug change and creates NO redirect', async () => {
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID, slug: 'existing-slug' });
    const res = await updateProperty({ ok: false }, updateForm({ title: 'Refreshed Title' }));
    expect(res.ok).toBe(true);
    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    expect(redirectCreate).not.toHaveBeenCalled();
    // Exactly one audit row — the property update, no redirect audit.
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'property.updated' });
  });

  it('creates a 301 redirect (audited) when the slug changes (FR-F-5 / FR-O-12)', async () => {
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID, slug: 'old-slug' });
    propertyFindMany.mockResolvedValue([]);
    const res = await updateProperty({ ok: false }, updateForm({ slug: 'new-slug' }));
    expect(res.ok).toBe(true);
    expect(res.slug).toBe('new-slug');
    expect(propertyUpdate).toHaveBeenCalledTimes(1);
    // The redirect row: 301 from the old path to the new.
    expect(redirectCreate).toHaveBeenCalledTimes(1);
    const redirectData = redirectCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(redirectData).toMatchObject({
      tenantId: TENANT,
      sourcePath: '/properties/old-slug',
      destinationPath: '/properties/new-slug',
      type: 'r301',
    });
    // Two audit rows: the property update AND the redirect creation.
    expect(audit).toHaveBeenCalledTimes(2);
    const actions = audit.mock.calls.map((call) => (call[1] as { action: string }).action);
    expect(actions).toEqual(['property.updated', 'redirect.created']);
  });

  it('does not create a duplicate redirect when one already claims the old path', async () => {
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID, slug: 'old-slug' });
    redirectFindFirst.mockResolvedValue({ id: 'existing-redirect' });
    const res = await updateProperty({ ok: false }, updateForm({ slug: 'new-slug' }));
    expect(res.ok).toBe(true);
    expect(redirectCreate).not.toHaveBeenCalled();
    // Only the property update is audited; the redirect was skipped.
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'property.updated' });
  });

  it('persists + audits a per-vertical extension field change (FR-F-3)', async () => {
    propertyFindFirst.mockResolvedValue({
      id: PROPERTY_ID,
      slug: 'existing-slug',
      listingType: 'care_home',
    });
    const fd = updateForm();
    fd.set('bedCount', '48');
    const res = await updateProperty({ ok: false }, fd);
    expect(res.ok).toBe(true);
    const data = propertyUpdate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.bedCount).toBe(48);
    // The change is captured in the property.updated audit diff.
    expect(audit).toHaveBeenCalled();
    expect(audit.mock.calls[0]![1]).toMatchObject({ action: 'property.updated' });
  });

  it('clears a per-vertical boolean flag when its checkbox is unticked on edit (FR-F-3)', async () => {
    propertyFindFirst.mockResolvedValue({
      id: PROPERTY_ID,
      slug: 'existing-slug',
      listingType: 'care_home',
    });
    // The form pairs each checkbox with a hidden `false` companion, so an unticked box
    // still posts "false". The edit must persist isGoingConcern:false — not drop the
    // field and leave a previously-true column unchanged.
    const fd = updateForm();
    fd.set('isGoingConcern', 'false');
    const res = await updateProperty({ ok: false }, fd);
    expect(res.ok).toBe(true);
    const data = propertyUpdate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.isGoingConcern).toBe(false);
  });

  it('sets a per-vertical boolean flag when its checkbox is ticked on edit (FR-F-3)', async () => {
    propertyFindFirst.mockResolvedValue({
      id: PROPERTY_ID,
      slug: 'existing-slug',
      listingType: 'care_home',
    });
    const fd = updateForm();
    fd.set('isGoingConcern', 'on');
    const res = await updateProperty({ ok: false }, fd);
    expect(res.ok).toBe(true);
    const data = propertyUpdate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.isGoingConcern).toBe(true);
  });

  it('disambiguates a slug change that collides with another property (FR-F-11)', async () => {
    propertyFindFirst.mockResolvedValue({ id: PROPERTY_ID, slug: 'old-slug' });
    propertyFindMany.mockResolvedValue([{ slug: 'new-slug' }]);
    const res = await updateProperty({ ok: false }, updateForm({ slug: 'new-slug' }));
    expect(res.ok).toBe(true);
    expect(res.slug).toBe('new-slug-2');
    const redirectData = redirectCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(redirectData).toMatchObject({ destinationPath: '/properties/new-slug-2' });
  });
});
