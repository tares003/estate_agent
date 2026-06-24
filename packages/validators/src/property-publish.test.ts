import { describe, expect, it } from 'vitest';

import {
  PUBLISH_PREFLIGHT_ITEMS,
  evaluatePublishPreflight,
  isPublishReady,
  publishOverrideSchema,
  type PublishPreflightInput,
} from './property-publish.js';

// EPIC-F FR-F-8 — a property shall not be publishable unless the pre-flight
// checklist in master spec §H.5 Tab 9 is satisfied, or explicitly overridden with
// a typed reason recorded in the audit log. The checklist is pure policy over the
// property + its images + documents, shared between the admin Server Action (gate)
// and the right-rail UI (the green/red ticks). The 11 items are verbatim Tab 9.

/** A property that satisfies every Tab 9 checklist item. */
function ready(): PublishPreflightInput {
  return {
    imageCount: 6,
    hasMainImage: true,
    hasFloorplan: true,
    hasEpcDocument: false,
    epcRating: 'c', // a real rating stands in for a held certificate
    hasMaterialInformation: true,
    description: 'word '.repeat(150).trim(),
    keyFeatureCount: 3,
    metaTitle: 'A bright two-bed flat in Leigh-on-Sea',
    metaDescription: 'Close to the station, recently refurbished throughout.',
    latitude: 51.54,
    longitude: 0.65,
    councilTaxBand: 'd',
    tenure: 'freehold',
  };
}

describe('PUBLISH_PREFLIGHT_ITEMS', () => {
  it('lists the eleven §H.5 Tab 9 checklist keys in order', () => {
    expect(PUBLISH_PREFLIGHT_ITEMS).toEqual([
      'photos',
      'mainImage',
      'floorplan',
      'epc',
      'materialInformation',
      'description',
      'keyFeatures',
      'seo',
      'latLng',
      'councilTaxBand',
      'tenure',
    ]);
  });
});

