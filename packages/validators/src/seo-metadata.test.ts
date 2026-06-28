import { describe, expect, it } from 'vitest';

import {
  SEO_META_DESCRIPTION_MAX,
  SEO_META_TITLE_MAX,
  SEO_SCOPES,
  seoMetadataUpsertSchema,
} from './seo-metadata.js';

// EPIC-O FR-O-4 — the per-entity SEO-metadata override schema. An entity scope
// (page / property / area_guide / blog_post / branch) requires a scopeId; the
// `default` tenant-wide fallback must not carry one. Title (≤ 60) and description
// (≤ 160) honour the SERP ceilings; blank optional fields normalise to undefined.

const ENTITY_ID = '11111111-1111-1111-1111-111111111111';

const VALID_ENTITY = {
  scope: 'property' as const,
  scopeId: ENTITY_ID,
  metaTitle: '3-bed terraced house in Didsbury',
  metaDescription: 'A bright family home moments from the village.',
  canonicalUrl: '/properties/example',
  ogImage: '/media/og/example.jpg',
  noIndex: false,
  noFollow: false,
};

describe('seoMetadataUpsertSchema', () => {
  it('accepts a valid entity override', () => {
    const parsed = seoMetadataUpsertSchema.safeParse(VALID_ENTITY);
    expect(parsed.success).toBe(true);
  });

  it('accepts the tenant-wide default (no scopeId)', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({
      scope: 'default',
      metaTitle: 'Acme Estates',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.scopeId).toBeUndefined();
    }
  });

  it('accepts every entity scope with a scopeId', () => {
    for (const scope of SEO_SCOPES) {
      if (scope === 'default') continue;
      const parsed = seoMetadataUpsertSchema.safeParse({ scope, scopeId: ENTITY_ID });
      expect(parsed.success, scope).toBe(true);
    }
  });

  it('rejects an entity scope missing its scopeId', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({ scope: 'property' });
    expect(parsed.success).toBe(false);
  });

  it('rejects the default scope carrying a scopeId', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({ scope: 'default', scopeId: ENTITY_ID });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown scope', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({ scope: 'unknown', scopeId: ENTITY_ID });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-uuid scopeId', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({ scope: 'property', scopeId: 'not-a-uuid' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a meta title over the SERP ceiling', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({
      ...VALID_ENTITY,
      metaTitle: 'x'.repeat(SEO_META_TITLE_MAX + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a meta description over the SERP ceiling', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({
      ...VALID_ENTITY,
      metaDescription: 'x'.repeat(SEO_META_DESCRIPTION_MAX + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it('normalises blank optional fields to undefined', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({
      scope: 'property',
      scopeId: ENTITY_ID,
      metaTitle: '   ',
      metaDescription: '',
      canonicalUrl: '',
      ogImage: '   ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.metaTitle).toBeUndefined();
      expect(parsed.data.metaDescription).toBeUndefined();
      expect(parsed.data.canonicalUrl).toBeUndefined();
      expect(parsed.data.ogImage).toBeUndefined();
    }
  });

  it('defaults the noindex / nofollow flags to false', () => {
    const parsed = seoMetadataUpsertSchema.safeParse({ scope: 'default' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.noIndex).toBe(false);
      expect(parsed.data.noFollow).toBe(false);
    }
  });

  it('carries through a structured-data override', () => {
    const structuredData = { '@type': 'RealEstateListing', name: 'Example' };
    const parsed = seoMetadataUpsertSchema.safeParse({ ...VALID_ENTITY, structuredData });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.structuredData).toEqual(structuredData);
    }
  });
});
