import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyObjectToken } from '@estate/storage';

const getCurrentTenantId = vi.fn();
const getRequestIp = vi.fn();
vi.mock('../../../lib/tenant.js', () => ({
  getCurrentTenantId: () => getCurrentTenantId(),
  getRequestIp: () => getRequestIp(),
}));
vi.mock('../../../lib/db.js', () => ({ getDb: () => ({}) }));

const requireStaffPermission = vi.fn();
const getStaffActor = vi.fn();
vi.mock('../../../lib/staff-session.js', () => ({
  requireStaffPermission: (...args: unknown[]) => requireStaffPermission(...args),
  getStaffActor: () => getStaffActor(),
}));

const exists = vi.fn();
vi.mock('../../../lib/storage.js', () => ({
  getStorageBackend: () => ({ exists }),
  storageSigningSecret: () => 'test-secret',
}));

const audit = vi.fn();
const propertyFindFirst = vi.fn();
const imageCreate = vi.fn();
const imageCount = vi.fn();
const withTenant = vi.fn(async (_db: unknown, _t: string, fn: (tx: unknown) => unknown) =>
  fn({
    property: { findFirst: propertyFindFirst },
    propertyImage: { create: imageCreate, count: imageCount },
  }),
);
vi.mock('@estate/db', () => ({ withTenant, audit }));

const { createPropertyImageUpload, finalizePropertyImage } = await import('./image-actions.js');

const TENANT = '00000000-0000-0000-0000-000000000001';
const PROPERTY = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentTenantId.mockResolvedValue(TENANT);
  getRequestIp.mockResolvedValue('203.0.113.7');
  requireStaffPermission.mockResolvedValue(undefined);
  getStaffActor.mockResolvedValue('user:staff-1');
  propertyFindFirst.mockResolvedValue({ id: PROPERTY });
  exists.mockResolvedValue(true);
  imageCount.mockResolvedValue(0);
  imageCreate.mockResolvedValue({ id: 'img-1' });
});

describe('createPropertyImageUpload', () => {
  it('issues a signed upload token for a tenant-scoped key under the listing', async () => {
    const result = await createPropertyImageUpload({
      propertyId: PROPERTY,
      contentType: 'image/jpeg',
    });

    expect(result.ok).toBe(true);
    expect(requireStaffPermission).toHaveBeenCalledWith('property.write');
    expect(result.key).toMatch(
      new RegExp(`^tenants/${TENANT}/properties/${PROPERTY}/[0-9a-f-]+\\.jpg$`),
    );
    // the token attests exactly that key under the signing secret
    const verified = verifyObjectToken(result.token!, 'test-secret', Date.now());
    expect(verified?.key).toBe(result.key);
  });

  it('rejects a disallowed content type before any work', async () => {
    const result = await createPropertyImageUpload({
      propertyId: PROPERTY,
      contentType: 'text/html',
    });
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await createPropertyImageUpload({
      propertyId: PROPERTY,
      contentType: 'image/jpeg',
    });
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it('refuses an unknown listing (cross-tenant ids look unknown under RLS)', async () => {
    propertyFindFirst.mockResolvedValue(null);
    const result = await createPropertyImageUpload({
      propertyId: PROPERTY,
      contentType: 'image/jpeg',
    });
    expect(result.ok).toBe(false);
  });
});

describe('finalizePropertyImage', () => {
  const KEY = `tenants/${TENANT}/properties/${PROPERTY}/abc.jpg`;

  it('records the uploaded image (first image becomes the hero) and audits (G4)', async () => {
    const result = await finalizePropertyImage({
      propertyId: PROPERTY,
      key: KEY,
      alt: 'The front elevation',
    });

    expect(result.ok).toBe(true);
    expect(exists).toHaveBeenCalledWith(KEY);
    expect(imageCreate).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        propertyId: PROPERTY,
        url: KEY,
        alt: 'The front elevation',
        sortOrder: 0,
        isPrimary: true,
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'property_image.created',
        entity: 'property_image',
        entityId: 'img-1',
      }),
    );
  });

  it('appends later images without stealing the hero flag', async () => {
    imageCount.mockResolvedValue(3);
    await finalizePropertyImage({ propertyId: PROPERTY, key: KEY, alt: 'Kitchen' });
    expect(imageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sortOrder: 3, isPrimary: false }),
    });
  });

  it('refuses a key outside the listing prefix without writing (no cross-listing grafts)', async () => {
    const result = await finalizePropertyImage({
      propertyId: PROPERTY,
      key: `tenants/${TENANT}/properties/other-property/abc.jpg`,
      alt: 'x',
    });
    expect(result.ok).toBe(false);
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it('refuses an upload that never landed in storage', async () => {
    exists.mockResolvedValue(false);
    const result = await finalizePropertyImage({ propertyId: PROPERTY, key: KEY, alt: 'x' });
    expect(result.ok).toBe(false);
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it('fails closed when RBAC denies, before any read or write', async () => {
    requireStaffPermission.mockRejectedValue(new Error('denied'));
    const result = await finalizePropertyImage({ propertyId: PROPERTY, key: KEY, alt: 'x' });
    expect(result.ok).toBe(false);
    expect(withTenant).not.toHaveBeenCalled();
  });
});