describe('evaluatePublishPreflight', () => {
  it('passes every item for a fully-populated listing', () => {
    const result = evaluatePublishPreflight(ready());
    expect(result.every((item) => item.satisfied)).toBe(true);
    expect(result).toHaveLength(PUBLISH_PREFLIGHT_ITEMS.length);
    expect(isPublishReady(result)).toBe(true);
  });

  it('requires at least 5 photos', () => {
    const four = evaluatePublishPreflight({ ...ready(), imageCount: 4 });
    expect(four.find((i) => i.key === 'photos')?.satisfied).toBe(false);
    const five = evaluatePublishPreflight({ ...ready(), imageCount: 5 });
    expect(five.find((i) => i.key === 'photos')?.satisfied).toBe(true);
  });

  it('requires a main image to be set', () => {
    const result = evaluatePublishPreflight({ ...ready(), hasMainImage: false });
    expect(result.find((i) => i.key === 'mainImage')?.satisfied).toBe(false);
  });

  it('requires a floorplan', () => {
    const result = evaluatePublishPreflight({ ...ready(), hasFloorplan: false });
    expect(result.find((i) => i.key === 'floorplan')?.satisfied).toBe(false);
  });

  it('treats EPC as satisfied by a document OR a held (non-pending) rating', () => {
    const byDoc = evaluatePublishPreflight({
      ...ready(),
      hasEpcDocument: true,
      epcRating: null,
    });
    expect(byDoc.find((i) => i.key === 'epc')?.satisfied).toBe(true);

    const byRating = evaluatePublishPreflight({
      ...ready(),
      hasEpcDocument: false,
      epcRating: 'b',
    });
    expect(byRating.find((i) => i.key === 'epc')?.satisfied).toBe(true);

    const pendingOnly = evaluatePublishPreflight({
      ...ready(),
      hasEpcDocument: false,
      epcRating: 'pending',
    });
    expect(pendingOnly.find((i) => i.key === 'epc')?.satisfied).toBe(false);

    const none = evaluatePublishPreflight({
      ...ready(),
      hasEpcDocument: false,
      epcRating: null,
    });
    expect(none.find((i) => i.key === 'epc')?.satisfied).toBe(false);
  });

  it('requires material information to be completed', () => {
    const result = evaluatePublishPreflight({ ...ready(), hasMaterialInformation: false });
    expect(result.find((i) => i.key === 'materialInformation')?.satisfied).toBe(false);
  });

  it('requires a full description of at least 150 words', () => {
    const short = evaluatePublishPreflight({ ...ready(), description: 'word '.repeat(149).trim() });
    expect(short.find((i) => i.key === 'description')?.satisfied).toBe(false);
    const exactly = evaluatePublishPreflight({
      ...ready(),
      description: 'word '.repeat(150).trim(),
    });
    expect(exactly.find((i) => i.key === 'description')?.satisfied).toBe(true);
    const none = evaluatePublishPreflight({ ...ready(), description: null });
    expect(none.find((i) => i.key === 'description')?.satisfied).toBe(false);
  });

  it('requires at least 3 key features', () => {
    const two = evaluatePublishPreflight({ ...ready(), keyFeatureCount: 2 });
    expect(two.find((i) => i.key === 'keyFeatures')?.satisfied).toBe(false);
    const three = evaluatePublishPreflight({ ...ready(), keyFeatureCount: 3 });
    expect(three.find((i) => i.key === 'keyFeatures')?.satisfied).toBe(true);
  });

  it('requires both an SEO meta title and meta description', () => {
    const noTitle = evaluatePublishPreflight({ ...ready(), metaTitle: null });
    expect(noTitle.find((i) => i.key === 'seo')?.satisfied).toBe(false);
    const noDesc = evaluatePublishPreflight({ ...ready(), metaDescription: '   ' });
    expect(noDesc.find((i) => i.key === 'seo')?.satisfied).toBe(false);
  });

  it('requires both latitude and longitude to be confirmed', () => {
    const noLat = evaluatePublishPreflight({ ...ready(), latitude: null });
    expect(noLat.find((i) => i.key === 'latLng')?.satisfied).toBe(false);
    const noLng = evaluatePublishPreflight({ ...ready(), longitude: null });
    expect(noLng.find((i) => i.key === 'latLng')?.satisfied).toBe(false);
  });

  it('requires a council tax band', () => {
    const result = evaluatePublishPreflight({ ...ready(), councilTaxBand: null });
    expect(result.find((i) => i.key === 'councilTaxBand')?.satisfied).toBe(false);
  });

  it('requires a confirmed tenure', () => {
    const result = evaluatePublishPreflight({ ...ready(), tenure: null });
    expect(result.find((i) => i.key === 'tenure')?.satisfied).toBe(false);
  });

  it('reports isPublishReady false when any item fails', () => {
    const result = evaluatePublishPreflight({ ...ready(), councilTaxBand: null });
    expect(isPublishReady(result)).toBe(false);
  });
});

describe('publishOverrideSchema', () => {
  it('accepts publishing with no override when the listing is ready', () => {
    expect(publishOverrideSchema.safeParse({ override: false }).success).toBe(true);
  });

  it('requires a typed reason when overriding (FR-F-8 — recorded in the audit log)', () => {
    expect(publishOverrideSchema.safeParse({ override: true }).success).toBe(false);
    expect(publishOverrideSchema.safeParse({ override: true, reason: '   ' }).success).toBe(false);
    expect(
      publishOverrideSchema.safeParse({
        override: true,
        reason: 'Vendor instructed go-live ahead of floorplan delivery.',
      }).success,
    ).toBe(true);
  });

  it('rejects an over-long override reason', () => {
    const long = 'x'.repeat(2001);
    expect(publishOverrideSchema.safeParse({ override: true, reason: long }).success).toBe(false);
  });

  it('omits the reason key entirely when not overriding (exactOptionalPropertyTypes)', () => {
    const parsed = publishOverrideSchema.parse({ override: false });
    expect('reason' in parsed && parsed.reason !== undefined).toBe(false);
  });
});
