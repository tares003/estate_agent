import { beforeEach, describe, expect, it, vi } from 'vitest';

// EPIC-F FR-F-8 — publish-with-preflight Server Action. A property is publishable
// only when the §H.5 Tab 9 checklist is all-green, OR when a typed override reason
// is supplied (which is recorded in the audit log). Mirrors publish-actions.test.ts:
// RBAC fail-closed before any read/write; the mutation + audit run in one tenant
// transaction (G4).

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const getStaffActor = vi.fn();
const requireStaffPermission = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  getStaffActor: () => getStaffActor(),
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
}));

const audit = vi.fn();
const propertyFindFirst = vi.fn();
const propertyUpdate = vi.fn();
const imageCount = vi.fn();
const imageFindFirst = vi.fn();
const documentFindMany = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findFirst: propertyFindFirst, update: propertyUpdate },
    propertyImage: { count: imageCount, findFirst: imageFindFirst },
    propertyDocument: { findMany: documentFindMany },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { publishWithPreflight } = await import('./publish-preflight-actions.js');

const PROP = '11111111-1111-1111-1111-111111111111';
const TENANT = '00000000-0000-0000-0000-000000000001';

/** A property row that satisfies every Tab 9 item. */
function readyProperty(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PROP,
    description: 'word '.repeat(150).trim(),
    keyFeatures: ['South-facing garden', 'Off-street parking', 'Recently refurbished'],
    metaTitle: 'A bright two-bed flat',
    metaDescription: 'Close to the station, refurbished throughout.',
    latitude: 51.54,
    longitude: 0.65,
    councilTaxBand: 'd',
    tenure: 'freehold',
    epcRating: 'c',
    publishedAt: null,
    ...over,
  };
}

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = { id: PROP, ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  getStaffActor.mockResolvedValue('agent:dev-staff');
  requireStaffPermission.mockResolvedValue(undefined);
  propertyFindFirst.mockResolvedValue(readyProperty());
  propertyUpdate.mockResolvedValue({});
  // Ready by default: 6 photos, a main image, a floorplan, EPC + material info docs.
  imageCount.mockResolvedValue(6);
  imageFindFirst.mockImplementation((args: { where: Record<string, unknown> }) =>
    Promise.resolve(
      'isPrimary' in args.where || 'isFloorplan' in args.where ? { id: 'img-1' } : null,
    ),
  );
  documentFindMany.mockResolvedValue([{ type: 'epc' }, { type: 'material_information' }]);
});

describe('publishWithPreflight', () => {
  it('publishes a ready listing (no override) and audits it (G4)', async () => {
    const result = await publishWithPreflight({ ok: false }, form());

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('property.publish');
    expect(propertyUpdate).toHaveBeenCalledWith({
      where: { id: PROP },
      data: { publishedAt: expect.any(Date) },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'property.published',
        entity: 'property',
        entityId: PROP,
      }),
    );
  });

  it('blocks publish when the checklist fails and no override is given', async () => {
    imageCount.mockResolvedValue(2); // fails "at least 5 photos"

    const result = await publishWithPreflight({ ok: false }, form());

    expect(result.ok).toBe(false);
    expect(propertyUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    // surfaces the unmet items so the UI can echo them
    expect(result.unmet).toContain('photos');
  });

  it('requires a typed reason to override a failing checklist', async () => {
    imageCount.mockResolvedValue(2);

    const result = await publishWithPreflight({ ok: false }, form({ override: 'true' }));

    expect(result.ok).toBe(false);
    expect(propertyUpdate).not.toHaveBeenCalled();
    expect(result.errors?.some((e) => e.field === 'reason')).toBe(true);
  });

  it('publishes on override WITH a reason and records the reason + unmet items in the audit diff', async () => {
    imageCount.mockResolvedValue(2);

    const result = await publishWithPreflight(
      { ok: false },
      form({ override: 'true', reason: 'Vendor instructed go-live ahead of floorplan delivery.' }),
    );

    expect(result.ok).toBe(true);
    expect(propertyUpdate).toHaveBeenCalledWith({
      where: { id: PROP },
      data: { publishedAt: expect.any(Date) },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'property.published',
        entityId: PROP,
        diff: expect.objectContaining({
          override: true,
          reason: 'Vendor instructed go-live ahead of floorplan delivery.',
          unmet: expect.arrayContaining(['photos']),
        }),
      }),
    );
  });

  it('records override:false in the audit diff for a clean publish', async () => {
    await publishWithPreflight({ ok: false }, form());

    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ diff: expect.objectContaining({ override: false }) }),
    );
  });

  it('rejects a non-uuid id before any read/write', async () => {
    const result = await publishWithPreflight({ ok: false }, form({ id: 'nope' }));
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('is RBAC-gated on property.publish — denies before withTenant', async () => {
    requireStaffPermission.mockRejectedValue(new Error('PermissionError'));
    const result = await publishWithPreflight({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('returns not-found and writes nothing when the listing is absent', async () => {
    propertyFindFirst.mockResolvedValue(null);
    const result = await publishWithPreflight({ ok: false }, form());
    expect(result.ok).toBe(false);
    expect(propertyUpdate).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
