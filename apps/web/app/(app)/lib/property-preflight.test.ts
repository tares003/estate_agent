import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPublishPreflightInput, type PublishPreflightReader } from './property-preflight.js';

// EPIC-F FR-F-8 — assemble the §H.5 Tab 9 checklist input from a listing plus
// aggregate reads over its images + documents. Pure query-shaping over a STRUCTURAL
// Prisma client (DB-free to unit-test, mirrors admin-properties.ts); the live query
// runs tenant-scoped (RLS) via withTenant. Returns null for an absent listing.

const propertyFindFirst = vi.fn();
const imageCount = vi.fn();
const imageFindFirst = vi.fn();
const documentFindMany = vi.fn();

const reader = {
  property: { findFirst: propertyFindFirst },
  propertyImage: { count: imageCount, findFirst: imageFindFirst },
  propertyDocument: { findMany: documentFindMany },
} as unknown as PublishPreflightReader;

const PROP = 'p1';

beforeEach(() => {
  vi.clearAllMocks();
  propertyFindFirst.mockResolvedValue({
    id: PROP,
    description: 'word '.repeat(150).trim(),
    keyFeatures: ['a', 'b', 'c'],
    metaTitle: 'Title',
    metaDescription: 'Description',
    latitude: 51.5,
    longitude: 0.6,
    councilTaxBand: 'd',
    tenure: 'freehold',
    epcRating: 'c',
    materialInfoUrl: null,
  });
  imageCount.mockResolvedValue(6);
  imageFindFirst.mockImplementation((args: { where: Record<string, unknown> }) =>
    Promise.resolve('isPrimary' in args.where || 'isFloorplan' in args.where ? { id: 'x' } : null),
  );
  documentFindMany.mockResolvedValue([{ type: 'epc' }, { type: 'material_information' }]);
});

describe('loadPublishPreflightInput', () => {
  it('returns null when the listing is absent (or soft-deleted)', async () => {
    propertyFindFirst.mockResolvedValue(null);
    expect(await loadPublishPreflightInput(reader, PROP)).toBeNull();
  });

  it('only reads non-soft-deleted listings', async () => {
    await loadPublishPreflightInput(reader, PROP);
    expect(propertyFindFirst).toHaveBeenCalledWith({ where: { id: PROP, deletedAt: null } });
  });

  it('maps image + document aggregates into the checklist input', async () => {
    const input = await loadPublishPreflightInput(reader, PROP);
    expect(input).toMatchObject({
      imageCount: 6,
      hasMainImage: true,
      hasFloorplan: true,
      hasEpcDocument: true,
      hasMaterialInformation: true,
      keyFeatureCount: 3,
      councilTaxBand: 'd',
      tenure: 'freehold',
    });
  });

  it('treats a missing main image / floorplan as not satisfied', async () => {
    imageFindFirst.mockResolvedValue(null);
    documentFindMany.mockResolvedValue([]);
    const input = await loadPublishPreflightInput(reader, PROP);
    expect(input?.hasMainImage).toBe(false);
    expect(input?.hasFloorplan).toBe(false);
    expect(input?.hasEpcDocument).toBe(false);
    expect(input?.hasMaterialInformation).toBe(false);
  });

  it('counts a floorplan from a document when no floorplan image exists', async () => {
    imageFindFirst.mockImplementation((args: { where: Record<string, unknown> }) =>
      Promise.resolve('isPrimary' in args.where ? { id: 'x' } : null),
    );
    documentFindMany.mockResolvedValue([{ type: 'floorplan' }]);
    const input = await loadPublishPreflightInput(reader, PROP);
    expect(input?.hasFloorplan).toBe(true);
  });

  it('treats a non-array keyFeatures JSON value as zero features', async () => {
    propertyFindFirst.mockResolvedValue({
      id: PROP,
      description: null,
      keyFeatures: null,
      metaTitle: null,
      metaDescription: null,
      latitude: null,
      longitude: null,
      councilTaxBand: null,
      tenure: null,
      epcRating: null,
      materialInfoUrl: null,
    });
    const input = await loadPublishPreflightInput(reader, PROP);
    expect(input?.keyFeatureCount).toBe(0);
  });

  it('counts material information from materialInfoUrl when no document exists', async () => {
    documentFindMany.mockResolvedValue([]);
    propertyFindFirst.mockResolvedValue({
      id: PROP,
      description: null,
      keyFeatures: [],
      metaTitle: null,
      metaDescription: null,
      latitude: null,
      longitude: null,
      councilTaxBand: null,
      tenure: null,
      epcRating: null,
      materialInfoUrl: '/files/material.pdf',
    });
    const input = await loadPublishPreflightInput(reader, PROP);
    expect(input?.hasMaterialInformation).toBe(true);
  });
});
