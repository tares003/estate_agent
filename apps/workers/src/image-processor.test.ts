import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listUnprocessedImages,
  markImageFailed,
  markImageProcessed,
  processTenantImages,
  runImageTick,
  variantKey,
  type ImageQueueClient,
  type ImageTenantRunner,
  type ImageTransform,
} from './image-processor.js';

const TENANT = '00000000-0000-0000-0000-000000000001';

function makeTx() {
  return {
    propertyImage: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

type Tx = ReturnType<typeof makeTx>;

function runnerFor(tx: Tx): ImageTenantRunner {
  return async (fn) => fn(tx as unknown as ImageQueueClient);
}

describe('variantKey', () => {
  it('inserts the variant name before the extension', () => {
    expect(variantKey('tenants/t/properties/p/abc.jpg', 'thumb')).toBe(
      'tenants/t/properties/p/abc.thumb.jpg',
    );
    expect(variantKey('tenants/t/properties/p/abc.webp', 'large')).toBe(
      'tenants/t/properties/p/abc.large.webp',
    );
  });
});

describe('listUnprocessedImages', () => {
  it('reads the oldest rows that have no recorded dimensions yet', async () => {
    const tx = makeTx();
    await listUnprocessedImages(tx as unknown as ImageQueueClient, 5);
    expect(tx.propertyImage.findMany).toHaveBeenCalledWith({
      where: { width: null },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
  });
});

describe('markImageProcessed / markImageFailed', () => {
  it('marks atomically (only a still-unprocessed row) and audits the outcome (G4)', async () => {
    const tx = makeTx();
    const marked = await markImageProcessed(tx as unknown as ImageQueueClient, {
      tenantId: TENANT,
      id: 'i1',
      width: 1200,
      height: 800,
    });
    expect(marked).toBe(true);
    expect(tx.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', width: null },
      data: { width: 1200, height: 800 },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        actor: 'worker:image-processing',
        action: 'property_image.processed',
        entity: 'property_image',
        entityId: 'i1',
      }),
    });
  });

  it('does not audit when another worker already marked the row', async () => {
    const tx = makeTx();
    tx.propertyImage.updateMany.mockResolvedValue({ count: 0 });
    const marked = await markImageProcessed(tx as unknown as ImageQueueClient, {
      tenantId: TENANT,
      id: 'i1',
      width: 1200,
      height: 800,
    });
    expect(marked).toBe(false);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('poisons a failing row with zero dimensions so it is never retried forever', async () => {
    const tx = makeTx();
    await markImageFailed(tx as unknown as ImageQueueClient, { tenantId: TENANT, id: 'i1' });
    expect(tx.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', width: null },
      data: { width: 0, height: 0 },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'property_image.process_failed' }),
    });
  });
});

describe('processTenantImages', () => {
  let tx: Tx;
  const get = vi.fn();
  const put = vi.fn();
  const backend = { get, put };
  const transform: ImageTransform = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    tx = makeTx();
    get.mockResolvedValue(Buffer.from([1]));
    put.mockResolvedValue(undefined);
    (transform as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Buffer.from([2]),
      width: 1200,
      height: 800,
      thumb: Buffer.from([3]),
      large: Buffer.from([4]),
    });
  });

  it('re-encodes in place, writes both variants, and marks the row', async () => {
    tx.propertyImage.findMany.mockResolvedValue([
      { id: 'i1', url: 'tenants/t/properties/p/abc.jpg' },
    ]);

    const counts = await processTenantImages({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      backend,
      transform,
    });

    expect(counts).toEqual({ processed: 1, failed: 0 });
    expect(get).toHaveBeenCalledWith('tenants/t/properties/p/abc.jpg');
    expect(put).toHaveBeenCalledWith('tenants/t/properties/p/abc.jpg', Buffer.from([2]), {
      contentType: 'image/jpeg',
    });
    expect(put).toHaveBeenCalledWith('tenants/t/properties/p/abc.thumb.jpg', Buffer.from([3]), {
      contentType: 'image/jpeg',
    });
    expect(put).toHaveBeenCalledWith('tenants/t/properties/p/abc.large.jpg', Buffer.from([4]), {
      contentType: 'image/jpeg',
    });
    expect(tx.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', width: null },
      data: { width: 1200, height: 800 },
    });
  });

  it('poisons a row whose bytes cannot be transformed and keeps going', async () => {
    tx.propertyImage.findMany.mockResolvedValue([
      { id: 'bad', url: 'tenants/t/properties/p/bad.jpg' },
      { id: 'ok', url: 'tenants/t/properties/p/ok.jpg' },
    ]);
    (transform as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('corrupt'))
      .mockResolvedValueOnce({
        data: Buffer.from([2]),
        width: 100,
        height: 50,
        thumb: Buffer.from([3]),
        large: Buffer.from([4]),
      });

    const counts = await processTenantImages({
      tenantId: TENANT,
      runTenant: runnerFor(tx),
      backend,
      transform,
    });

    expect(counts).toEqual({ processed: 1, failed: 1 });
    expect(tx.propertyImage.updateMany).toHaveBeenCalledWith({
      where: { id: 'bad', width: null },
      data: { width: 0, height: 0 },
    });
  });
});

describe('runImageTick', () => {
  it('processes every active tenant inside its own tenant scope', async () => {
    const txA = makeTx();
    const txB = makeTx();
    txA.propertyImage.findMany.mockResolvedValue([
      { id: 'i1', url: 'tenants/a/properties/p/a.png' },
    ]);
    txB.propertyImage.findMany.mockResolvedValue([]);
    const runners: Record<string, Tx> = { 'tenant-a': txA, 'tenant-b': txB };

    const backend = {
      get: vi.fn().mockResolvedValue(Buffer.from([1])),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const transform: ImageTransform = vi.fn().mockResolvedValue({
      data: Buffer.from([2]),
      width: 10,
      height: 10,
      thumb: Buffer.from([3]),
      large: Buffer.from([4]),
    });

    const totals = await runImageTick({
      listActiveTenants: async () => [{ id: 'tenant-a' }, { id: 'tenant-b' }],
      runTenantFor: (tenantId) => runnerFor(runners[tenantId]!),
      backend,
      transform,
    });

    expect(totals).toEqual({ tenants: 2, processed: 1, failed: 0 });
    expect(backend.put).toHaveBeenCalledWith(
      'tenants/a/properties/p/a.png',
      Buffer.from([2]),
      { contentType: 'image/png' },
    );
  });
});
