import { describe, expect, it, vi } from 'vitest';

import {
  getSeoMetadata,
  listSeoMetadata,
  resolveSeoMetadata,
  type SeoMetadataReader,
  type SeoMetadataRow,
} from './seo-metadata.js';

// EPIC-O FR-O-4 — the per-entity SEO-metadata read model. `listSeoMetadata` shapes
// the admin table query (default first, then newest entity overrides);
// `getSeoMetadata` is the single-row lookup the editor loads; `resolveSeoMetadata`
// returns an entity override else the tenant-wide default. Tenant scoping is applied
// by the caller (withTenant); these just shape the queries + pass rows through.

const ENTITY_ID = '11111111-1111-1111-1111-111111111111';

function row(over: Partial<SeoMetadataRow> = {}): SeoMetadataRow {
  return {
    id: 'm1',
    scope: 'property',
    scopeId: ENTITY_ID,
    metaTitle: 'Override title',
    metaDescription: null,
    canonicalUrl: null,
    ogImage: null,
    noIndex: false,
    noFollow: false,
    structuredData: null,
    ...over,
  };
}

function reader(): {
  r: SeoMetadataReader;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  return {
    r: { seoMetadata: { findMany, findFirst } } as unknown as SeoMetadataReader,
    findMany,
    findFirst,
  };
}

describe('listSeoMetadata', () => {
  it('orders by scope ascending then created-at descending', async () => {
    const { r, findMany } = reader();
    await listSeoMetadata(r);
    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ scope: 'asc' }, { createdAt: 'desc' }]);
  });

  it('returns the rows from the reader', async () => {
    const rows = [row(), row({ id: 'm2', scope: 'default', scopeId: null })];
    const { r, findMany } = reader();
    findMany.mockResolvedValue(rows);
    expect(await listSeoMetadata(r)).toEqual(rows);
  });
});

describe('getSeoMetadata', () => {
  it('looks up an exact scope + scopeId match', async () => {
    const { r, findFirst } = reader();
    await getSeoMetadata(r, 'property', ENTITY_ID);
    expect(findFirst.mock.calls[0]![0].where).toEqual({ scope: 'property', scopeId: ENTITY_ID });
  });

  it('defaults scopeId to null for the tenant-wide default lookup', async () => {
    const { r, findFirst } = reader();
    await getSeoMetadata(r, 'default');
    expect(findFirst.mock.calls[0]![0].where).toEqual({ scope: 'default', scopeId: null });
  });

  it('returns the matched row', async () => {
    const match = row();
    const { r, findFirst } = reader();
    findFirst.mockResolvedValue(match);
    expect(await getSeoMetadata(r, 'property', ENTITY_ID)).toEqual(match);
  });

  it('returns null when there is no matching row', async () => {
    const { r } = reader();
    expect(await getSeoMetadata(r, 'property', ENTITY_ID)).toBeNull();
  });
});

describe('resolveSeoMetadata', () => {
  it('returns the entity override when one exists (no default lookup)', async () => {
    const override = row();
    const { r, findFirst } = reader();
    findFirst.mockResolvedValueOnce(override);
    const result = await resolveSeoMetadata(r, 'property', ENTITY_ID);
    expect(result).toEqual(override);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to the tenant-wide default when there is no override', async () => {
    const fallback = row({ id: 'd1', scope: 'default', scopeId: null });
    const { r, findFirst } = reader();
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(fallback);
    const result = await resolveSeoMetadata(r, 'property', ENTITY_ID);
    expect(result).toEqual(fallback);
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[1]![0].where).toEqual({ scope: 'default', scopeId: null });
  });

  it('returns null when neither an override nor a default exists', async () => {
    const { r } = reader();
    expect(await resolveSeoMetadata(r, 'property', ENTITY_ID)).toBeNull();
  });
});
